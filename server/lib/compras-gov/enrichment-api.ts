/**
 * API de enriquecimento — Fase E (issue #79).
 */
import { extractIdCompraFromLink } from './compare-pncp.js';
import { planEnrichment, type EnrichmentDecision, type EnrichmentPlan } from './enrichment-policy.js';
import {
  buildContratacaoDetail,
  type ContratacaoDetailResponse,
} from './normalize-contratacao-detail.js';
import { getComprasGovSql, getContratacaoEnrichmentContext } from './persist.js';

export type { ContratacaoDetailResponse } from './normalize-contratacao-detail.js';

export type EnrichmentBadge =
  | 'PNCP_SUFFICIENT'
  | 'ENRICHMENT_PARTIAL'
  | 'CG_METADATA'
  | 'PENDING';

export type ContratacaoListItem = {
  id: string;
  numeroControlePncp: string;
  objeto: string | null;
  situacao: string | null;
  uf: string | null;
  municipio: string | null;
  valorEstimado: number | null;
  idCompra: string | null;
  cnpjOrgao: string;
  ano: number;
  sequencialCompra: number;
  dataPublicacao: string | null;
  pncpItemCount: number;
};

export type CatalogLink = {
  codigoItem: number;
  catalogType: string;
  descricaoItem: string | null;
  nomePdm: string | null;
};

export type PgcRelatedStub = {
  ordemDfd: number;
  descricaoObjetoDfd: string | null;
  codigoItemCatalogo: number | null;
  ano: number;
};

export type ContratacaoEnrichmentResponse = {
  contratacaoId: string;
  numeroControlePncp: string;
  cnpjOrgao: string;
  ano: number;
  sequencialCompra: number;
  idCompra: string | null;
  pncpItemCount: number;
  links: {
    pncp: string;
    comprasGov: string | null;
  };
  plan: EnrichmentPlan;
  badge: EnrichmentBadge;
  decisions: EnrichmentDecision[];
  enrichmentPartial: boolean;
  catalogItems: CatalogLink[];
  pgcRelated: PgcRelatedStub[];
};

export function buildPncpAppUrl(cnpj: string, ano: number, sequencial: number): string {
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
}

export function buildComprasGovUrl(idCompra: string | null, urlOrigem: string | null): string | null {
  if (urlOrigem?.startsWith('http')) return urlOrigem;
  if (idCompra) {
    return `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${idCompra}`;
  }
  return null;
}

export function resolveEnrichmentBadge(plan: EnrichmentPlan): EnrichmentBadge {
  if (plan.decisions.includes('PNCP_SUFFICIENT') && !plan.enrichmentPartial) {
    return 'PNCP_SUFFICIENT';
  }
  if (plan.enrichmentPartial) {
    return 'ENRICHMENT_PARTIAL';
  }
  if (plan.decisions.includes('CG_METADATA_ONLY')) {
    return 'CG_METADATA';
  }
  return 'PENDING';
}

