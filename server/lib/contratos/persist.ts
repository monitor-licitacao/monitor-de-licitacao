import postgres from 'postgres';
import { getContratacaoDetail } from '../compras-gov/enrichment-api.js';
import { getComprasGovSql } from '../sourceLayer.js';
import { queryPriceStatsForItem } from '../pncp/query-price-stats.js';
import { canonizeUnidade } from '../pncp/unidade-canonica.js';
import {
  filterItensByNumeros,
  flattenContratacaoItens,
  mapContratacaoItemToManualInput,
  sumItensNaoSigilosos,
  validateManualFromContratacao,
} from './map-contratacao-items.js';
import { parseNumeroControlePncp } from '../pncp/resolve-controle.js';
import { resolveOrgaoCnpj } from './orgao-registry.js';
import {
  aggregateDashboard,
  buildAnalysis,
  buildContractHealth,
  filterByStatus,
  filterByVencimento,
  isOportunidadeRenovacao,
  isVencendo,
  needsAction,
  sortAnalyses,
} from './health.js';
import { syncHistoricoFromContratacaoRow } from './historico-catalog.js';
import {
  backfillContractFromContratacao,
  applyPncpVigenciaToLinkedManual,
  syncLinkedContracts,
} from './sync-from-contratacao.js';
import { resolveVigenciaExpectativa, type ContratacaoVigenciaContext } from './vigencia-policy.js';
import type {
  CatalogHit,
  ContractAnalysis,
  DashboardPayload,
  ListContractsQuery,
  ManualContractInput,
  TenantContractItemRow,
  TenantContractRow,
} from './types.js';

