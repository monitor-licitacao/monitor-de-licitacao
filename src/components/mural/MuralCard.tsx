import React from 'react';
import { Calendar, Building2, Hash } from 'lucide-react';
import { MuralCardMVP } from '../../types/mural';
import { StatusBadge } from './StatusBadge';
import { HonestField } from './HonestField';
import { CanonicalSourceAction } from './CanonicalSourceAction';
import { formatDateToBR } from '../../utils/muralFormatters';

interface MuralCardProps {
  card: MuralCardMVP;
  onSelect: (codigo: string) => void;
}

export const MuralCard: React.FC<MuralCardProps> = ({ card, onSelect }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(card.codigo);
    }
  };

  const dataAbertura = formatDateToBR(card.datas?.inicio_propostas || card.datas?.inicio_inscricoes);
  const dataTermino = formatDateToBR(card.datas?.termino_propostas);

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Processo ${card.numero_processo || card.codigo}. Clique para ver detalhes.`}
      onClick={() => onSelect(card.codigo)}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col justify-between p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {/* 1. Status (badge catálogo) + Modalidade (texto secundário) */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <StatusBadge status={card.status_normalizado} size="md" />
        <span className="text-xs font-medium text-slate-500 truncate max-w-[50%] text-right">
          <HonestField value={card.modalidade} label="Modalidade" />
        </span>
      </div>

      {/* 2. numero_processo (título forte) */}
      <div className="mb-2">
        <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight line-clamp-1">
          <HonestField
            value={card.numero_processo}
            label="Número do processo"
            fallbackClass="text-slate-400 font-normal italic"
          />
        </h2>
      </div>

      {/* 3. unidade (linha meta) */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <HonestField value={card.unidade} label="Unidade compradora" />
        </span>
      </div>

      {/* 4. objeto curto (2 linhas max, ellipsis + title completo) */}
      <div className="mb-4 flex-1">
        <p
          className="text-xs text-slate-700 leading-relaxed line-clamp-2"
          title={card.objeto_completo || card.objeto_curto || 'Objeto não informado'}
        >
          <HonestField
            value={card.objeto_curto || card.objeto_completo}
            label="Objeto do processo"
            fallbackClass="text-slate-400 italic"
          />
        </p>
      </div>

      {/* 5. datas publicação / abertura (formato dd/mm/aaaa, rótulos explícitos) */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-slate-400">Abertura</span>
          <div className="flex items-center gap-1 mt-0.5 font-medium text-slate-700">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
            <HonestField value={dataAbertura} label="Data de abertura" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-slate-400">Término</span>
          <div className="flex items-center gap-1 mt-0.5 font-medium text-slate-700">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
            <HonestField value={dataTermino} label="Data de término" />
          </div>
        </div>
      </div>

      {/* 6. codigo (mono, secundário) + link canônico (ação única no card: "Abrir fonte") */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
        <div className="flex items-center gap-1 text-slate-500 text-xs font-mono">
          <Hash className="w-3 h-3 text-slate-400" aria-hidden="true" />
          <span className="font-semibold text-slate-700">
            <HonestField value={card.codigo} label="Código do processo" />
          </span>
        </div>

        <CanonicalSourceAction
          url={card.link_canonico}
          fonteConfirmada={card.fonte_confirmada}
          variant="card"
        />
      </div>
    </article>
  );
};
