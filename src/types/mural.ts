export type StatusFamily =
  | 'ProcessoDeContratacao'
  | 'ProcessosPresenciais'
  | 'CotacaoDeOrcamento'
  | 'PregaoEletronico'
  | 'CompraDireta';

export const STATUS_FAMILIES: StatusFamily[] = [
  'ProcessoDeContratacao',
  'ProcessosPresenciais',
  'CotacaoDeOrcamento',
  'PregaoEletronico',
  'CompraDireta'
];

export const STATUS_FAMILY_LABELS: Record<StatusFamily, string> = {
  ProcessoDeContratacao: 'Processo de Contratação',
  ProcessosPresenciais: 'Processos Presenciais',
  CotacaoDeOrcamento: 'Cotação de Orçamento',
  PregaoEletronico: 'Pregão Eletrônico',
  CompraDireta: 'Compra Direta'
};

export interface NormalizedStatus {
  code: string;
  label: string;
  family: string;
  is_valid: boolean;
}

export interface MuralCardMVP {
  codigo: string;
  numero_processo: string;
  unidade: string;
  objeto_curto: string;
  objeto_completo?: string;
  modalidade: string;
  datas: {
    inicio_propostas: string | null;
    termino_propostas: string | null;
    inicio_inscricoes?: string | null;
  };
  status_normalizado: NormalizedStatus;
  link_canonico: string;
  fonte_confirmada: boolean;
}

export interface MuralProcessItemRanking {
  posicao: number;
  empresa: string;
  cnpj: string;
  valor: number;
  data_proposta?: string;
}

export interface MuralProcessItem {
  numero_item: number;
  descricao: string;
  marca?: string;
  quantidade: number;
  unidade: string;
  valor_unitario?: number | null;
  valor_total?: number | null;
  situacao: string;
  ranking?: MuralProcessItemRanking[];
}

export interface MuralProcessAnexo {
  id: string;
  nome: string;
  tipo: string;
  grupo: 'Processo' | 'Proposta' | 'Habilitação' | string;
  data_publicacao: string;
  tamanho?: string;
  url_download?: string;
}

export interface MuralProcessHistorico {
  data_hora: string;
  evento: string;
  descricao?: string;
  responsavel?: string;
}

export interface MuralProcessDetailResumo {
  codigo: string;
  numero_processo: string;
  edital: string;
  modalidade: string;
  fase: string;
  situacao: string;
  unidade: string;
  unidade_compradora: string;
  email_contato?: string | null;
  inicio_propostas: string | null;
  termino_propostas: string | null;
  data_homologacao?: string | null;
  objeto: string;
  objeto_curto: string;
  valor_estimado?: number | null;
  total_homologado?: number | null;
  link_canonico: string;
  fonte: string;
  status_normalizado: NormalizedStatus;
}

export interface MuralProcessDetail {
  resumo: MuralProcessDetailResumo;
  itens: MuralProcessItem[];
  anexos: MuralProcessAnexo[];
  historico: MuralProcessHistorico[];
}

export interface StatusCatalogItem {
  id: number;
  family: StatusFamily;
  code: string;
  label: string;
  description?: string | null;
  active: boolean;
  is_custom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StatusFamilyCountInfo {
  total: number;
  active: number;
  expected: number;
}

export interface StatusCatalogCountsResponse {
  totalExpected: number;
  families: Record<StatusFamily, StatusFamilyCountInfo>;
}