export function stripCnpj(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** CNPJ do órgão: coluna contratacao.cnpj_orgao ou prefixo do numero_controle_pncp. */
export function resolveOrgaoCnpjFromContratacaoMeta(input: {
  cnpj_orgao?: string | null;
  numero_controle_pncp?: string | null;
}): string {
  const fromColumn = stripCnpj(input.cnpj_orgao ?? '');
  if (fromColumn.length === 14) return fromColumn;

  const parsed = input.numero_controle_pncp
    ? parseNumeroControlePncp(input.numero_controle_pncp)
    : null;
  if (parsed?.cnpj.length === 14) return parsed.cnpj;

  return fromColumn;
}

export async function listTenantPartyCnpjs(tenantId: number): Promise<string[]> {
  const sql = getComprasGovSql();
  const rows = await sql<{ cnpj: string }[]>`
    SELECT cnpj FROM tenant_party WHERE tenant_id = ${tenantId}
  `;
  return rows.map((r) => r.cnpj);
}

export async function getPrimaryTenantParty(
  tenantId: number,
): Promise<{ cnpj: string; razao_social: string | null } | null> {
  const sql = getComprasGovSql();
  const rows = await sql<{ cnpj: string; razao_social: string | null }[]>`
    SELECT cnpj, razao_social
    FROM tenant_party
    WHERE tenant_id = ${tenantId}
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function countOrgaoContracts(tenantId: number, orgaoCnpj: string): Promise<number> {
  const sql = getComprasGovSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM tenant_contract
    WHERE tenant_id = ${tenantId} AND orgao_cnpj = ${orgaoCnpj}
  `;
  return Number(rows[0]?.count ?? 0);
}

async function hasOficioRenovacaoOuEncerramento(contractId: string): Promise<boolean> {
  const sql = getComprasGovSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM tenant_contract_oficio
    WHERE tenant_contract_id = ${contractId}
      AND tipo IN ('renovacao', 'encerramento')
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

async function computeDesvioPercentual(
  row: TenantContractRow,
  items: TenantContractItemRow[],
): Promise<number | null> {
  const itemWithCatalog = items.find((i) => i.catalogo_codigo_item != null && i.valor_unitario);
  if (!itemWithCatalog?.catalogo_codigo_item || !itemWithCatalog.valor_unitario) return null;

  try {
    const stats = await queryPriceStatsForItem({
      codigoCatalogo: itemWithCatalog.catalogo_codigo_item,
      catalogoTipo: itemWithCatalog.catalog_type,
      unidade: itemWithCatalog.unidade_canonica ?? canonizeUnidade(itemWithCatalog.unidade_medida),
    });
    if (!stats?.mediana || stats.mediana <= 0) return null;
    const valor = Number(itemWithCatalog.valor_unitario);
    return ((valor - stats.mediana) / stats.mediana) * 100;
  } catch {
    return null;
  }
}

export async function loadContractItems(contractId: string): Promise<TenantContractItemRow[]> {
  const sql = getComprasGovSql();
  return sql<TenantContractItemRow[]>`
    SELECT *
    FROM tenant_contract_item
    WHERE tenant_contract_id = ${contractId}
    ORDER BY ordem ASC, created_at ASC
  `;
}

async function loadContratacaoVigenciaContext(
  contratacaoId: string | null,
  row: Pick<TenantContractRow, 'data_vigencia_inicio' | 'data_vigencia_fim'>,
): Promise<ContratacaoVigenciaContext | null> {
  if (!contratacaoId) return null;
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      situacao: string | null;
      srp: boolean | null;
      modalidade_irp: boolean | null;
      instrumento_obrigatoriedade_encerramento: string | null;
      instrumento_nome: string | null;
    }[]
  >`
    SELECT
      c.situacao,
      c.srp,
      m.irp AS modalidade_irp,
      i.obrigatoriedade_encerramento_proposta AS instrumento_obrigatoriedade_encerramento,
      i.nome AS instrumento_nome
    FROM contratacao c
    LEFT JOIN pncp_modalidade m ON m.id = c.pncp_modalidade_id
    LEFT JOIN pncp_instrumento_convocatorio i ON i.id = c.pncp_instrumento_convocatorio_id
    WHERE c.id = ${contratacaoId}::uuid
    LIMIT 1
  `;
  const meta = rows[0];
  if (!meta) return null;
  return {
    dataVigenciaInicio: row.data_vigencia_inicio,
    dataVigenciaFim: row.data_vigencia_fim,
    situacao: meta.situacao,
    srp: meta.srp,
    modalidadeIrp: meta.modalidade_irp,
    instrumentoObrigatoriedadeEncerramento: meta.instrumento_obrigatoriedade_encerramento,
    instrumentoNome: meta.instrumento_nome,
  };
}

export async function analyzeContractRow(
  row: TenantContractRow,
  tenantId: number,
): Promise<ContractAnalysis> {
  const [orgaoCount, hasOficio, items, vigenciaContext] = await Promise.all([
    countOrgaoContracts(tenantId, row.orgao_cnpj),
    hasOficioRenovacaoOuEncerramento(row.id),
    loadContractItems(row.id),
    loadContratacaoVigenciaContext(row.contratacao_id, row),
  ]);
  const desvio = await computeDesvioPercentual(row, items);
  const vigenciaExpectativa = vigenciaContext
    ? resolveVigenciaExpectativa(vigenciaContext)
    : row.data_vigencia_fim
      ? 'preenchida'
      : 'aguardando_contrato';
  const health = buildContractHealth({
    dataVigenciaFim: row.data_vigencia_fim,
    orgaoCnpj: row.orgao_cnpj,
    orgaoContractCount: orgaoCount,
    hasOficioRenovacaoOuEncerramento: hasOficio,
    desvioPercentual: desvio,
    vigenciaExpectativa,
  });
  return buildAnalysis({ row, health, hasOficio });
}

export async function listTenantContracts(tenantId: number): Promise<TenantContractRow[]> {
  const sql = getComprasGovSql();
  return sql<TenantContractRow[]>`
    SELECT *
    FROM tenant_contract
    WHERE tenant_id = ${tenantId}
    ORDER BY data_vigencia_fim ASC NULLS LAST, created_at DESC
  `;
}

export async function getTenantContractById(
  tenantId: number,
  id: string,
): Promise<TenantContractRow | null> {
  const sql = getComprasGovSql();
  const rows = await sql<TenantContractRow[]>`
    SELECT *
    FROM tenant_contract
    WHERE tenant_id = ${tenantId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function analyzeAllForTenant(tenantId: number): Promise<ContractAnalysis[]> {
  const rows = await listTenantContracts(tenantId);
  return Promise.all(rows.map((r) => analyzeContractRow(r, tenantId)));
}

export async function getDashboard(tenantId: number): Promise<DashboardPayload> {
  const analyses = await analyzeAllForTenant(tenantId);
  const agg = aggregateDashboard(analyses);

  const contratos = analyses.filter((a) => a.contrato.tipo === 'contrato');
  const atas = analyses.filter((a) => a.contrato.tipo === 'ata');

  const contratosCriticos = analyses.filter((a) => a.health.status === 'critico');
  const contratosPrecisamAcao = analyses.filter((a) => needsAction(a));
  const contratosVencendo = analyses.filter((a) =>
    isVencendo(a.health.fatores.tempo_restante.dias_restantes),
  );
  const oportunidadesRenovacao = analyses.filter((a) =>
    isOportunidadeRenovacao(
      a.health.fatores.tempo_restante.dias_restantes,
      a.health.fatores.tempo_restante.score,
    ),
  );

  const acoes = analyses.flatMap((a) => a.acoes_recomendadas);
  const priorityOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  acoes.sort((a, b) => priorityOrder[a.prioridade] - priorityOrder[b.prioridade]);

  return {
    ...agg,
    contratos,
    atas,
    contratos_criticos: contratosCriticos,
    contratos_precisam_acao: contratosPrecisamAcao,
    contratos_vencendo: contratosVencendo,
    oportunidades_renovacao: oportunidadesRenovacao,
    acoes_prioritarias: acoes.slice(0, 20),
  };
}

export async function listContractsPaginated(
  tenantId: number,
  query: ListContractsQuery,
): Promise<{ data: ContractAnalysis[]; pagination: { page: number; limit: number; total: number } }> {
  let analyses = await analyzeAllForTenant(tenantId);

  if (query.tipo) {
    analyses = analyses.filter((a) => a.contrato.tipo === query.tipo);
  }
  if (query.fornecedorCnpj) {
    const cnpj = stripCnpj(query.fornecedorCnpj);
    analyses = analyses.filter((a) => a.contrato.fornecedor_cnpj === cnpj);
  }

  analyses = filterByStatus(analyses, query.status);
  analyses = filterByVencimento(analyses, query.vencimento);
  analyses = sortAnalyses(analyses, query.orderBy ?? 'health_score');

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
  const total = analyses.length;
  const start = (page - 1) * limit;
  const data = analyses.slice(start, start + limit);

  return { data, pagination: { page, limit, total } };
}

export async function searchCatalog(q: string, limit = 20): Promise<CatalogHit[]> {
  const sql = getComprasGovSql();
  const term = q.trim();
  if (term.length < 2) return [];

  const code = Number.parseInt(term.replace(/\D/g, ''), 10);
  const rows = await sql<
    {
      id: string;
      catalog_type: string;
      codigo_item: number;
      descricao_item: string | null;
      nome_classe: string | null;
    }[]
  >`
    SELECT id, catalog_type, codigo_item, descricao_item, nome_classe
    FROM catalog_item
    WHERE (
      descricao_item ILIKE ${'%' + term + '%'}
      OR (${Number.isFinite(code) ? code : null}::int IS NOT NULL AND codigo_item = ${Number.isFinite(code) ? code : null})
    )
    ORDER BY descricao_item ASC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    tipo: r.catalog_type === 'CATSER' ? 'servico' : 'material',
    codigo: r.codigo_item,
    descricao: r.descricao_item ?? String(r.codigo_item),
    unidade: null,
    classe: r.nome_classe,
  }));
}

