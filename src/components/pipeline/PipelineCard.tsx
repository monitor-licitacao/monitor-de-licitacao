import React from 'react';
import { Calendar, DollarSign, GripVertical, MoreVertical, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import type { PipelineColumn, PipelineItem } from '../../types/pipeline';
import {
  COLUMN_COLORS,
  PIPELINE_COLUMN_META,
  displayPipelineColumn,
  formatPipelineCurrency,
  formatPipelineDate,
  shortPncpCode,
} from '../../types/pipeline';

interface PipelineCardProps {
  item: PipelineItem;
  column: PipelineColumn;
  isDragging?: boolean;
  menuOpen?: boolean;
  onMenuToggle: () => void;
  onArchive: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export const PipelineCard: React.FC<PipelineCardProps> = ({
  item,
  column,
  isDragging,
  menuOpen,
  onMenuToggle,
  onArchive,
  onRemove,
  onDragStart,
  onDragEnd,
}) => {
  const meta = PIPELINE_COLUMN_META.find((c) => c.key === column);
  const accent = COLUMN_COLORS[meta?.semantic ?? 'neutral'];

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-white p-3 shadow-xs cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-50 ring-2 ring-blue-300' : 'hover:shadow-sm'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <header className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
        <span className="font-mono text-xs font-semibold text-slate-700 flex-1">
          {shortPncpCode(item.numero_controle_pncp)}
        </span>
        <div className="relative">
          <button
            type="button"
            className="p-1 rounded hover:bg-slate-100 text-slate-400"
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            aria-label="Mais ações"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-7 z-20 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-slate-50"
                onClick={onArchive}
              >
                {item.arquivada ? (
                  <ArchiveRestore className="w-3.5 h-3.5" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                {item.arquivada ? 'Restaurar' : 'Arquivar'}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-rose-700 hover:bg-rose-50"
                onClick={onRemove}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <p className="mt-2 text-xs font-medium text-slate-800 line-clamp-2">
        {item.orgao_razao_social?.substring(0, 38) ?? '—'}
        {(item.orgao_razao_social?.length ?? 0) > 38 ? '…' : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatPipelineDate(item.data_encerramento_proposta)}
        </span>
        <span className="inline-flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {formatPipelineCurrency(item.valor_total_estimado)}
        </span>
      </div>
      <footer className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{item.portal}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{item.uf_sigla ?? '—'}</span>
      </footer>
    </article>
  );
};

export function getColumnForItem(item: PipelineItem): PipelineColumn {
  return displayPipelineColumn(item);
}
