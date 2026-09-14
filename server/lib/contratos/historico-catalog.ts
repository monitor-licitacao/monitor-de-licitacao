/**
 * Catálogo e persistência de eventos de histórico de contratação.
 */
import postgres from 'postgres';
import { getComprasGovSql } from '../sourceLayer.js';
import { syncLinkedContracts } from './sync-from-contratacao.js';

export type HistoricoEventCode =
  | 'PUBLICACAO_PNCP'
  | 'INICIO_PROPOSTAS'
  | 'FIM_PROPOSTAS'
  | 'CONTRATACAO_ANULADA'
  | 'CONTRATO_PNCP_PUBLICADO'
  | 'ATA_PNCP_PUBLICADA';

export type HistoricoImplicaVigencia = 'nenhuma' | 'contrato_pncp' | 'ata_pncp';

export type HistoricoCatalogEntry = {
  code: HistoricoEventCode;
  label: string;
  description: string;
  implica_vigencia: HistoricoImplicaVigencia;
  sort_order: number;
};

const INITIAL_HISTORICO_CATALOG: HistoricoCatalogEntry[] = [
  {
    code: 'PUBLICACAO_PNCP',
    label: 'Publicação no PNCP',
    description: 'Contratação divulgada no Portal Nacional de Contratações Públicas.',
    implica_vigencia: 'nenhuma',
    sort_order: 10,
  },
  {
    code: 'INICIO_PROPOSTAS',
    label: 'Início do recebimento de propostas',
    description: 'Abertura do prazo para envio de propostas.',
    implica_vigencia: 'nenhuma',
    sort_order: 20,
  },
  {
    code: 'FIM_PROPOSTAS',
    label: 'Encerramento de propostas',
    description: 'Encerramento do prazo para envio de propostas.',
    implica_vigencia: 'nenhuma',
    sort_order: 30,
  },
  {
    code: 'CONTRATACAO_ANULADA',
    label: 'Contratação anulada',
    description: 'Processo licitatório anulado pelo órgão contratante.',
    implica_vigencia: 'nenhuma',
    sort_order: 5,
  },
  {
    code: 'CONTRATO_PNCP_PUBLICADO',
    label: 'Contrato publicado no PNCP',
    description: 'Instrumento contratual publicado no PNCP.',
    implica_vigencia: 'contrato_pncp',
    sort_order: 40,
  },
  {
    code: 'ATA_PNCP_PUBLICADA',
    label: 'Ata de registro de preços publicada',
    description: 'Ata de registro de preços publicada no PNCP.',
    implica_vigencia: 'ata_pncp',
    sort_order: 45,
  },
];

let historicoCatalogSeedPromise: Promise<void> | null = null;

export async function ensureHistoricoCatalogSeeded(): Promise<void> {
  if (!historicoCatalogSeedPromise) {
    historicoCatalogSeedPromise = runHistoricoCatalogSeed().catch((err) => {
      historicoCatalogSeedPromise = null;
      throw err;
    });
  }
  await historicoCatalogSeedPromise;
}

async function runHistoricoCatalogSeed(): Promise<void> {
  const sql = getComprasGovSql();
  for (const item of INITIAL_HISTORICO_CATALOG) {
    await sql`
      INSERT INTO contratacao_event_catalog (
        code, label, description, implica_vigencia, sort_order, active, updated_at
      )
      VALUES (
        ${item.code},
        ${item.label},
        ${item.description},
        ${item.implica_vigencia},
        ${item.sort_order},
        true,
        now()
      )
      ON CONFLICT (code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        implica_vigencia = EXCLUDED.implica_vigencia,
        sort_order = EXCLUDED.sort_order,
        active = EXCLUDED.active,
        updated_at = now()
    `;
  }
}

export type HistoricoUiEntry = {
  data_hora: string;
  evento: string;
  descricao?: string;
  responsavel?: string;
  event_code: HistoricoEventCode;
  implica_vigencia: HistoricoImplicaVigencia;
};

function formatDateTimeBR(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export async function listHistorico(contratacaoId: string): Promise<HistoricoUiEntry[]> {
  await ensureHistoricoCatalogSeeded();
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      occurred_at: Date;
      descricao: string | null;
      responsavel: string | null;
      event_code: HistoricoEventCode;
      label: string;
      implica_vigencia: HistoricoImplicaVigencia;
    }[]
  >`
    SELECT h.occurred_at, h.descricao, h.responsavel, h.event_code,
           c.label, c.implica_vigencia
    FROM contratacao_historico h
    JOIN contratacao_event_catalog c ON c.code = h.event_code
    WHERE h.contratacao_id = ${contratacaoId}::uuid
    ORDER BY h.occurred_at DESC
  `;

  return rows.map((r) => ({
    data_hora: formatDateTimeBR(r.occurred_at) ?? '—',
    evento: r.label,
    descricao: r.descricao ?? undefined,
    responsavel: r.responsavel ?? undefined,
    event_code: r.event_code,
    implica_vigencia: r.implica_vigencia,
  }));
}

