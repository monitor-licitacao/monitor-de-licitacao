import React from 'react';
import type { PipelineColumn, PipelineItem } from '../../types/pipeline';
import { COLUMN_COLORS, PIPELINE_COLUMN_META } from '../../types/pipeline';
import { PipelineCard, getColumnForItem } from './PipelineCard';

interface PipelineKanbanProps {
  items: PipelineItem[];
  draggingId: string | null;
  openMenuId: string | null;
  onDragStart: (item: PipelineItem) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (column: PipelineColumn) => (e: React.DragEvent) => void;
  onMenuToggle: (id: string) => void;
  onArchive: (item: PipelineItem) => void;
  onRemove: (item: PipelineItem) => void;
}

export const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  items,
  draggingId,
  openMenuId,
  onDragStart,
  onDragEnd,
  onDrop,
  onMenuToggle,
  onArchive,
  onRemove,
}) => (
  <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
    {PIPELINE_COLUMN_META.map((col) => {
      const colItems = items.filter((item) => getColumnForItem(item) === col.key);
      const accent = COLUMN_COLORS[col.semantic];
      return (
        <div
          key={col.key}
          className="min-w-[240px] max-w-[260px] flex-1 flex flex-col rounded-xl bg-slate-50/80 border border-slate-200"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={onDrop(col.key)}
        >
          <header
            className="px-3 py-2 border-b border-slate-200 flex items-center justify-between"
            style={{ borderTop: `3px solid ${accent}` }}
          >
            <span className="text-xs font-bold text-slate-700">{col.label}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-500 border border-slate-200">
              {colItems.length}
            </span>
          </header>
          <div className="flex-1 p-2 space-y-2">
            {colItems.length === 0 ? (
              <div className="text-center py-8 text-[11px] text-slate-400">Arraste aqui</div>
            ) : (
              colItems.map((item) => (
                <PipelineCard
                  key={item.id}
                  item={item}
                  column={col.key}
                  isDragging={draggingId === item.id}
                  menuOpen={openMenuId === item.id}
                  onMenuToggle={() => onMenuToggle(item.id)}
                  onArchive={() => onArchive(item)}
                  onRemove={() => onRemove(item)}
                  onDragStart={onDragStart(item)}
                  onDragEnd={onDragEnd}
                />
              ))
            )}
          </div>
        </div>
      );
    })}
  </div>
);
