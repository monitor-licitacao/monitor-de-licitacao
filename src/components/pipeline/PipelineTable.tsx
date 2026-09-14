import React from 'react';
import { Archive, ExternalLink, Trash2 } from 'lucide-react';
import type { PipelineItem } from '../../types/pipeline';
import {
  PIPELINE_COLUMN_META,
  COLUMN_COLORS,
  displayPipelineColumn,
  formatPipelineCurrency,
  formatPipelineDate,
  shortPncpCode,
} from '../../types/pipeline';

interface PipelineTableProps {
  items: PipelineItem[];
  onArchive: (item: PipelineItem) => void;
  onRemove: (item: PipelineItem) => void;
  onOpenContratacao?: (contratacaoId: string) => void;
}

export const PipelineTable: React.FC<PipelineTableProps> = ({
  items,
  onArchive,
  onRemove,
  onOpenContratacao,
}) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Código</th>
          <th className="px-4 py-3">Órgão</th>
          <th className="px-4 py-3">Objeto</th>
          <th className="px-4 py-3">Portal · UF</th>
          <th className="px-4 py-3 text-right">Valor</th>
          <th className="px-4 py-3">Encerramento</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3" aria-label="Ações" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const col = displayPipelineColumn(item);
          const meta = PIPELINE_COLUMN_META.find((c) => c.key === col);
          const accent = COLUMN_COLORS[meta?.semantic ?? 'neutral'];
          return (
            <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-mono text-xs">{shortPncpCode(item.numero_controle_pncp)}</td>
              <td className="px-4 py-3 max-w-[180px] truncate">{item.orgao_razao_social ?? '—'}</td>
              <td className="px-4 py-3 max-w-[220px] truncate">{item.objeto_compra ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {item.portal}{item.uf_sigla ? ` · ${item.uf_sigla}` : ''}
              </td>
              <td className="px-4 py-3 text-right font-medium">{formatPipelineCurrency(item.valor_total_estimado)}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{formatPipelineDate(item.data_encerramento_proposta)}</td>
              <td className="px-4 py-3">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  {meta?.label ?? item.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {item.contratacao_id && onOpenContratacao ? (
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      title="Ver contratação"
                      onClick={() => onOpenContratacao(item.contratacao_id!)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                    title={item.arquivada ? 'Restaurar' : 'Arquivar'}
                    onClick={() => onArchive(item)}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                    title="Remover"
                    onClick={() => onRemove(item)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
