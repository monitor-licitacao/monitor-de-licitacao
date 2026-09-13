/** Resposta paginada padrão da API Dados Abertos Compras.gov.br */
export type ComprasGovPagedResponse<T> = {
  resultado: T[];
  totalRegistros: number;
  totalPaginas: number;
  paginasRestantes: number;
};

export type ComprasGovContratacao14133Dto = {
  idCompra: string;
  numeroControlePNCP: string;
  anoCompraPncp: number;
  sequencialCompraPncp: number;
  orgaoEntidadeCnpj: string;
  orgaoEntidadeRazaoSocial: string;
  unidadeOrgaoCodigoUnidade: string;
  unidadeOrgaoNomeUnidade: string;
  unidadeOrgaoUfSigla: string;
  unidadeOrgaoMunicipioNome: string;
  numeroCompra: string;
  modalidadeIdPncp: number;
  modalidadeNome: string;
  srp: boolean;
  modoDisputaIdPncp?: number;
  processo: string;
  objetoCompra: string;
  existeResultado: boolean;
  orcamentoSigilosoCodigo?: number;
  orcamentoSigilosoDescricao?: string;
  valorTotalEstimado?: number;
  dataPublicacaoPncp?: string;
  situacaoCompraIdPncp?: number;
  situacaoCompraNomePncp?: string;
  linkSistemaOrigem?: string;
  [key: string]: unknown;
};

export type ComprasGovItemContratacao14133Dto = {
  idCompra: string;
  idCompraItem: string;
  idContratacaoPNCP?: string;
  numeroControlePNCPCompra?: string;
  orgaoEntidadeCnpj: string;
  numeroItemPncp: number;
  numeroGrupo?: number;
  descricaoResumida?: string;
  descricaoDetalhada?: string;
  materialOuServico?: string;
  codigoClasse?: number;
  codigoGrupo?: number;
  codItemCatalogo?: number;
  quantidade?: number;
  valorUnitarioEstimado?: number;
  valorTotal?: number;
  temResultado?: boolean;
  codFornecedor?: string;
  nomeFornecedor?: string;
  quantidadeResultado?: number;
  valorUnitarioResultado?: number;
  valorTotalResultado?: number;
  dataResultado?: string;
  [key: string]: unknown;
};

export type ComprasGovPgcDetalheDto = {
  codigoUasg: string;
  nomeUasg: string;
  orgao: string;
  numeroArtefato: number;
  anoArtefato: number;
  ordemDfd: number;
  descricaoObjetoDfd: string;
  nivelPrioridadeDfd?: number;
  dataPrevistaFormalizacaoDemanda?: string;
  tipoItem: string;
  codigoGrupoMaterial?: number;
  nomeGrupoMaterial?: string;
  codigoClasseMaterial?: number;
  nomeClasseMaterial?: string;
  codigoPdmMaterial?: number;
  nomePdmMaterial?: string;
  codigoItemCatalogo?: string;
  descricaoItemCatalogo?: string;
  quantidadeItem?: number;
  valorUnitarioItem?: number;
  valorTotalItem?: number;
  tituloProjetoCompra?: string;
  [key: string]: unknown;
};

export type ComprasGovCatmatItemDto = {
  codigoItem: number;
  codigoGrupo: number;
  nomeGrupo: string;
  codigoClasse: number;
  nomeClasse: string;
  codigoPdm: number;
  nomePdm: string;
  descricaoItem: string;
  statusItem: boolean;
  codigo_ncm?: string;
  aplica_margem_preferencia?: boolean;
  [key: string]: unknown;
};

export type ComprasGovLookupTipo = 'idCompra' | 'numeroControlePNCPCompra';

export type FieldComparison = {
  field: string;
  pncp: unknown;
  comprasGov: unknown;
  status: 'match' | 'mismatch' | 'pncp_only' | 'compras_gov_only';
};

export type ContratacaoCompareReport = {
  numeroControlePncp: string;
  idCompra: string | null;
  comparisons: FieldComparison[];
  comprasGovExtras: string[];
  pncpExtras: string[];
  itemCoverage: {
    pncpItemCount: number;
    comprasGovItemCount: number;
    note?: string;
  };
};
