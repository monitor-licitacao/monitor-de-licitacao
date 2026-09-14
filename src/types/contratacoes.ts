import type {
  MuralProcessAnexo,
  MuralProcessHistorico,
  MuralProcessItem,
  NormalizedStatus,
} from './mural';

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

export type ContratacaoDetailResumo = {
  codigo: string;
  numero_processo: string;
  edital: string;
  modalidade: string;
  fase: string;
  situacao: string;
  unidade: string;
  unidade_compradora: string;
  inicio_propostas: string | null;
  termino_propostas: string | null;
  objeto: string;
  objeto_curto: string;
  valor_estimado: number | null;
  total_homologado: number | null;
  link_canonico: string;
  link_pncp: string;
  link_compras_gov: string | null;
  fonte: string;
  numero_controle_pncp: string;
  status_normalizado: NormalizedStatus;
};

export type ContratacaoEnrichment = {
  contratacao_id: string;
  numeroControlePncp: string;
  idCompra: string | null;
  pncpItemCount: number;
  badge: EnrichmentBadge;
  decisions: string[];
  enrichmentPartial: boolean;
  links: {
    pncp: string;
    comprasGov: string | null;
  };
  catalogItems: Array<{
    codigoItem: number;
    catalogType: string;
    descricaoItem: string | null;
    nomePdm: string | null;
  }>;
  pgcRelated: Array<{
    ordemDfd: number;
    descricaoObjetoDfd: string | null;
    codigoItemCatalogo: number | null;
    ano: number;
  }>;
};

export type PncpParsedFacets = {
  base_class?: string;
  tipo?: string;
  material?: string;
  aplicacao?: string;
  variante?: string;
  caracteristicas_adicionais?: Record<string, string>;
  nome_comercial?: string | null;
};

export type CatalogMatchMethod = 'PNCP_DIRECT' | 'PNCP_FACET_ONLY' | 'NCM_HINT';

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

export type ContratacaoGrupo = {
  identificador: string;
  descricao: string;
  item_numeros: number[];
  valor_estimado_total: number | null;
  orcamento_sigiloso: boolean;
  tratamento_me_epp: string | null;
  motivo_anulacao: string | null;
  situacao_label: string | null;
  itens: ContratacaoItemRico[];
};

/** Shape alinhado ao Mural ProcessDetail + bloco enriquecimento Tier 1 */
export type ContratacaoDetail = {
  resumo: ContratacaoDetailResumo;
  itens: MuralProcessItem[];
  grupos: ContratacaoGrupo[];
  itens_avulsos?: ContratacaoItemRico[];
  anexos: MuralProcessAnexo[];
  historico: MuralProcessHistorico[];
  enriquecimento: ContratacaoEnrichment;
  vigencia_expectativa?: 'preenchida' | 'aguardando_contrato' | 'aguardando_ata' | 'nao_aplicavel';
};
