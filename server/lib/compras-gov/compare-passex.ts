/** Alinha item Compras.gov fase-externa (HAR) com item PNCP para golden Passex 19732 */

export type PncpItemGolden = {
  numeroItem: number;
  descricao: string;
  valorUnitarioEstimado?: number;
  valorTotal?: number;
  quantidade?: number;
  orcamentoSigiloso?: boolean;
  ncmNbsCodigo?: string | null;
};

export type ComprasNetItemGolden = {
  numero: number;
  descricao: string;
  valorEstimadoUnitario?: number;
  valorEstimadoTotal?: number;
  quantidadeSolicitada?: number;
  possuiOrcamentoSigiloso?: boolean;
};

export function shortTitle(descricao: string): string {
  return descricao.split(/ acessórios:| capacidade:| características| aplicação:/i)[0].trim();
}

export function alignItemByNumero(
  pncp: PncpItemGolden,
  comprasNet: ComprasNetItemGolden | undefined,
): {
  numeroItem: number;
  valorUnitMatch: boolean;
  valorTotalMatch: boolean;
  pncpDescricaoLonger: boolean;
  comprasNetDescricaoCurta: string | null;
  pncpHasNcm: boolean;
} {
  const valorUnitMatch =
    comprasNet?.valorEstimadoUnitario != null &&
    pncp.valorUnitarioEstimado != null &&
    Math.abs(comprasNet.valorEstimadoUnitario - pncp.valorUnitarioEstimado) < 0.01;

  const valorTotalMatch =
    comprasNet?.valorEstimadoTotal != null &&
    pncp.valorTotal != null &&
    Math.abs(comprasNet.valorEstimadoTotal - pncp.valorTotal) < 0.01;

  const cnShort = comprasNet ? shortTitle(comprasNet.descricao) : null;
  const pncpDescricaoLonger = (pncp.descricao?.length ?? 0) > (comprasNet?.descricao?.length ?? 0) + 10;

  return {
    numeroItem: pncp.numeroItem,
    valorUnitMatch,
    valorTotalMatch,
    pncpDescricaoLonger,
    comprasNetDescricaoCurta: cnShort,
    pncpHasNcm: Boolean(pncp.ncmNbsCodigo),
  };
}

export const PASSEX_GOLDEN = {
  numeroControlePncp: '00394452000103-1-019732/2026',
  idCompra: '16036005002242026',
  cnpjOrgao: '00394452000103',
  ano: 2026,
  sequencial: 19732,
  totalItens: 17,
  valorTotalEstimado: 221916.82,
  pncpUrl: 'https://pncp.gov.br/app/editais/00394452000103/2026/19732',
  comprasGovUrl:
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=16036005002242026',
} as const;
