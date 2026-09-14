/**
 * Normaliza itens PNCP + metadados de grupos Compras.gov → shape rico para UI.
 */
import type { CatalogMatchMethod, PncpParsedFacets } from '../pncp/parse-pncp-facets.js';
import sescGruposFixture from './fixtures/sesc-ce-026-grupos.json' with { type: 'json' };

export type { PncpParsedFacets, CatalogMatchMethod } from '../pncp/parse-pncp-facets.js';

export type PrecoMercadoStats = {
  status: 'OK' | 'INSUFICIENTE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  join_level: 'CATMAT' | 'CATSER' | 'PDM' | 'NCM' | null;
  n: number;
  mediana: number | null;
  p25: number | null;
  p75: number | null;
  periodo_meses: number;
  label: string | null;
};

export type ContratacaoItemRico = {
  numero_item: number;
  descricao_resumida: string;
  descricao_detalhada: string;
  nome_comercial: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  orcamento_sigiloso: boolean;
  criterio_julgamento: string | null;
  beneficio_me_epp: string | null;
  situacao: string;
  material_ou_servico: string | null;
  codigo_catalogo: number | null;
  catalogo_tipo: string | null;
  ncm_nbs: string | null;
  tipo_catalogo: string | null;
  exigencia_conteudo_nacional: boolean | null;
  margem_preferencia: boolean | null;
  catalogo_hint: string | null;
  parsed_facets: PncpParsedFacets | null;
  catalog_match_method: CatalogMatchMethod | null;
  preco_mercado: PrecoMercadoStats | null;
};

export type ContratacaoGrupoMeta = {
  identificador: string;
  descricao: string;
  item_numeros: number[];
  valor_estimado_total: number | null;
  orcamento_sigiloso: boolean;
  tratamento_me_epp: string | null;
  motivo_anulacao: string | null;
  situacao_label: string | null;
};

export type ContratacaoGrupo = ContratacaoGrupoMeta & {
  itens: ContratacaoItemRico[];
};

type GruposFixture = {
  numeroControlePncp: string;
  grupos: Array<{
    identificador: string;
    descricao: string;
    itemNumeros: number[];
    valorEstimadoTotal?: number;
    possuiOrcamentoSigiloso?: boolean;
    tratamentoMeEpp?: string;
    motivoAnulacao?: string;
    situacaoLabel?: string;
  }>;
};

const GRUPOS_FIXTURES: GruposFixture[] = [sescGruposFixture as GruposFixture];

export function parseItemDescricao(descricao: string): {
  descricaoResumida: string;
  descricaoDetalhada: string;
  nomeComercial: string | null;
  tipoCatalogo: string | null;
} {
  const trimmed = descricao.trim();
  const quoteIdx = trimmed.indexOf('"');
  let beforeQuote = trimmed;
  let nomeComercial: string | null = null;

  if (quoteIdx >= 0) {
    beforeQuote = trimmed.slice(0, quoteIdx).trim().replace(/,\s*$/, '');
    const afterQuote = trimmed.slice(quoteIdx + 1);
    const endQuote = afterQuote.indexOf('"');
    nomeComercial = (endQuote >= 0 ? afterQuote.slice(0, endQuote) : afterQuote)
      .split('\n')[0]
      ?.trim() || null;
  }

  const tipoMatch = /tipo:\s*([^,]+)/i.exec(beforeQuote);
  const tipoCatalogo = tipoMatch?.[1]?.trim() ?? null;

  const descricaoResumida =
    beforeQuote.length > 120 ? `${beforeQuote.slice(0, 117)}…` : beforeQuote;

  return {
    descricaoResumida,
    descricaoDetalhada: trimmed,
    nomeComercial,
    tipoCatalogo,
  };
}

export function buildCatalogHint(tipoCatalogo: string | null, descricaoResumida: string): string | null {
  if (tipoCatalogo) {
    return `tipo: ${tipoCatalogo}`;
  }
  const base = descricaoResumida.split(' tipo:')[0]?.trim();
  if (base && base.length > 10) {
    return base.slice(0, 80);
  }
  return null;
}