export async function insertManualContract(
  tenantId: number,
  input: ManualContractInput,
): Promise<string> {
  const contratacaoId = input.contratacao_id?.trim();
  if (contratacaoId) {
    return insertManualFromContratacao(tenantId, { ...input, contratacao_id: contratacaoId });
  }

  const orgaoCnpj = stripCnpj(input.orgao_cnpj ?? '');
  if (orgaoCnpj.length !== 14) {
    throw new Error('Informe o CNPJ do órgão contratante.');
  }
  if (!input.objeto_contrato?.trim() && !input.numero_contrato_empenho?.trim()) {
    throw new Error('Informe o objeto ou o número do contrato.');
  }

  const party = await getPrimaryTenantParty(tenantId);
  if (!party) {
    throw new Error('Configure o CNPJ do fornecedor em tenant_party.');
  }

  const itens = input.itens ?? [];
  const itensTotal = itens.reduce((acc, item) => {
    const qtd = item.quantidade ?? 0;
    const unit = item.valor_unitario ?? 0;
    return acc + (item.valor_total ?? qtd * unit);
  }, 0);
  const valorGlobal = input.valor_global ?? (itensTotal > 0 ? itensTotal : null);

  return persistManualContractRow({
    tenantId,
    party,
    orgaoCnpj,
    orgaoRazaoSocial: input.orgao_razao_social ?? null,
    ufSigla: input.uf_sigla ?? null,
    municipioNome: input.municipio_nome ?? null,
    numeroContratoEmpenho: input.numero_contrato_empenho ?? null,
    numeroControlePncp: null,
    contratacaoId: null,
    objeto: input.objeto_contrato ?? null,
    valorGlobal,
    dataVigenciaInicio: input.data_vigencia_inicio ?? null,
    dataVigenciaFim: input.data_vigencia_fim ?? null,
    itens,
  });
}

