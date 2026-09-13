import { getComprasGovSql } from '../../sourceLayer.js';
import type {
  AmparoApiRow,
  DomainListFilters,
  InstrumentoApiRow,
  ModalidadeApiRow,
  PncpDomainKind,
} from './types.js';

function likePattern(q?: string): string | null {
  const trimmed = q?.trim();
  if (!trimmed) return null;
  return `%${trimmed}%`;
}

export async function listModalidades(filters: DomainListFilters = {}): Promise<ModalidadeApiRow[]> {
  const sql = getComprasGovSql();
  const q = likePattern(filters.q);
  const rows = await sql<
    {
      id: string;
      pncp_id: number;
      nome: string;
      descricao: string | null;
      irp: boolean | null;
      status_ativo: boolean;
      source_created_at: Date | null;
      source_updated_at: Date | null;
      first_seen_at: Date | null;
      last_seen_at: Date | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT id, pncp_id, nome, descricao, irp, status_ativo,
           source_created_at, source_updated_at, first_seen_at, last_seen_at, raw_json
    FROM pncp_modalidade
    WHERE (${filters.statusAtivo ?? null}::boolean IS NULL OR status_ativo = ${filters.statusAtivo ?? null})
      AND (${q}::text IS NULL OR nome ILIKE ${q} OR descricao ILIKE ${q})
    ORDER BY pncp_id
  `;
  return rows.map((row) => ({
    id: row.id,
    pncpId: row.pncp_id,
    nome: row.nome,
    descricao: row.descricao,
    irp: row.irp,
    statusAtivo: row.status_ativo,
    sourceCreatedAt: row.source_created_at,
    sourceUpdatedAt: row.source_updated_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    rawJson: row.raw_json,
  }));
}

export async function listInstrumentos(filters: DomainListFilters = {}): Promise<InstrumentoApiRow[]> {
  const sql = getComprasGovSql();
  const q = likePattern(filters.q);
  const rows = await sql<
    {
      id: string;
      pncp_id: number;
      nome: string;
      descricao: string | null;
      obrigatoriedade_abertura_proposta: string | null;
      obrigatoriedade_encerramento_proposta: string | null;
      status_ativo: boolean;
      source_created_at: Date | null;
      source_updated_at: Date | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT id, pncp_id, nome, descricao,
           obrigatoriedade_abertura_proposta, obrigatoriedade_encerramento_proposta,
           status_ativo, source_created_at, source_updated_at, raw_json
    FROM pncp_instrumento_convocatorio
    WHERE (${filters.statusAtivo ?? null}::boolean IS NULL OR status_ativo = ${filters.statusAtivo ?? null})
      AND (${q}::text IS NULL OR nome ILIKE ${q} OR descricao ILIKE ${q})
    ORDER BY pncp_id
  `;
  return rows.map((row) => ({
    id: row.id,
    pncpId: row.pncp_id,
    nome: row.nome,
    descricao: row.descricao,
    obrigatoriedadeAberturaProposta: row.obrigatoriedade_abertura_proposta,
    obrigatoriedadeEncerramentoProposta: row.obrigatoriedade_encerramento_proposta,
    statusAtivo: row.status_ativo,
    sourceCreatedAt: row.source_created_at,
    sourceUpdatedAt: row.source_updated_at,
    rawJson: row.raw_json,
  }));
}

export async function listAmparos(filters: DomainListFilters = {}): Promise<AmparoApiRow[]> {
  const sql = getComprasGovSql();
  const q = likePattern(filters.q);
  const rows = await sql<
    {
      id: string;
      pncp_id: number;
      nome: string;
      descricao: string | null;
      status_ativo: boolean;
      source_created_at: Date | null;
      source_updated_at: Date | null;
      raw_json: Record<string, unknown> | null;
      tipo_id: string | null;
      tipo_pncp_id: number | null;
      tipo_nome: string | null;
      tipo_descricao: string | null;
      tipo_status_ativo: boolean | null;
    }[]
  >`
    SELECT a.id, a.pncp_id, a.nome, a.descricao, a.status_ativo,
           a.source_created_at, a.source_updated_at, a.raw_json,
           t.id AS tipo_id, t.pncp_id AS tipo_pncp_id, t.nome AS tipo_nome,
           t.descricao AS tipo_descricao, t.status_ativo AS tipo_status_ativo
    FROM pncp_amparo_legal a
    LEFT JOIN pncp_tipo_amparo_legal t ON t.id = a.tipo_amparo_legal_id
    WHERE (${filters.statusAtivo ?? null}::boolean IS NULL OR a.status_ativo = ${filters.statusAtivo ?? null})
      AND (${filters.tipo ?? null}::int IS NULL OR t.pncp_id = ${filters.tipo ?? null})
      AND (${q}::text IS NULL OR a.nome ILIKE ${q} OR a.descricao ILIKE ${q})
    ORDER BY a.pncp_id
  `;
  return rows.map((row) => ({
    id: row.id,
    pncpId: row.pncp_id,
    nome: row.nome,
    descricao: row.descricao,
    statusAtivo: row.status_ativo,
    sourceCreatedAt: row.source_created_at,
    sourceUpdatedAt: row.source_updated_at,
    rawJson: row.raw_json,
    tipoAmparoLegal: row.tipo_id
      ? {
          id: row.tipo_id,
          pncpId: row.tipo_pncp_id ?? 0,
          nome: row.tipo_nome ?? '',
          descricao: row.tipo_descricao,
          statusAtivo: row.tipo_status_ativo ?? true,
        }
      : null,
  }));
}

export async function getAmparoById(id: string): Promise<AmparoApiRow | null> {
  const rows = await listAmparos({});
  return rows.find((row) => row.id === id || String(row.pncpId) === id) ?? null;
}

export async function getModalidadeByPncpId(pncpId: number): Promise<ModalidadeApiRow | null> {
  const rows = await listModalidades({});
  return rows.find((row) => row.pncpId === pncpId) ?? null;
}

export async function getInstrumentoByPncpId(pncpId: number): Promise<InstrumentoApiRow | null> {
  const rows = await listInstrumentos({});
  return rows.find((row) => row.pncpId === pncpId) ?? null;
}

export async function getAmparoByPncpId(pncpId: number): Promise<AmparoApiRow | null> {
  const rows = await listAmparos({});
  return rows.find((row) => row.pncpId === pncpId) ?? null;
}

export async function countPncpDomainRows(kind: PncpDomainKind): Promise<number> {
  const sql = getComprasGovSql();
  const table =
    kind === 'modalidade'
      ? 'pncp_modalidade'
      : kind === 'instrumento'
        ? 'pncp_instrumento_convocatorio'
        : 'pncp_amparo_legal';
  const rows = await sql.unsafe<{ count: string }[]>(`SELECT count(*)::text AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
}

export function parseStatusAtivo(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}
