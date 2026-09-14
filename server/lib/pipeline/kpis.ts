import { displayStatus, DISPUTE_STATUSES, isActivePipelineRow } from './status.js';
import type { PipelineItemRow, PipelineKpis } from './types.js';

const SORT_FALLBACK = Number.MAX_SAFE_INTEGER;

export function proposalSortKey(row: Pick<PipelineItemRow, 'data_encerramento_proposta' | 'data_abertura_proposta'>): number {
  const raw = row.data_encerramento_proposta ?? row.data_abertura_proposta;
  if (!raw) return SORT_FALLBACK;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? SORT_FALLBACK : ts;
}

export function sortPipelineRows<T extends Pick<PipelineItemRow, 'data_encerramento_proposta' | 'data_abertura_proposta'>>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => proposalSortKey(a) - proposalSortKey(b));
}

export function filterPipelineRows(
  rows: PipelineItemRow[],
  query: { q?: string; arquivadas?: 'all' | '0' | '1' },
): PipelineItemRow[] {
  const q = query.q?.trim().toLowerCase() ?? '';
  const arquivadasMode = query.arquivadas ?? '0';
  const showArchived = arquivadasMode === '1';
  const includeAllArchiveStates = arquivadasMode === 'all';

  let filtered = rows;
  if (!includeAllArchiveStates) {
    filtered = filtered.filter((row) => row.arquivada === showArchived);
  }

  if (q) {
    filtered = filtered.filter((row) =>
      row.numero_controle_pncp.toLowerCase().includes(q) ||
      (row.orgao_razao_social?.toLowerCase().includes(q) ?? false) ||
      (row.objeto_compra?.toLowerCase().includes(q) ?? false),
    );
  }

  return sortPipelineRows(filtered);
}

export function computePipelineKpis(rows: PipelineItemRow[]): PipelineKpis {
  const ativas = rows.filter(isActivePipelineRow);
  const emDisputa = rows.filter((row) => DISPUTE_STATUSES.includes(row.status));
  const homologadas = rows.filter((row) => row.status === 'HOMOLOGADA' && row.vencedor === true);
  const perdidas = rows.filter((row) => displayStatus(row) === 'PERDIDA');
  const valorPipeline = ativas.reduce(
    (acc, row) => acc + (Number(row.valor_total_estimado) || 0),
    0,
  );

  return {
    total: rows.length,
    ativas: ativas.length,
    emDisputa: emDisputa.length,
    homologadas: homologadas.length,
    perdidas: perdidas.length,
    valorPipeline,
  };
}

export function countArchived(rows: PipelineItemRow[]): number {
  return rows.filter((row) => row.arquivada).length;
}
