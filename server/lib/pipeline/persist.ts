import { getComprasGovSql } from '../sourceLayer.js';
import { buildSnapshotFromContratacao, stripCnpj } from './snapshot.js';
import type {
  ContratacaoSnapshotSource,
  PipelineItemRow,
  PipelineListQuery,
  PipelinePersistedStatus,
  PipelineSnapshotInput,
  PipelineStatusUpdate,
} from './types.js';

function mapRow(row: Record<string, unknown>): PipelineItemRow {
  return {
    id: String(row.id),
    tenant_id: Number(row.tenant_id),
    contratacao_id: row.contratacao_id ? String(row.contratacao_id) : null,
    numero_controle_pncp: String(row.numero_controle_pncp),
    portal: String(row.portal ?? 'PNCP') as PipelineItemRow['portal'],
    orgao_cnpj: String(row.orgao_cnpj),
    orgao_razao_social: row.orgao_razao_social ? String(row.orgao_razao_social) : null,
    objeto_compra: row.objeto_compra ? String(row.objeto_compra) : null,
    modalidade_nome: row.modalidade_nome ? String(row.modalidade_nome) : null,
    valor_total_estimado: row.valor_total_estimado != null ? Number(row.valor_total_estimado) : null,
    data_abertura_proposta: row.data_abertura_proposta
      ? new Date(String(row.data_abertura_proposta)).toISOString()
      : null,
    data_encerramento_proposta: row.data_encerramento_proposta
      ? new Date(String(row.data_encerramento_proposta)).toISOString()
      : null,
    uf_sigla: row.uf_sigla ? String(row.uf_sigla) : null,
    status: String(row.status) as PipelinePersistedStatus,
    vencedor: Boolean(row.vencedor),
    arquivada: Boolean(row.arquivada),
    source_record_id: row.source_record_id ? String(row.source_record_id) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listPipelineItems(
  tenantId: number,
  query: PipelineListQuery = {},
): Promise<{ data: PipelineItemRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const sql = getComprasGovSql();
  const limit = Math.min(Math.max(query.limit ?? 500, 1), 500);
  const arquivadas = query.arquivadas ?? 'all';

  const rows = await sql<Record<string, unknown>[]>`
    SELECT *
    FROM tenant_pipeline_item
    WHERE tenant_id = ${tenantId}
      AND (
        ${arquivadas} = 'all'
        OR (${arquivadas} = '1' AND arquivada = true)
        OR (${arquivadas} = '0' AND arquivada = false)
      )
    ORDER BY COALESCE(data_encerramento_proposta, data_abertura_proposta) ASC NULLS LAST
    LIMIT ${limit}
  `;

  const data = rows.map(mapRow);
  return {
    data,
    pagination: {
      page: 1,
      limit,
      total: data.length,
      totalPages: data.length > 0 ? 1 : 0,
    },
  };
}

export async function findPipelineByTenantAndPncp(
  tenantId: number,
  numeroControlePncp: string,
): Promise<PipelineItemRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM tenant_pipeline_item
    WHERE tenant_id = ${tenantId}
      AND numero_controle_pncp = ${numeroControlePncp.trim()}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getPipelineItemById(
  tenantId: number,
  id: string,
): Promise<PipelineItemRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM tenant_pipeline_item
    WHERE tenant_id = ${tenantId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function loadContratacaoSnapshotSource(
  contratacaoId: string,
): Promise<ContratacaoSnapshotSource | null> {
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      cnpj_orgao: string;
      objeto: string | null;
      modalidade_nome: string | null;
      valor_estimado: string | null;
      data_inicio_propostas: Date | null;
      data_fim_propostas: Date | null;
      uf: string | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT
      id, numero_controle_pncp, cnpj_orgao, objeto, modalidade_nome,
      valor_estimado, data_inicio_propostas, data_fim_propostas, uf, raw_json
    FROM contratacao
    WHERE id = ${contratacaoId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  const raw = row.raw_json ?? {};
  const orgaoEntidade = raw.orgaoEntidade as { razaoSocial?: string } | undefined;
  const unidadeOrgao = raw.unidadeOrgao as { ufSigla?: string; municipioNome?: string } | undefined;

  return {
    id: row.id,
    numero_controle_pncp: row.numero_controle_pncp,
    cnpj_orgao: row.cnpj_orgao,
    orgao_razao_social: orgaoEntidade?.razaoSocial ?? null,
    objeto: row.objeto,
    modalidade_nome: row.modalidade_nome,
    valor_estimado: row.valor_estimado,
    data_inicio_propostas: row.data_inicio_propostas,
    data_fim_propostas: row.data_fim_propostas,
    uf: row.uf ?? unidadeOrgao?.ufSigla ?? null,
    source_record_id: null,
  };
}

export async function loadContratacaoSnapshotByPncp(
  numeroControlePncp: string,
): Promise<ContratacaoSnapshotSource | null> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM contratacao
    WHERE numero_controle_pncp = ${numeroControlePncp.trim()}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return loadContratacaoSnapshotSource(rows[0].id);
}

export async function createPipelineItem(
  tenantId: number,
  snapshot: PipelineSnapshotInput,
  options: { status?: PipelinePersistedStatus } = {},
): Promise<{ ok: true; data: PipelineItemRow } | { ok: false; code: 'DUPLICATE'; existingId: string } | { ok: false; code: 'INVALID'; error: string }> {
  const numero = snapshot.numero_controle_pncp.trim();
  const orgaoCnpj = stripCnpj(snapshot.orgao_cnpj);
  if (orgaoCnpj.length !== 14) {
    return { ok: false, code: 'INVALID', error: 'CNPJ do órgão inválido.' };
  }

  const existing = await findPipelineByTenantAndPncp(tenantId, numero);
  if (existing) {
    return { ok: false, code: 'DUPLICATE', existingId: existing.id };
  }

  const sql = getComprasGovSql();
  const status = options.status ?? 'SELECIONADA';
  const rows = await sql<Record<string, unknown>[]>`
    INSERT INTO tenant_pipeline_item (
      tenant_id, contratacao_id, numero_controle_pncp, portal,
      orgao_cnpj, orgao_razao_social, objeto_compra, modalidade_nome,
      valor_total_estimado, data_abertura_proposta, data_encerramento_proposta,
      uf_sigla, status, vencedor, arquivada, source_record_id
    ) VALUES (
      ${tenantId},
      ${snapshot.contratacao_id ?? null},
      ${numero},
      ${snapshot.portal ?? 'PNCP'},
      ${orgaoCnpj},
      ${snapshot.orgao_razao_social ?? null},
      ${snapshot.objeto_compra ?? null},
      ${snapshot.modalidade_nome ?? null},
      ${snapshot.valor_total_estimado ?? null},
      ${snapshot.data_abertura_proposta ?? null},
      ${snapshot.data_encerramento_proposta ?? null},
      ${snapshot.uf_sigla ?? null},
      ${status},
      false,
      false,
      ${snapshot.source_record_id ?? null}
    )
    RETURNING *
  `;

  return { ok: true, data: mapRow(rows[0]) };
}

export async function createPipelineFromContratacaoId(
  tenantId: number,
  contratacaoId: string,
): Promise<
  | { ok: true; data: PipelineItemRow }
  | { ok: false; code: 'NOT_FOUND'; error: string }
  | { ok: false; code: 'DUPLICATE'; existingId: string }
  | { ok: false; code: 'INVALID'; error: string }
> {
  const source = await loadContratacaoSnapshotSource(contratacaoId);
  if (!source) {
    return { ok: false, code: 'NOT_FOUND', error: 'Contratação não encontrada.' };
  }
  const snapshot = buildSnapshotFromContratacao(source);
  if ('error' in snapshot) {
    return { ok: false, code: 'INVALID', error: snapshot.error };
  }
  return createPipelineItem(tenantId, snapshot);
}

export async function updatePipelineStatus(
  tenantId: number,
  id: string,
  update: PipelineStatusUpdate,
): Promise<PipelineItemRow | null> {
  const sql = getComprasGovSql();
  const vencedor = update.vencedor ?? false;
  const rows = await sql<Record<string, unknown>[]>`
    UPDATE tenant_pipeline_item
    SET status = ${update.status},
        vencedor = ${vencedor},
        updated_at = now()
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function setPipelineArchived(
  tenantId: number,
  id: string,
  arquivada: boolean,
): Promise<PipelineItemRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<Record<string, unknown>[]>`
    UPDATE tenant_pipeline_item
    SET arquivada = ${arquivada}, updated_at = now()
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deletePipelineItem(
  tenantId: number,
  id: string,
): Promise<boolean> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    DELETE FROM tenant_pipeline_item
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}