export async function listContratacoes(limit = 50): Promise<ContratacaoListItem[]> {
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      objeto: string | null;
      situacao: string | null;
      uf: string | null;
      municipio: string | null;
      valor_estimado: string | null;
      id_compra: string | null;
      cnpj_orgao: string;
      ano: number;
      sequencial_compra: number;
      data_publicacao: Date | null;
      item_count: string;
    }[]
  >`
    SELECT
      c.id,
      c.numero_controle_pncp,
      c.objeto,
      c.situacao,
      c.uf,
      c.municipio,
      c.valor_estimado,
      c.id_compra,
      c.cnpj_orgao,
      c.ano,
      c.sequencial_compra,
      c.data_publicacao,
      COUNT(i.id)::text AS item_count
    FROM contratacao c
    LEFT JOIN item i ON i.contratacao_id = c.id
    GROUP BY c.id
    ORDER BY c.data_publicacao DESC NULLS LAST, c.updated_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    numeroControlePncp: r.numero_controle_pncp,
    objeto: r.objeto,
    situacao: r.situacao,
    uf: r.uf,
    municipio: r.municipio,
    valorEstimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
    idCompra: r.id_compra,
    cnpjOrgao: r.cnpj_orgao,
    ano: r.ano,
    sequencialCompra: r.sequencial_compra,
    dataPublicacao: r.data_publicacao?.toISOString() ?? null,
    pncpItemCount: Number.parseInt(r.item_count, 10) || 0,
  }));
}

export async function getContratacaoEnrichment(
  contratacaoId: string,
): Promise<ContratacaoEnrichmentResponse | null> {
  const sql = getComprasGovSql();

  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      cnpj_orgao: string;
      ano: number;
      sequencial_compra: number;
      id_compra: string | null;
      url_origem: string | null;
    }[]
  >`
    SELECT id, numero_controle_pncp, cnpj_orgao, ano, sequencial_compra, id_compra, url_origem
    FROM contratacao
    WHERE id = ${contratacaoId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  const ctx = await getContratacaoEnrichmentContext(row.numero_controle_pncp);
  if (!ctx) return null;

  const raw = ctx.rawJson ?? {};
  const plan = planEnrichment({
    mode: 'contratacao',
    pncpItemCount: ctx.pncpItemCount,
    items: ctx.items,
    orcamentoSigilosoCodigo:
      typeof raw.orcamentoSigilosoCodigo === 'number' ? raw.orcamentoSigilosoCodigo : null,
    linkSistemaOrigem: ctx.urlOrigem,
  });

  const idCompra =
    row.id_compra ?? extractIdCompraFromLink(ctx.urlOrigem) ?? extractIdCompraFromLink(row.url_origem);

  const catalogCodigos = ctx.items
    .map((i) => i.codigoCatalogo)
    .filter((c): c is number => c != null && c > 0);

  let catalogItems: CatalogLink[] = [];
  if (catalogCodigos.length > 0) {
    const catalogRows = await sql<
      { codigo_item: number; catalog_type: string; descricao_item: string | null; nome_pdm: string | null }[]
    >`
      SELECT codigo_item, catalog_type, descricao_item, nome_pdm
      FROM catalog_item
      WHERE codigo_item = ANY(${catalogCodigos})
    `;
    catalogItems = catalogRows.map((c) => ({
      codigoItem: c.codigo_item,
      catalogType: c.catalog_type,
      descricaoItem: c.descricao_item,
      nomePdm: c.nome_pdm,
    }));
  }

  const pgcRows = await sql<
    {
      ordem_dfd: number;
      descricao_objeto_dfd: string | null;
      codigo_item_catalogo: number | null;
      ano: number;
    }[]
  >`
    SELECT ordem_dfd, descricao_objeto_dfd, codigo_item_catalogo, ano
    FROM pgc_dfd
    WHERE orgao_cnpj = ${row.cnpj_orgao} AND ano = ${row.ano}
    ORDER BY ordem_dfd
    LIMIT 5
  `;

  const pgcRelated: PgcRelatedStub[] = pgcRows.map((p) => ({
    ordemDfd: p.ordem_dfd,
    descricaoObjetoDfd: p.descricao_objeto_dfd,
    codigoItemCatalogo: p.codigo_item_catalogo,
    ano: p.ano,
  }));

  return buildEnrichmentPayload(row, ctx, plan, idCompra, catalogItems, pgcRelated);
}

function buildEnrichmentPayload(
  row: {
    id: string;
    numero_controle_pncp: string;
    cnpj_orgao: string;
    ano: number;
    sequencial_compra: number;
    id_compra: string | null;
    url_origem: string | null;
  },
  ctx: NonNullable<Awaited<ReturnType<typeof getContratacaoEnrichmentContext>>>,
  plan: EnrichmentPlan,
  idCompra: string | null,
  catalogItems: CatalogLink[],
  pgcRelated: PgcRelatedStub[],
): ContratacaoEnrichmentResponse {
  return {
    contratacaoId: row.id,
    numeroControlePncp: row.numero_controle_pncp,
    cnpjOrgao: row.cnpj_orgao,
    ano: row.ano,
    sequencialCompra: row.sequencial_compra,
    idCompra,
    pncpItemCount: ctx.pncpItemCount,
    links: {
      pncp: buildPncpAppUrl(row.cnpj_orgao, row.ano, row.sequencial_compra),
      comprasGov: buildComprasGovUrl(idCompra, ctx.urlOrigem ?? row.url_origem),
    },
    plan,
    badge: resolveEnrichmentBadge(plan),
    decisions: plan.decisions,
    enrichmentPartial: plan.enrichmentPartial,
    catalogItems,
    pgcRelated,
  };
}

