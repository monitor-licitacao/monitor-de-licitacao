import postgres from 'postgres';
import { getComprasGovSql } from '../compras-gov/persist.js';
import { buildHistoricoEventoLabel } from './arquivos-client.js';
import type { PncpHistoricoLogDto } from './types.js';

export type ContratacaoLogPncpRow = {
  id: string;
  tipo_log_nome: string;
  categoria_nome: string;
  evento_label: string;
  documento_titulo: string | null;
  documento_tipo: string | null;
  documento_sequencial: number | null;
  item_numero: number | null;
  justificativa: string | null;
  usuario_nome: string | null;
  occurred_at: Date;
};

function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function upsertHistoricoPncp(
  contratacaoId: string,
  logs: PncpHistoricoLogDto[],
  source: 'pncp_sync' | 'pncp_ingest' = 'pncp_sync',
): Promise<number> {
  const sql = getComprasGovSql();
  let count = 0;

  for (const log of logs) {
    const occurredAt = parseTimestamp(log.logManutencaoDataInclusao);
    if (!occurredAt) continue;

    await sql`
      INSERT INTO contratacao_log_pncp (
        contratacao_id,
        tipo_log_nome,
        categoria_nome,
        evento_label,
        documento_titulo,
        documento_tipo,
        documento_sequencial,
        item_numero,
        justificativa,
        usuario_nome,
        occurred_at,
        source,
        raw_json
      )
      VALUES (
        ${contratacaoId}::uuid,
        ${log.tipoLogManutencaoNome},
        ${log.categoriaLogManutencaoNome},
        ${buildHistoricoEventoLabel(log)},
        ${log.documentoTitulo ?? null},
        ${log.documentoTipo ?? null},
        ${log.documentoSequencial ?? null},
        ${log.itemNumero ?? null},
        ${log.justificativa ?? null},
        ${log.usuarioNome ?? null},
        ${occurredAt},
        ${source},
        ${sql.json(log as unknown as postgres.JSONValue)}
      )
      ON CONFLICT DO NOTHING
    `;
    count++;
  }

  return count;
}

export async function listHistoricoPncp(
  contratacaoId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ContratacaoLogPncpRow[]> {
  const sql = getComprasGovSql();
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  return sql<ContratacaoLogPncpRow[]>`
    SELECT
      id,
      tipo_log_nome,
      categoria_nome,
      evento_label,
      documento_titulo,
      documento_tipo,
      documento_sequencial,
      item_numero,
      justificativa,
      usuario_nome,
      occurred_at
    FROM contratacao_log_pncp
    WHERE contratacao_id = ${contratacaoId}::uuid
    ORDER BY occurred_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function countHistoricoPncp(contratacaoId: string): Promise<number> {
  const sql = getComprasGovSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM contratacao_log_pncp
    WHERE contratacao_id = ${contratacaoId}::uuid
  `;
  return Number.parseInt(rows[0]?.count ?? '0', 10);
}
