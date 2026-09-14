/**
 * Política de enriquecimento Compras.gov pós-ingest PNCP (issue #79 / Fase C).
 * Regra: PNCP-first — nunca substituir itens PNCP por CG Dados Abertos.
 */

export type EnrichmentDecision =
  | 'PNCP_SUFFICIENT'
  | 'CG_METADATA_ONLY'
  | 'CG_CATALOG_LOOKUP'
  | 'CG_PGC_PLANEJAMENTO'
  | 'LINK_COMPRASNET_ONLY';

export type EnrichmentItemSignal = {
  codigoCatalogo?: number | null;
  valorUnitarioEstimado?: number | null;
  valorTotalEstimado?: number | null;
  orcamentoSigiloso?: boolean | null;
};

export type EnrichmentInput = {
  mode: 'contratacao' | 'pgc';
  pncpItemCount: number;
  items: EnrichmentItemSignal[];
  /** PNCP: 1 = compra sem sigilo */
  orcamentoSigilosoCodigo?: number | null;
  linkSistemaOrigem?: string | null;
};

export type EnrichmentPlan = {
  decisions: EnrichmentDecision[];
  /** Sempre buscar CG 1.1 (idCompra, totais) — nunca itens CG para substituir PNCP */
  fetchCgMetadata: boolean;
  fetchCgItems: boolean;
  fetchCatalog: boolean;
  catalogCodigos: number[];
  enrichmentPartial: boolean;
};

export function isOrcamentoSigiloso(input: EnrichmentInput): boolean {
  if (input.orcamentoSigilosoCodigo != null && input.orcamentoSigilosoCodigo !== 1) {
    return true;
  }
  if (input.items.length === 0) return false;
  return input.items.every((i) => i.orcamentoSigiloso === true);
}

export function isPncpSufficient(input: EnrichmentInput): boolean {
  if (input.pncpItemCount === 0) return false;
  const withValues = input.items.filter(
    (i) =>
      (i.valorUnitarioEstimado != null && i.valorUnitarioEstimado > 0) ||
      (i.valorTotalEstimado != null && i.valorTotalEstimado > 0),
  );
  return withValues.length === input.pncpItemCount && !isOrcamentoSigiloso(input);
}

export function collectCatalogCodigos(items: EnrichmentItemSignal[]): number[] {
  const set = new Set<number>();
  for (const item of items) {
    if (item.codigoCatalogo != null && item.codigoCatalogo > 0) {
      set.add(item.codigoCatalogo);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function planEnrichment(input: EnrichmentInput): EnrichmentPlan {
  if (input.mode === 'pgc') {
    return {
      decisions: ['CG_PGC_PLANEJAMENTO'],
      fetchCgMetadata: false,
      fetchCgItems: false,
      fetchCatalog: false,
      catalogCodigos: [],
      enrichmentPartial: false,
    };
  }

  const decisions: EnrichmentDecision[] = [];
  const sigiloso = isOrcamentoSigiloso(input);
  const pncpSufficient = isPncpSufficient(input);
  const catalogCodigos = collectCatalogCodigos(input.items);

  if (pncpSufficient) {
    decisions.push('PNCP_SUFFICIENT');
  }
  if (sigiloso || (input.linkSistemaOrigem && input.pncpItemCount > 0 && !pncpSufficient)) {
    decisions.push('LINK_COMPRASNET_ONLY');
  }

  decisions.push('CG_METADATA_ONLY');

  if (catalogCodigos.length > 0) {
    decisions.push('CG_CATALOG_LOOKUP');
  }

  return {
    decisions,
    fetchCgMetadata: true,
    /** Proibido substituir itens PNCP (Passex 17/17) */
    fetchCgItems: false,
    fetchCatalog: catalogCodigos.length > 0,
    catalogCodigos,
    enrichmentPartial: sigiloso || input.pncpItemCount === 0 || !pncpSufficient,
  };
}
