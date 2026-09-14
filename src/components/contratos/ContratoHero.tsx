import React from 'react';
import { Activity, AlertCircle, FileText, Layers } from 'lucide-react';
import type { DashboardData } from '../../types/contratos';

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

interface ContratoHeroProps {
  dashboard: DashboardData;
}

export const ContratoHero: React.FC<ContratoHeroProps> = ({ dashboard }) => {
  const { resumo, distribuicao_saude } = dashboard;
  const total = resumo.total_contratos + resumo.total_atas || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Monitor · Contratos · Raio-X
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Como está a saúde dos seus contratos — quanto vale, quantos pedem atenção e o que merece prioridade
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <span className="text-xs font-semibold text-blue-700 uppercase">Valor total</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(resumo.valor_total)}</p>
          <p className="text-xs text-slate-500 mt-1">somando todos os contratos vigentes</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Contratos</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{resumo.total_contratos}</p>
          <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
            <FileText className="w-3 h-3" /> em execução
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Atas vigentes</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{resumo.total_atas}</p>
          <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
            <Layers className="w-3 h-3" /> registro de preços
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-xs font-semibold text-amber-800 uppercase">Avisos abertos</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{resumo.alertas_ativos}</p>
          <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> precisam do seu olho
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold uppercase text-slate-500">Distribuição por saúde</span>
          <span className="text-xs text-slate-400 ml-auto">
            De {total} {total === 1 ? 'instrumento' : 'instrumentos'} no portfólio
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${pct(distribuicao_saude.saudavel)}%` }} title="Saudável" />
          <div className="bg-amber-400" style={{ width: `${pct(distribuicao_saude.atencao)}%` }} title="Atenção" />
          <div className="bg-rose-500" style={{ width: `${pct(distribuicao_saude.critico)}%` }} title="Crítico" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
          <div className="text-emerald-700">
            <span className="font-bold">{distribuicao_saude.saudavel}</span> sem problemas ({pct(distribuicao_saude.saudavel)}%)
          </div>
          <div className="text-amber-700">
            <span className="font-bold">{distribuicao_saude.atencao}</span> atenção ({pct(distribuicao_saude.atencao)}%)
          </div>
          <div className="text-rose-700">
            <span className="font-bold">{distribuicao_saude.critico}</span> críticos ({pct(distribuicao_saude.critico)}%)
          </div>
        </div>
      </div>
    </section>
  );
};
