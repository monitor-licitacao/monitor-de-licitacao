export type PipelinePersistedStatus =
  | 'SELECIONADA'
  | 'ANALISE'
  | 'RECEBENDO_PROPOSTA'
  | 'FASE_LANCE'
  | 'SESSAO_PUBLICA'
  | 'RECURSO'
  | 'HOMOLOGADA'
  | 'CANCELADA';

export type PipelineColumn = PipelinePersistedStatus | 'PERDIDA';

export type PipelineItem = {
  id: string;
  contratacao_id: string | null;
  numero_controle_pncp: string;
  portal: string;
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
};

export type PipelineKpis = {
  total: number;
  ativas: number;
  emDisputa: number;
  homologadas: number;
  perdidas: number;
  valorPipeline: number;
};

export type PipelineViewMode = 'kanban' | 'list' | 'table';

export const PIPELINE_COLUMN_META: {
  key: PipelineColumn;
  label: string;
  semantic: 'neutral' | 'brand' | 'warning' | 'danger' | 'success' | 'info';
}[] = [
  { key: 'SELECIONADA', label: 'Selecionada', semantic: 'info' },
  { key: 'ANALISE', label: 'Análise', semantic: 'brand' },
  { key: 'RECEBENDO_PROPOSTA', label: 'Proposta', semantic: 'warning' },
  { key: 'FASE_LANCE', label: 'Lance', semantic: 'danger' },
  { key: 'SESSAO_PUBLICA', label: 'Sessão', semantic: 'info' },
  { key: 'RECURSO', label: 'Recurso', semantic: 'warning' },
  { key: 'HOMOLOGADA', label: 'Homologada', semantic: 'success' },
  { key: 'PERDIDA', label: 'Perdida', semantic: 'danger' },
  { key: 'CANCELADA', label: 'Cancelada', semantic: 'neutral' },
];

export const COLUMN_COLORS: Record<string, string> = {
  neutral: '#94a3b8',
  brand: '#2968ed',
  warning: '#b45309',
  danger: '#b91c1c',
  success: '#047857',
  info: '#0e7490',
};

export function displayPipelineColumn(item: Pick<PipelineItem, 'status' | 'vencedor'>): PipelineColumn {
  if (item.status === 'HOMOLOGADA' && !item.vencedor) return 'PERDIDA';
  return item.status;
}

export function shortPncpCode(numero: string | null | undefined): string {
  if (!numero) return '—';
  const segment = numero.split('-')[2]?.split('/')[0];
  return segment ?? numero.substring(0, 14);
}

export function formatPipelineCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
}

export function formatPipelineDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function maskPncpInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 25);
  if (digits.length <= 14) return digits;
  let out = `${digits.slice(0, 14)}-${digits.slice(14, 15)}`;
  if (digits.length > 15) out += `-${digits.slice(15, 21)}`;
  if (digits.length > 21) out += `/${digits.slice(21, 25)}`;
  return out;
}