export function normalizeContratacaoItem(input: {
  numero_item: number;
  descricao: string;
  quantidade: number | null;
  unidade_medida: string | null;
  valor_unitario_estimado: number | null;
  valor_total_estimado: number | null;
  situacao: string | null;
  codigo_catalogo: string | number | null;
  catalogo_tipo: string | null;
  criterio_julgamento: string | null;
  beneficio_me_epp: string | null;
  ncm_nbs?: string | null;
  parsed_facets?: PncpParsedFacets | null;
  catalog_match_method?: CatalogMatchMethod | null;
  raw_json: Record<string, unknown> | null;
}): ContratacaoItemRico {
  const raw = input.raw_json ?? {};
  const parsed = parseItemDescricao(input.descricao);
  const orcamentoSigiloso = raw.orcamentoSigiloso === true;
  const codigoCatalogo =
    input.codigo_catalogo != null
      ? Number.parseInt(String(input.codigo_catalogo), 10)
      : raw.catalogoCodigoItem != null
        ? Number(raw.catalogoCodigoItem)
        : null;

  const storedFacets = input.parsed_facets ?? null;
  const tipoCatalogo = storedFacets?.tipo ?? parsed.tipoCatalogo;
  const nomeComercial = storedFacets?.nome_comercial ?? parsed.nomeComercial;
  const catalogoHint = codigoCatalogo
    ? `CATMAT ${codigoCatalogo}`
    : tipoCatalogo
      ? `tipo: ${tipoCatalogo}`
      : storedFacets?.base_class
        ? storedFacets.base_class.slice(0, 80)
        : buildCatalogHint(parsed.tipoCatalogo, parsed.descricaoResumida);

  return {
    numero_item: input.numero_item,
    descricao_resumida: parsed.descricaoResumida,
    descricao_detalhada: parsed.descricaoDetalhada,
    nome_comercial: nomeComercial,
    quantidade: input.quantidade ?? 0,
    unidade: input.unidade_medida?.trim() || '—',
    valor_unitario: input.valor_unitario_estimado,
    valor_total: input.valor_total_estimado,
    orcamento_sigiloso: orcamentoSigiloso,
    criterio_julgamento:
      input.criterio_julgamento ??
      (typeof raw.criterioJulgamentoNome === 'string' ? raw.criterioJulgamentoNome : null),
    beneficio_me_epp:
      input.beneficio_me_epp ??
      (typeof raw.tipoBeneficioNome === 'string' ? raw.tipoBeneficioNome : null),
    situacao:
      input.situacao ??
      (typeof raw.situacaoCompraItemNome === 'string' ? raw.situacaoCompraItemNome : '—'),
    material_ou_servico:
      typeof raw.materialOuServicoNome === 'string'
        ? raw.materialOuServicoNome
        : typeof raw.materialOuServico === 'string'
          ? raw.materialOuServico
          : null,
    codigo_catalogo: Number.isFinite(codigoCatalogo) ? codigoCatalogo : null,
    catalogo_tipo: input.catalogo_tipo ?? (typeof raw.catalogo === 'string' ? raw.catalogo : null),
    tipo_catalogo: tipoCatalogo,
    exigencia_conteudo_nacional:
      typeof raw.exigenciaConteudoNacional === 'boolean' ? raw.exigenciaConteudoNacional : null,
    margem_preferencia:
      typeof raw.aplicabilidadeMargemPreferenciaNormal === 'boolean'
        ? raw.aplicabilidadeMargemPreferenciaNormal
        : null,
    catalogo_hint: catalogoHint,
    parsed_facets: storedFacets,
    catalog_match_method: input.catalog_match_method ?? null,
    ncm_nbs:
      input.ncm_nbs?.trim() ||
      (typeof raw.ncmNbsCodigo === 'string' ? raw.ncmNbsCodigo.trim() : null) ||
      null,
    preco_mercado: null,
  };
}

export type ContratacaoItensLista = {
  grupos: ContratacaoGrupo[];
  itens_avulsos: ContratacaoItemRico[];
};

function loadGruposMeta(numeroControlePncp: string): ContratacaoGrupoMeta[] | null {
  const key = numeroControlePncp.trim();
  const fixture = GRUPOS_FIXTURES.find((f) => f.numeroControlePncp === key);
  if (!fixture) return null;

  return fixture.grupos.map((g) => ({
    identificador: g.identificador,
    descricao: g.descricao,
    item_numeros: g.itemNumeros,
    valor_estimado_total: g.valorEstimadoTotal ?? null,
    orcamento_sigiloso: g.possuiOrcamentoSigiloso ?? false,
    tratamento_me_epp: g.tratamentoMeEpp ?? null,
    motivo_anulacao: g.motivoAnulacao ?? null,
    situacao_label: g.situacaoLabel ?? null,
  }));
}

function buildFallbackGrupo(itens: ContratacaoItemRico[]): ContratacaoGrupo[] {
  return [
    {
      identificador: 'ALL',
      descricao: 'Todos os itens',
      item_numeros: itens.map((i) => i.numero_item),
      valor_estimado_total: null,
      orcamento_sigiloso: itens.some((i) => i.orcamento_sigiloso),
      tratamento_me_epp: itens[0]?.beneficio_me_epp ?? null,
      motivo_anulacao: null,
      situacao_label: itens[0]?.situacao ?? null,
      itens,
    },
  ];
}

export function buildGruposWithItens(
  numeroControlePncp: string,
  itens: ContratacaoItemRico[],
): ContratacaoItensLista {
  const meta = loadGruposMeta(numeroControlePncp);
  if (!meta) {
    return { grupos: buildFallbackGrupo(itens), itens_avulsos: [] };
  }

  const byNumero = new Map(itens.map((i) => [i.numero_item, i]));
  const assigned = new Set<number>();

  const grupos = meta.map((g) => {
    for (const n of g.item_numeros) assigned.add(n);
    return {
      ...g,
      itens: g.item_numeros
        .map((n) => byNumero.get(n))
        .filter((i): i is ContratacaoItemRico => i != null),
    };
  });

  const itens_avulsos = itens.filter((i) => !assigned.has(i.numero_item));
  return { grupos, itens_avulsos };
}