export async function insertManualFromContratacao(
  tenantId: number,
  input: ManualContractInput,
): Promise<string> {
  const validation = validateManualFromContratacao(input);
  if (validation) throw new Error(validation);

  const detail = await getContratacaoDetail(input.contratacao_id!);
  if (!detail) throw new Error('Contratação não encontrada.');

  const sql = getComprasGovSql();
  const metaRows = await sql<
    {
      cnpj_orgao: string;
      uf: string | null;
      municipio: string | null;
      numero_controle_pncp: string;
      valor_estimado: string | null;
    }[]
  >`
    SELECT cnpj_orgao, uf, municipio, numero_controle_pncp, valor_estimado
    FROM contratacao WHERE id = ${input.contratacao_id!} LIMIT 1
  `;
  const meta = metaRows[0];
  if (!meta) throw new Error('Contratação não encontrada.');

  const party = await getPrimaryTenantParty(tenantId);
  if (!party) {
    throw new Error('Configure o CNPJ do fornecedor em tenant_party.');
  }

  const cnpjOrgao = resolveOrgaoCnpjFromContratacaoMeta(meta);
  if (cnpjOrgao.length !== 14) {
    throw new Error('CNPJ do órgão não encontrado na contratação selecionada.');
  }

  const orgaoResolved =
    (await resolveOrgaoCnpj(cnpjOrgao)) ??
    ({
      cnpj: cnpjOrgao,
      razao_social: detail.resumo.unidade_compradora || detail.resumo.unidade || 'Órgão contratante',
      uf: meta.uf ?? undefined,
      municipio: meta.municipio ?? undefined,
      fonte: 'contratacao' as const,
    });

  const flatItens = flattenContratacaoItens({
    itens_avulsos: detail.itens_avulsos,
    grupos: detail.grupos,
  });
  const selected = filterItensByNumeros(flatItens, input.item_numeros);
  const mappedItens = selected.map(mapContratacaoItemToManualInput);
  const itensTotal = sumItensNaoSigilosos(selected);
  const valorEstimadoDb =
    meta.valor_estimado != null ? Number(meta.valor_estimado) : null;
  const valorGlobal =
    input.valor_global && input.valor_global > 0
      ? input.valor_global
      : detail.resumo.total_homologado ??
        detail.resumo.valor_estimado ??
        (valorEstimadoDb != null && valorEstimadoDb > 0 ? valorEstimadoDb : null) ??
        (itensTotal > 0 ? itensTotal : null);

  const contractId = await persistManualContractRow({
    tenantId,
    party,
    orgaoCnpj: cnpjOrgao,
    orgaoRazaoSocial: orgaoResolved.razao_social,
    ufSigla: orgaoResolved.uf ?? null,
    municipioNome: orgaoResolved.municipio ?? null,
    numeroContratoEmpenho: input.numero_contrato_empenho ?? null,
    numeroControlePncp: detail.resumo.numero_controle_pncp,
    contratacaoId: input.contratacao_id!,
    objeto: input.objeto_contrato?.trim() || detail.resumo.objeto,
    valorGlobal,
    dataVigenciaInicio: input.data_vigencia_inicio ?? null,
    dataVigenciaFim: input.data_vigencia_fim ?? null,
    itens: mappedItens,
  });

  await syncHistoricoFromContratacaoRow(input.contratacao_id!);
  await backfillContractFromContratacao(contractId);
  return contractId;
}

