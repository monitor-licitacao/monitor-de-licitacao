export const PERSISTED_PIPELINE_STATUSES = [
  'SELECIONADA',
  'ANALISE',
  'RECEBENDO_PROPOSTA',
  'FASE_LANCE',
  'SESSAO_PUBLICA',
  'RECURSO',
  'HOMOLOGADA',
  'CANCELADA',
] as const;

export type PipelinePersistedStatus = (typeof PERSISTED_PIPELINE_STATUSES)[number];

export type PipelineColumn = PipelinePersistedStatus | 'PERDIDA';

export type PipelinePortal = 'PNCP' | 'COMPRASNET' | 'BEC' | 'BLL' | 'LICITACOES_E' | 'COMPRAS_BR';

export type PipelineItemRow = {
  id: string;
  tenant_id: number;
  contratacao_id: string | null;
  numero_controle_pncp: string;
  portal: PipelinePortal;
  orgao_cnpj: string;
  orgao_razao_social: string | null;
  objeto_compra: string | null;
  modalidade_nome: string | null;
  valor_total_estimado: number | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  uf_sigla: string | null;
  status: PipelinePersistedStatus;
  vencedor: boolean;
  arquivada: boolean;
  source_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PipelineSnapshotInput = {
  contratacao_id?: string | null;
  numero_controle_pncp: string;
  portal?: PipelinePortal;
  orgao_cnpj: string;
  orgao_razao_social?: string | null;
  objeto_compra?: string | null;
  modalidade_nome?: string | null;
  valor_total_estimado?: number | null;
  data_abertura_proposta?: string | null;
  data_encerramento_proposta?: string | null;
  uf_sigla?: string | null;
  source_record_id?: string | null;
};

export type PipelineKpis = {
  total: number;
  ativas: number;
  emDisputa: number;
  homologadas: number;
  perdidas: number;
  valorPipeline: number;
};

export type PipelineListQuery = {
  limit?: number;
  arquivadas?: 'all' | '0' | '1';
  q?: string;
};

export type PipelineStatusUpdate = {
  status: PipelinePersistedStatus;
  vencedor?: boolean;
};

export type ContratacaoSnapshotSource = {
  id: string;
  numero_controle_pncp: string;
  cnpj_orgao: string;
  orgao_razao_social?: string | null;
  objeto?: string | null;
  modalidade_nome?: string | null;
  valor_estimado?: string | number | null;
  data_inicio_propostas?: Date | string | null;
  data_fim_propostas?: Date | string | null;
  uf?: string | null;
  source_record_id?: string | null;
};
