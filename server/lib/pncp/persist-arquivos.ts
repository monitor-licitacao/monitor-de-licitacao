import postgres from 'postgres';
import { getComprasGovSql } from '../compras-gov/persist.js';
import { resolveArquivoDownloadUrl } from './arquivos-client.js';
import type { PncpArquivoDto } from './types.js';

export type ContratacaoArquivoRow = {
  id: string;
  sequencial_documento: number;
  titulo: string;
  tipo_documento_id: number | null;
  tipo_documento_nome: string | null;
  tipo_documento_descricao: string | null;
  url_download: string;
  status_ativo: boolean;
  data_publicacao_pncp: Date | null;
};

function parseTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function upsertArquivos(
  contratacaoId: string,
  arquivos: PncpArquivoDto[],
  source: 'pncp_sync' | 'pncp_ingest' = 'pncp_sync',
): Promise<number> {
  const sql = getComprasGovSql();
  let count = 0;

  for (const arq of arquivos) {
    const url = resolveArquivoDownloadUrl(arq);
    if (!url || arq.sequencialDocumento == null) continue;

    await sql`
      INSERT INTO contratacao_arquivo (
        contratacao_id,
        sequencial_documento,
        titulo,
        tipo_documento_id,
        tipo_documento_nome,
        tipo_documento_descricao,
        url_download,
        status_ativo,
        data_publicacao_pncp,
        source,
        raw_json,
        updated_at
      )
      VALUES (
        ${contratacaoId}::uuid,
        ${arq.sequencialDocumento},
        ${arq.titulo},
        ${arq.tipoDocumentoId ?? null},
        ${arq.tipoDocumentoNome ?? null},
        ${arq.tipoDocumentoDescricao ?? null},
        ${url},
        ${arq.statusAtivo ?? true},
        ${parseTimestamp(arq.dataPublicacaoPncp)},
        ${source},
        ${sql.json(arq as unknown as postgres.JSONValue)},
        now()
      )
      ON CONFLICT (contratacao_id, sequencial_documento) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        tipo_documento_id = EXCLUDED.tipo_documento_id,
        tipo_documento_nome = EXCLUDED.tipo_documento_nome,
        tipo_documento_descricao = EXCLUDED.tipo_documento_descricao,
        url_download = EXCLUDED.url_download,
        status_ativo = EXCLUDED.status_ativo,
        data_publicacao_pncp = EXCLUDED.data_publicacao_pncp,
        source = EXCLUDED.source,
        raw_json = EXCLUDED.raw_json,
        updated_at = now()
    `;
    count++;
  }

  return count;
}

export async function listArquivos(contratacaoId: string): Promise<ContratacaoArquivoRow[]> {
  const sql = getComprasGovSql();
  return sql<ContratacaoArquivoRow[]>`
    SELECT
      id,
      sequencial_documento,
      titulo,
      tipo_documento_id,
      tipo_documento_nome,
      tipo_documento_descricao,
      url_download,
      status_ativo,
      data_publicacao_pncp
    FROM contratacao_arquivo
    WHERE contratacao_id = ${contratacaoId}::uuid
      AND status_ativo = true
    ORDER BY sequencial_documento
  `;
}

export async function countArquivos(contratacaoId: string): Promise<number> {
  const sql = getComprasGovSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM contratacao_arquivo
    WHERE contratacao_id = ${contratacaoId}::uuid
      AND status_ativo = true
  `;
  return Number.parseInt(rows[0]?.count ?? '0', 10);
}