export async function getContratacaoDetail(
  contratacaoId: string,
): Promise<ContratacaoDetailResponse | null> {
  const sql = getComprasGovSql();

  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      cnpj_orgao: string;
      ano: number;
      sequencial_compra: number;
      numero_compra: string | null;
      numero_processo: string | null;
      modalidade_nome: string | null;
      modo_disputa: string | null;
      situacao: string | null;
      municipio: string | null;
      uf: string | null;
      objeto: string | null;
      valor_estimado: string | null;
      data_publicacao: Date | null;
      data_inicio_propostas: Date | null;
      data_fim_propostas: Date | null;
      url_origem: string | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT
      id, numero_controle_pncp, cnpj_orgao, ano, sequencial_compra,
      numero_compra, numero_processo, modalidade_nome, modo_disputa, situacao,
      municipio, uf, objeto, valor_estimado,
      data_publicacao, data_inicio_propostas, data_fim_propostas,
      url_origem, raw_json
    FROM contratacao
    WHERE id = ${contratacaoId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  const enrichment = await getContratacaoEnrichment(contratacaoId);
  if (!enrichment) return null;

  const itemRows = await sql<
    {
      numero_item: number;
      descricao: string;
      quantidade: string | null;
      unidade_medida: string | null;
      valor_unitario_estimado: string | null;
      valor_total_estimado: string | null;
      situacao: string | null;
      codigo_catalogo: string | null;
      catalogo_tipo: string | null;
      ncm_nbs: string | null;
      parsed_facets: Record<string, unknown> | null;
      catalog_match_method: string | null;
      criterio_julgamento: string | null;
      beneficio_me_epp: string | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT numero_item, descricao, quantidade, unidade_medida,
           valor_unitario_estimado, valor_total_estimado, situacao,
           codigo_catalogo, catalogo_tipo, ncm_nbs, parsed_facets, catalog_match_method,
           criterio_julgamento, beneficio_me_epp,
           raw_json
    FROM item
    WHERE contratacao_id = ${contratacaoId}
    ORDER BY numero_item
  `;

  const detail = buildContratacaoDetail({
    id: row.id,
    numeroControlePncp: row.numero_controle_pncp,
    cnpjOrgao: row.cnpj_orgao,
    ano: row.ano,
    sequencialCompra: row.sequencial_compra,
    numeroCompra: row.numero_compra,
    numeroProcesso: row.numero_processo,
    modalidadeNome: row.modalidade_nome,
    modoDisputa: row.modo_disputa,
    situacao: row.situacao,
    municipio: row.municipio,
    uf: row.uf,
    objeto: row.objeto,
    valorEstimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
    dataPublicacao: row.data_publicacao,
    dataInicioPropostas: row.data_inicio_propostas,
    dataFimPropostas: row.data_fim_propostas,
    urlOrigem: row.url_origem,
    rawJson: row.raw_json,
    itens: itemRows.map((i) => ({
      numero_item: i.numero_item,
      descricao: i.descricao,
      quantidade: i.quantidade != null ? Number(i.quantidade) : null,
      unidade_medida: i.unidade_medida,
      valor_unitario_estimado:
        i.valor_unitario_estimado != null ? Number(i.valor_unitario_estimado) : null,
      valor_total_estimado:
        i.valor_total_estimado != null ? Number(i.valor_total_estimado) : null,
      situacao: i.situacao,
      codigo_catalogo: i.codigo_catalogo,
      catalogo_tipo: i.catalogo_tipo,
      ncm_nbs: i.ncm_nbs,
      parsed_facets: (i.parsed_facets ?? null) as import('../pncp/parse-pncp-facets.js').PncpParsedFacets | null,
      catalog_match_method: (i.catalog_match_method ?? null) as import('../pncp/parse-pncp-facets.js').CatalogMatchMethod | null,
      criterio_julgamento: i.criterio_julgamento,
      beneficio_me_epp: i.beneficio_me_epp,
      raw_json: i.raw_json,
    })),
    enrichment,
  });

  return detail;
}
