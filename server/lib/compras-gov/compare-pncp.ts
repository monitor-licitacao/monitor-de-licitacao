import type { ComprasGovContratacao14133Dto, ContratacaoCompareReport, FieldComparison } from './types.js';

/** Shape mínimo do PNCP usado na comparação (Classe A) */
export type PncpCompraCompareInput = {
  numeroControlePNCP?: string;
  orgaoEntidade?: { cnpj?: string; razaoSocial?: string };
  unidadeOrgao?: { codigoUnidade?: string; nomeUnidade?: string; ufSigla?: string; municipioNome?: string };
  numeroCompra?: string;
  modalidadeId?: number;
  modalidadeNome?: string;
  srp?: boolean;
  processo?: string;
  objetoCompra?: string;
  valorTotalEstimado?: number;
  orcamentoSigilosoCodigo?: number;
  orcamentoSigilosoDescricao?: string;
  situacaoCompraNome?: string;
  linkSistemaOrigem?: string;
};

function norm(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v.trim().toUpperCase();
  return v;
}

function compareField(field: string, pncp: unknown, cg: unknown): FieldComparison {
  const pn = norm(pncp);
  const cn = norm(cg);
  if (pn === null && cn === null) return { field, pncp, comprasGov: cg, status: 'match' };
  if (pn === null) return { field, pncp, comprasGov: cg, status: 'compras_gov_only' };
  if (cn === null) return { field, pncp, comprasGov: cg, status: 'pncp_only' };
  return { field, pncp, comprasGov: cg, status: pn === cn ? 'match' : 'mismatch' };
}

export function extractIdCompraFromLink(linkSistemaOrigem: string | null | undefined): string | null {
  if (!linkSistemaOrigem) return null;
  try {
    return new URL(linkSistemaOrigem).searchParams.get('compra');
  } catch {
    return null;
  }
}

export function compareContratacaoPncpVsComprasGov(
  pncp: PncpCompraCompareInput,
  comprasGov: ComprasGovContratacao14133Dto | null,
  itemCounts: { pncp: number; comprasGov: number; note?: string },
): ContratacaoCompareReport {
  const numeroControlePncp = pncp.numeroControlePNCP ?? comprasGov?.numeroControlePNCP ?? '';
  const idCompra = comprasGov?.idCompra ?? extractIdCompraFromLink(pncp.linkSistemaOrigem);

  const comparisons: FieldComparison[] = comprasGov
    ? [
        compareField('numeroControlePNCP', pncp.numeroControlePNCP, comprasGov.numeroControlePNCP),
        compareField('cnpjOrgao', pncp.orgaoEntidade?.cnpj, comprasGov.orgaoEntidadeCnpj),
        compareField('razaoSocial', pncp.orgaoEntidade?.razaoSocial, comprasGov.orgaoEntidadeRazaoSocial),
        compareField('codigoUnidade', pncp.unidadeOrgao?.codigoUnidade, comprasGov.unidadeOrgaoCodigoUnidade),
        compareField('numeroCompra', pncp.numeroCompra, comprasGov.numeroCompra),
        compareField('modalidadeId', pncp.modalidadeId, comprasGov.modalidadeIdPncp),
        compareField('srp', pncp.srp, comprasGov.srp),
        compareField('processo', pncp.processo, comprasGov.processo),
        compareField('objetoCompra', pncp.objetoCompra, comprasGov.objetoCompra),
        compareField('valorTotalEstimado', pncp.valorTotalEstimado, comprasGov.valorTotalEstimado),
        compareField('orcamentoSigilosoCodigo', pncp.orcamentoSigilosoCodigo, comprasGov.orcamentoSigilosoCodigo),
        compareField('situacao', pncp.situacaoCompraNome, comprasGov.situacaoCompraNomePncp),
      ]
    : [];

  const comprasGovExtras = comprasGov
    ? ['idCompra', 'codigoOrgao', 'existeResultado', 'codigoModalidade', 'codigoModoDisputa'].filter(
        (k) => comprasGov[k] !== undefined && comprasGov[k] !== null,
      )
    : [];

  const pncpExtras = ['informacaoComplementar', 'dataAberturaProposta', 'dataEncerramentoProposta'].filter(
    (k) => (pncp as Record<string, unknown>)[k] !== undefined,
  );

  return {
    numeroControlePncp,
    idCompra,
    comparisons,
    comprasGovExtras,
    pncpExtras,
    itemCoverage: {
      pncpItemCount: itemCounts.pncp,
      comprasGovItemCount: itemCounts.comprasGov,
      note: itemCounts.note,
    },
  };
}

/** Campos que Compras.gov entrega e PNCP frequentemente não traz no mesmo nível de detalhe */
export const COMPRAS_GOV_ENRICHMENT_FIELDS = [
  'descricaoDetalhada (item)',
  'codigoGrupo / codigoClasse / codItemCatalogo (item)',
  'temResultado / fornecedor / valorUnitarioResultado (item)',
  'PGC: ordemDfd, descricaoObjetoDfd, dataPrevistaFormalizacaoDemanda',
  'CATMAT: hierarquia grupo→classe→PDM→item + NCM',
  'ARP: saldoAdesao, quantidadeEmpenhada, unidades participantes',
  'Pesquisa de Preços oficial',
] as const;