async function persistManualContractRow(input: {
  tenantId: number;
  party: { cnpj: string; razao_social: string | null };
  orgaoCnpj: string;
  orgaoRazaoSocial: string | null;
  ufSigla: string | null;
  municipioNome: string | null;
  numeroContratoEmpenho: string | null;
  numeroControlePncp: string | null;
  contratacaoId: string | null;
  objeto: string | null;
  valorGlobal: number | null;
  dataVigenciaInicio: string | null;
  dataVigenciaFim: string | null;
  itens: ManualContractInput['itens'];
}): Promise<string> {
  const sql = getComprasGovSql();
  if (input.orgaoCnpj.length !== 14) {
    throw new Error('CNPJ do órgão inválido na contratação selecionada.');
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO tenant_contract (
      tenant_id, tipo, origem,
      numero_controle_pncp, contratacao_id,
      orgao_cnpj, orgao_razao_social, uf_sigla, municipio_nome,
      fornecedor_cnpj, fornecedor_razao_social,
      numero_contrato_empenho, objeto, valor_global,
      data_vigencia_inicio, data_vigencia_fim,
      updated_at
    )
    VALUES (
      ${input.tenantId}, 'contrato', 'manual',
      ${input.numeroControlePncp}, ${input.contratacaoId}::uuid,
      ${input.orgaoCnpj}, ${input.orgaoRazaoSocial}, ${input.ufSigla}, ${input.municipioNome},
      ${input.party.cnpj}, ${input.party.razao_social ?? null},
      ${input.numeroContratoEmpenho}, ${input.objeto}, ${input.valorGlobal},
      ${input.dataVigenciaInicio}, ${input.dataVigenciaFim},
      now()
    )
    RETURNING id
  `;

  const contractId = inserted[0].id;
  const itens = input.itens ?? [];

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (!item.descricao?.trim() && !item.valor_unitario) continue;
    const qtd = item.quantidade ?? null;
    const unit = item.valor_unitario ?? null;
    const total = item.valor_total ?? (qtd != null && unit != null ? qtd * unit : null);
    const catalogType =
      item.material_ou_servico === 'servico'
        ? 'CATSER'
        : item.material_ou_servico === 'material'
          ? 'CATMAT'
          : null;

    await sql`
      INSERT INTO tenant_contract_item (
        tenant_contract_id, descricao, quantidade, unidade_medida, unidade_canonica,
        valor_unitario, valor_total, catalog_type, catalogo_codigo_item, ordem
      )
      VALUES (
        ${contractId},
        ${item.descricao?.trim() ?? null},
        ${qtd},
        ${item.unidade_medida ?? null},
        ${canonizeUnidade(item.unidade_medida)},
        ${unit},
        ${total},
        ${catalogType},
        ${item.catalogo_codigo_item ?? null},
        ${i}
      )
    `;
  }

  return contractId;
}

export async function upsertPncpContract(input: {
  tenantId: number;
  tipo: 'contrato' | 'ata';
  numeroControlePncp: string;
  orgaoCnpj: string;
  orgaoRazaoSocial?: string | null;
  ufSigla?: string | null;
  fornecedorCnpj: string;
  fornecedorRazaoSocial?: string | null;
  numeroContratoEmpenho?: string | null;
  objeto?: string | null;
  valorGlobal?: number | null;
  dataVigenciaInicio?: string | null;
  dataVigenciaFim?: string | null;
  sourceRecordId?: string | null;
  rawJson?: unknown;
  contratacaoId?: string | null;
}): Promise<string> {
  const sql = getComprasGovSql();

  const existingManual = input.numeroContratoEmpenho
    ? await sql<{ id: string }[]>`
        SELECT id FROM tenant_contract
        WHERE tenant_id = ${input.tenantId}
          AND origem = 'manual'
          AND orgao_cnpj = ${input.orgaoCnpj}
          AND numero_contrato_empenho = ${input.numeroContratoEmpenho}
        LIMIT 1
      `
    : [];

  if (existingManual.length > 0) {
    await sql`
      UPDATE tenant_contract
      SET
        numero_controle_pncp = COALESCE(numero_controle_pncp, ${input.numeroControlePncp}),
        contratacao_id = COALESCE(contratacao_id, ${input.contratacaoId ?? null}::uuid),
        source_record_id = COALESCE(source_record_id, ${input.sourceRecordId ?? null}::uuid),
        updated_at = now()
      WHERE id = ${existingManual[0].id}
    `;
    if (input.contratacaoId) {
      await applyPncpVigenciaToLinkedManual({
        contratacaoId: input.contratacaoId,
        dataVigenciaInicio: input.dataVigenciaInicio,
        dataVigenciaFim: input.dataVigenciaFim,
        valorGlobal: input.valorGlobal,
      });
    }
    return existingManual[0].id;
  }

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM tenant_contract
    WHERE tenant_id = ${input.tenantId}
      AND numero_controle_pncp = ${input.numeroControlePncp}
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE tenant_contract
      SET
        orgao_razao_social = COALESCE(${input.orgaoRazaoSocial ?? null}, orgao_razao_social),
        fornecedor_razao_social = COALESCE(${input.fornecedorRazaoSocial ?? null}, fornecedor_razao_social),
        objeto = COALESCE(${input.objeto ?? null}, objeto),
        valor_global = COALESCE(${input.valorGlobal ?? null}, valor_global),
        data_vigencia_inicio = COALESCE(${input.dataVigenciaInicio ?? null}, data_vigencia_inicio),
        data_vigencia_fim = COALESCE(${input.dataVigenciaFim ?? null}, data_vigencia_fim),
        contratacao_id = COALESCE(contratacao_id, ${input.contratacaoId ?? null}::uuid),
        source_record_id = COALESCE(source_record_id, ${input.sourceRecordId ?? null}::uuid),
        raw_json = COALESCE(${input.rawJson ? sql.json(input.rawJson as postgres.JSONValue) : null}, raw_json),
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    if (input.contratacaoId) {
      await applyPncpVigenciaToLinkedManual({
        contratacaoId: input.contratacaoId,
        dataVigenciaInicio: input.dataVigenciaInicio,
        dataVigenciaFim: input.dataVigenciaFim,
        valorGlobal: input.valorGlobal,
      });
      await syncLinkedContracts(input.contratacaoId);
    }
    return existing[0].id;
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO tenant_contract (
      tenant_id, tipo, origem, numero_controle_pncp,
      orgao_cnpj, orgao_razao_social, uf_sigla,
      fornecedor_cnpj, fornecedor_razao_social,
      numero_contrato_empenho, objeto, valor_global,
      data_vigencia_inicio, data_vigencia_fim,
      contratacao_id, source_record_id, raw_json, updated_at
    )
    VALUES (
      ${input.tenantId}, ${input.tipo}, 'pncp', ${input.numeroControlePncp},
      ${input.orgaoCnpj}, ${input.orgaoRazaoSocial ?? null}, ${input.ufSigla ?? null},
      ${input.fornecedorCnpj}, ${input.fornecedorRazaoSocial ?? null},
      ${input.numeroContratoEmpenho ?? null}, ${input.objeto ?? null}, ${input.valorGlobal ?? null},
      ${input.dataVigenciaInicio ?? null}, ${input.dataVigenciaFim ?? null},
      ${input.contratacaoId ?? null}::uuid,
      ${input.sourceRecordId ?? null}::uuid,
      ${input.rawJson ? sql.json(input.rawJson as postgres.JSONValue) : null},
      now()
    )
    RETURNING id
  `;

  return rows[0].id;
}

export { backfillContractFromContratacao, syncLinkedContracts };

export async function closeContratosPool() {
  // pool shared via sourceLayer — no-op here
}