async function upsertHistoricoEvent(input: {
  contratacaoId: string;
  eventCode: HistoricoEventCode;
  occurredAt: Date;
  descricao?: string | null;
  responsavel?: string | null;
  source: 'pncp_ingest' | 'pncp_sync' | 'derived';
  rawJson?: unknown;
}): Promise<void> {
  const sql = getComprasGovSql();
  await sql`
    INSERT INTO contratacao_historico (
      contratacao_id, event_code, occurred_at, descricao, responsavel, source, raw_json
    )
    VALUES (
      ${input.contratacaoId}::uuid,
      ${input.eventCode},
      ${input.occurredAt},
      ${input.descricao ?? null},
      ${input.responsavel ?? null},
      ${input.source},
      ${input.rawJson ? sql.json(input.rawJson as postgres.JSONValue) : null}
    )
    ON CONFLICT (contratacao_id, event_code, occurred_at) DO UPDATE SET
      descricao = COALESCE(EXCLUDED.descricao, contratacao_historico.descricao),
      responsavel = COALESCE(EXCLUDED.responsavel, contratacao_historico.responsavel),
      source = EXCLUDED.source,
      raw_json = COALESCE(EXCLUDED.raw_json, contratacao_historico.raw_json)
  `;
}

export async function syncHistoricoFromContratacaoRow(contratacaoId: string): Promise<number> {
  await ensureHistoricoCatalogSeeded();
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      data_publicacao: Date | null;
      data_inicio_propostas: Date | null;
      data_fim_propostas: Date | null;
      situacao: string | null;
    }[]
  >`
    SELECT data_publicacao, data_inicio_propostas, data_fim_propostas, situacao
    FROM contratacao
    WHERE id = ${contratacaoId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return 0;

  let count = 0;
  const push = async (input: {
    eventCode: HistoricoEventCode;
    occurredAt: Date | null;
    descricao?: string | null;
    responsavel?: string | null;
  }) => {
    if (!input.occurredAt) return;
    await upsertHistoricoEvent({
      contratacaoId,
      eventCode: input.eventCode,
      occurredAt: input.occurredAt,
      descricao: input.descricao,
      responsavel: input.responsavel,
      source: 'derived',
    });
    count += 1;
  };

  if (row.situacao?.toLowerCase().includes('anulada')) {
    await push({
      eventCode: 'CONTRATACAO_ANULADA',
      occurredAt: row.data_fim_propostas ?? row.data_publicacao,
      descricao: row.situacao,
      responsavel: 'Órgão contratante',
    });
  }

  await push({
    eventCode: 'PUBLICACAO_PNCP',
    occurredAt: row.data_publicacao,
    descricao: 'Contratação divulgada no Portal Nacional de Contratações Públicas.',
    responsavel: 'PNCP',
  });
  await push({
    eventCode: 'INICIO_PROPOSTAS',
    occurredAt: row.data_inicio_propostas,
    responsavel: 'Sistema PNCP',
  });
  await push({
    eventCode: 'FIM_PROPOSTAS',
    occurredAt: row.data_fim_propostas,
    responsavel: 'Sistema PNCP',
  });

  await syncLinkedContracts(contratacaoId);
  return count;
}

export async function recordPncpInstrumentHistorico(input: {
  contratacaoId: string;
  tipo: 'contrato' | 'ata';
  occurredAt: Date;
  descricao?: string | null;
  rawJson?: unknown;
}): Promise<void> {
  await ensureHistoricoCatalogSeeded();
  const eventCode: HistoricoEventCode =
    input.tipo === 'ata' ? 'ATA_PNCP_PUBLICADA' : 'CONTRATO_PNCP_PUBLICADO';
  await upsertHistoricoEvent({
    contratacaoId: input.contratacaoId,
    eventCode,
    occurredAt: input.occurredAt,
    descricao: input.descricao,
    responsavel: 'PNCP',
    source: 'pncp_sync',
    rawJson: input.rawJson,
  });
  await syncLinkedContracts(input.contratacaoId);
}
