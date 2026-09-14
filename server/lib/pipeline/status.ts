import type { PipelineColumn, PipelinePersistedStatus, PipelinePortal } from './types.js';

export const PIPELINE_COLUMNS: {
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

export const DISPUTE_STATUSES: PipelinePersistedStatus[] = [
  'RECEBENDO_PROPOSTA',
  'FASE_LANCE',
  'SESSAO_PUBLICA',
];

export const TERMINAL_DISPLAY_COLUMNS: PipelineColumn[] = ['HOMOLOGADA', 'PERDIDA', 'CANCELADA'];

export const PORTAL_LABELS: Record<PipelinePortal, string> = {
  PNCP: 'PNCP',
  COMPRASNET: 'ComprasNet',
  BEC: 'BEC-SP',
  BLL: 'BLL',
  LICITACOES_E: 'Licitações-e',
  COMPRAS_BR: 'Compras.gov',
};

export function displayStatus(row: {
  status: PipelinePersistedStatus;
  vencedor: boolean;
}): PipelineColumn {
  if (row.status === 'HOMOLOGADA' && !row.vencedor) return 'PERDIDA';
  return row.status;
}

export function mapDragToUpdate(column: PipelineColumn): {
  status: PipelinePersistedStatus;
  vencedor: boolean;
} | null {
  if (column === 'HOMOLOGADA') {
    return { status: 'HOMOLOGADA', vencedor: true };
  }
  if (column === 'PERDIDA') {
    return { status: 'HOMOLOGADA', vencedor: false };
  }
  if (column === 'SELECIONADA' ||
    column === 'ANALISE' ||
    column === 'RECEBENDO_PROPOSTA' ||
    column === 'FASE_LANCE' ||
    column === 'SESSAO_PUBLICA' ||
    column === 'RECURSO' ||
    column === 'CANCELADA') {
    return { status: column, vencedor: false };
  }
  return null;
}

export function isDragNoOp(
  row: { status: PipelinePersistedStatus; vencedor: boolean },
  targetColumn: PipelineColumn,
): boolean {
  return displayStatus(row) === targetColumn;
}

export function isActivePipelineRow(row: {
  status: PipelinePersistedStatus;
  vencedor: boolean;
}): boolean {
  const col = displayStatus(row);
  return col !== 'HOMOLOGADA' && col !== 'PERDIDA' && col !== 'CANCELADA';
}

export function shortPncpCode(numeroControlePncp: string | null | undefined): string {
  if (!numeroControlePncp) return '—';
  const segment = numeroControlePncp.split('-')[2]?.split('/')[0];
  if (segment) return segment;
  return numeroControlePncp.substring(0, 14);
}

export function formatPortalLabel(portal: string | null | undefined): string {
  if (!portal) return '—';
  return PORTAL_LABELS[portal as PipelinePortal] ?? portal;
}

/** Máscara parcial do número de controle PNCP enquanto o usuário digita. */
export function maskNumeroControlePncp(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 25);
  if (digits.length <= 14) return digits;
  let out = `${digits.slice(0, 14)}-${digits.slice(14, 15)}`;
  if (digits.length > 15) out += `-${digits.slice(15, 21)}`;
  if (digits.length > 21) out += `/${digits.slice(21, 25)}`;
  return out;
}
