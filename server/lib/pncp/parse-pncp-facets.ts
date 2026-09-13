/**
 * Parser de atributos estruturados em descrições PNCP (Tier 0).
 * Ex.: "Aparelho ... tipo: graviton, material: aço, aplicação: ..."
 */
export type PncpParsedFacets = {
  base_class?: string;
  tipo?: string;
  material?: string;
  aplicacao?: string;
  caracteristicas_adicionais?: Record<string, string>;
  nome_comercial?: string | null;
};

const FACET_MARKERS = [
  { field: 'tipo' as const, pattern: /\btipo\s*:/i },
  { field: 'material' as const, pattern: /\bmaterial\s*:/i },
  { field: 'aplicacao' as const, pattern: /\baplica[cç][aã]o\s*:/i },
  { field: 'caracteristicas' as const, pattern: /\bcaracter[ií]sticas adicionais\s*:/i },
];

function splitBeforeQuote(descricao: string): { beforeQuote: string; nomeComercial: string | null } {
  const trimmed = descricao.trim();
  const quoteIdx = trimmed.indexOf('"');
  if (quoteIdx < 0) {
    return { beforeQuote: trimmed, nomeComercial: null };
  }
  const beforeQuote = trimmed.slice(0, quoteIdx).trim().replace(/,\s*$/, '');
  const afterQuote = trimmed.slice(quoteIdx + 1);
  const endQuote = afterQuote.indexOf('"');
  const nomeComercial = (endQuote >= 0 ? afterQuote.slice(0, endQuote) : afterQuote)
    .split('\n')[0]
    ?.trim() || null;
  return { beforeQuote, nomeComercial };
}

function extractFacetValues(facetSegment: string): {
  tipo?: string;
  material?: string;
  aplicacao?: string;
  caracteristicasRaw?: string;
} {
  const hits: { field: string; index: number; labelLen: number }[] = [];
  for (const marker of FACET_MARKERS) {
    const match = marker.pattern.exec(facetSegment);
    if (match?.index != null) {
      hits.push({ field: marker.field, index: match.index, labelLen: match[0].length });
    }
  }
  hits.sort((a, b) => a.index - b.index);

  const out: {
    tipo?: string;
    material?: string;
    aplicacao?: string;
    caracteristicasRaw?: string;
  } = {};

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const start = hit.index + hit.labelLen;
    const end = i + 1 < hits.length ? hits[i + 1]!.index : facetSegment.length;
    const value = facetSegment.slice(start, end).trim().replace(/,\s*$/, '');
    if (hit.field === 'tipo') out.tipo = value;
    else if (hit.field === 'material') out.material = value;
    else if (hit.field === 'aplicacao') out.aplicacao = value;
    else if (hit.field === 'caracteristicas') out.caracteristicasRaw = value;
  }

  return out;
}

/** Extrai facets PNCP de uma descrição de item. */
export function parsePncpFacets(descricao: string): PncpParsedFacets {
  const { beforeQuote, nomeComercial } = splitBeforeQuote(descricao);
  const tipoIdx = beforeQuote.search(/\btipo\s*:/i);

  let baseClass = beforeQuote;
  let facetSegment = beforeQuote;

  if (tipoIdx >= 0) {
    baseClass = beforeQuote.slice(0, tipoIdx).trim().replace(/,\s*$/, '');
    facetSegment = beforeQuote.slice(tipoIdx);
  }

  const extracted = extractFacetValues(facetSegment);
  const caracteristicas_adicionais: Record<string, string> = {};
  if (extracted.caracteristicasRaw) {
    for (const chunk of extracted.caracteristicasRaw.split(/,\s*/)) {
      const m = /^([^:]+):\s*(.+)$/.exec(chunk.trim());
      if (m) caracteristicas_adicionais[m[1]!.trim()] = m[2]!.trim();
      else if (chunk.trim()) caracteristicas_adicionais['descricao'] = chunk.trim();
    }
  }

  const result: PncpParsedFacets = {};
  if (baseClass) result.base_class = baseClass;
  if (extracted.tipo) result.tipo = extracted.tipo;
  if (extracted.material) result.material = extracted.material;
  if (extracted.aplicacao) result.aplicacao = extracted.aplicacao;
  if (Object.keys(caracteristicas_adicionais).length > 0) {
    result.caracteristicas_adicionais = caracteristicas_adicionais;
  }
  if (nomeComercial) result.nome_comercial = nomeComercial;

  return result;
}

export type CatalogMatchMethod = 'PNCP_DIRECT' | 'PNCP_FACET_ONLY' | 'NCM_HINT';

export function resolveCatalogMatchMethod(input: {
  catalogoCodigoItem?: number | null;
  ncmNbsCodigo?: string | null;
  facets: PncpParsedFacets;
}): CatalogMatchMethod | null {
  if (input.catalogoCodigoItem != null && input.catalogoCodigoItem > 0) {
    return 'PNCP_DIRECT';
  }
  const ncm = input.ncmNbsCodigo?.replace(/\D/g, '') ?? '';
  if (ncm.length >= 8) return 'NCM_HINT';
  if (input.facets.tipo || input.facets.base_class) return 'PNCP_FACET_ONLY';
  return null;
}
