import React from 'react';
import { DollarSign, Flame, Trophy } from 'lucide-react';
import type { PipelineKpis as PipelineKpisType } from '../../types/pipeline';
import { formatPipelineCurrency } from '../../types/pipeline';

interface PipelineKpisProps {
  kpis: PipelineKpisType;
}

export const PipelineKpis: React.FC<PipelineKpisProps> = ({ kpis }) => (
  <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    <article className="rounded-xl border border-blue-200 bg-linear-to-br from-blue-50 to-white p-4 shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">No pipeline</span>
      <div className="mt-1 text-2xl font-bold text-slate-900">{kpis.total.toLocaleString('pt-BR')}</div>
      <span className="text-xs text-slate-500">licitações no filtro atual</span>
    </article>
    <article className="relative rounded-xl border border-amber-200 bg-white p-4 shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Em disputa</span>
      <div className="mt-1 text-2xl font-bold text-slate-900">{kpis.emDisputa.toLocaleString('pt-BR')}</div>
      <span className="text-xs text-slate-500">recebendo / lance / sessão</span>
      <Flame className="absolute top-4 right-4 w-4 h-4 text-amber-600" />
    </article>
    <article className="relative rounded-xl border border-emerald-200 bg-white p-4 shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Homologadas</span>
      <div className="mt-1 text-2xl font-bold text-slate-900">{kpis.homologadas.toLocaleString('pt-BR')}</div>
      <span className="text-xs text-slate-500">vitórias confirmadas</span>
      <Trophy className="absolute top-4 right-4 w-4 h-4 text-emerald-600" />
    </article>
    <article className="relative rounded-xl border border-indigo-200 bg-white p-4 shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Valor em jogo</span>
      <div className="mt-1 text-2xl font-bold text-slate-900">{formatPipelineCurrency(kpis.valorPipeline)}</div>
      <span className="text-xs text-slate-500">pipeline em andamento</span>
      <DollarSign className="absolute top-4 right-4 w-4 h-4 text-indigo-600" />
    </article>
  </section>
);
