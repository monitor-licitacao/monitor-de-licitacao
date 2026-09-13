/** PNCP Classe A — detalhe da compra */
export type PncpCompraDto = {
  numeroControlePNCP?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  numeroCompra?: string;
  processo?: string;
  objetoCompra?: string;
  informacaoComplementar?: string | null;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  orcamentoSigilosoCodigo?: number;
  orcamentoSigilosoDescricao?: string;
  modalidadeId?: number;
  modalidadeNome?: string;
  /** Evidência no payload PNCP (SESC CE 026/2026). Persistido + FK resolvida na #82. */
  tipoInstrumentoConvocatorioCodigo?: number;
  tipoInstrumentoConvocatorioNome?: string;
  amparoLegal?: {
    codigo?: number;
    nome?: string;
    descricao?: string;
  };
  modoDisputaId?: number;
  modoDisputaNome?: string;
  srp?: boolean;
  situacaoCompraId?: number;
  situacaoCompraNome?: string;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  linkSistemaOrigem?: string | null;
  linkProcessoEletronico?: string | null;
  orgaoEntidade?: {
    cnpj?: string;
    razaoSocial?: string;
  };
  unidadeOrgao?: {
    codigoUnidade?: string;
    nomeUnidade?: string;
    ufSigla?: string;
    municipioNome?: string;
  };
};

/** PNCP Classe B — item da compra */
export type PncpItemDto = {
  numeroItem: number;
  descricao: string;
  materialOuServico?: string;
  materialOuServicoNome?: string;
  valorUnitarioEstimado?: number | null;
  valorTotal?: number | null;
  quantidade?: number | null;
  unidadeMedida?: string | null;
  orcamentoSigiloso?: boolean;
  criterioJulgamentoNome?: string | null;
  tipoBeneficioNome?: string | null;
  situacaoCompraItemNome?: string | null;
  catalogoCodigoItem?: number | null;
  catalogo?: string | null;
  ncmNbsCodigo?: string | null;
  temResultado?: boolean;
};

/** PNCP — resultado homologado por item */
export type PncpItemResultadoDto = {
  numeroItem?: number;
  sequencialResultado?: number;
  niFornecedor?: string;
  nomeRazaoSocialFornecedor?: string;
  tipoPessoa?: string;
  valorUnitarioHomologado?: number | null;
  valorTotalHomologado?: number | null;
  quantidadeHomologada?: number | null;
  percentualDesconto?: number | null;
  dataResultado?: string | null;
  dataCancelamento?: string | null;
  situacaoCompraItemResultadoNome?: string | null;
  numeroControlePNCPCompra?: string;
};

export type IngestResultadosResult = {
  ok: boolean;
  numeroControlePncp?: string;
  resultadosIngeridos?: number;
  priceObservations?: number;
  skipped?: number;
  error?: string;
};

/** Hit do índice de publicação PNCP (/contratacoes/publicacao) */
export type PncpSearchHit = {
  numeroControlePNCP?: string;
  anoCompra?: number;
  anoContratacao?: number;
  sequencialCompra?: number;
  numeroContratacao?: number;
  numeroCompra?: string;
  processo?: string;
  objetoCompra?: string;
  objeto?: string;
  valorTotalEstimado?: number | null;
  linkSistemaOrigem?: string | null;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  orgaoEntidade?: {
    cnpj?: string;
    razaoSocial?: string;
    uf?: string;
    municipio?: string;
  };
  unidadeOrgao?: {
    ufSigla?: string;
    municipioNome?: string;
  };
};

export type PncpPublicationPage = {
  hits: PncpSearchHit[];
  totalRegistros: number;
  totalPaginas: number;
  pagina: number;
};

export type IngestContratacaoResult = {
  ok: boolean;
  contratacaoId?: string;
  numeroControlePncp?: string;
  itemCount?: number;
  error?: string;
};

export type DiscoverQueryResult = {
  ok: boolean;
  hitsFound: number;
  ingested: string[];
  enrichJobIds: string[];
  skipped: string[];
  errors: string[];
};
