import React from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  TrendingUp,
} from 'lucide-react';
import type { ContractAnalysis, HealthStatus, VigenciaExpectativa } from '../../types/contratos';

function formatCurrency(value: number | null): string {
  if (value == null || value === 0) return '—';
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '—';
  }
}

function vigenciaRangeLabel(
  inicio: string | null,
  fim: string | null,
  expectativa?: VigenciaExpectativa,
): string {
  if (inicio || fim) {
    return `${formatDate(inicio)} → ${formatDate(fim)}`;
  }
  if (expectativa === 'aguardando_ata') return 'Aguardando ata PNCP';
  if (expectativa === 'aguardando_contrato') return 'Aguardando contrato PNCP';
  if (expectativa === 'nao_aplicavel') return 'Vigência não aplicável';
  return '— → —';
}

function diasLabel(dias: number | null, expectativa?: VigenciaExpectativa): string {
  if (dias == null) {
    if (expectativa === 'aguardando_ata') return 'Aguardando ata';
    if (expectativa === 'aguardando_contrato') return 'Aguardando contrato';
    if (expectativa === 'nao_aplicavel') return 'Não aplicável';
    return 'Vigência pendente';
  }
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dias`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Falta 1 dia';
  return `Faltam ${dias} dias`;
}

function desvioLabel(desvio: number | null): string {
  if (desvio == null) return 'Sem referência';
  if (Math.abs(desvio) <= 5) return 'Na média';
  return desvio > 0 ? `${desvio.toFixed(0)}% acima da média` : `${Math.abs(desvio).toFixed(0)}% abaixo da média`;
}

const statusStyles: Record<HealthStatus, string> = {
  saudavel: 'border-emerald-200 bg-emerald-50/40',
  atencao: 'border-amber-200 bg-amber-50/40',
  critico: 'border-rose-200 bg-rose-50/40',
};

const statusPill: Record<HealthStatus, string> = {
  saudavel: 'bg-emerald-100 text-emerald-800',
  atencao: 'bg-amber-100 text-amber-800',
  critico: 'bg-rose-100 text-rose-800',
};

const statusLabel: Record<HealthStatus, string> = {
  saudavel: 'Sem problemas',
  atencao: 'Olhar com carinho',
  critico: 'Precisa de ação',
};

interface ContratoCardProps {
  analysis: ContractAnalysis;
  onViewDetails?: (id: string) => void;
}

export const ContratoCard: React.FC<ContratoCardProps> = ({ analysis, onViewDetails }) => {
  const { contrato, health, alertas, acoes_recomendadas } = analysis;
  const dias = health.fatores.tempo_restante.dias_restantes;
  const expectativa = health.vigencia_expectativa;
  const overlay = dias != null && dias < 0 ? 'vencido' : health.status;
  const nextAction = acoes_recomendadas[0];

  return (
    <article
      className={`rounded-xl border p-4 transition hover:shadow-sm ${statusStyles[health.status]}`}
    >
      <div className="flex gap-4">
        <div
          className={`shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center font-bold ${statusPill[health.status]}`}
        >
          <span className="text-xl leading-none">{health.health_score}</span>
          <span className="text-[10px] uppercase tracking-wide mt-1">Saúde</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold uppercase">
              <FileText className="w-3 h-3" />
              {contrato.tipo === 'ata' ? 'ATA RP' : 'CONTRATO'}
            </span>
            <span>· {contrato.numero_controle_pncp ?? contrato.numero_contrato_empenho ?? 'sem nº'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusPill[health.status]}`}>
              {overlay === 'vencido' ? 'Vencido' : statusLabel[health.status]}
            </span>
          </div>

          <h3 className="mt-1 font-semibold text-slate-900 line-clamp-2">
            {contrato.objeto ?? 'Sem descrição do objeto'}
          </h3>

          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {contrato.orgao_razao_social && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{contrato.orgao_razao_social}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                {vigenciaRangeLabel(
                  contrato.data_vigencia_inicio,
                  contrato.data_vigencia_fim,
                  expectativa,
                )}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wide">Valor</span>
              <p className="font-semibold text-slate-800">{formatCurrency(contrato.valor_global)}</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase tracking-wide">Vigência</span>
              <p className={`font-semibold ${dias != null && dias <= 30 ? 'text-rose-700' : 'text-slate-800'}`}>
                {diasLabel(dias, expectativa)}
              </p>
            </div>
            <div>
              <span className="text-slate-400 uppercase tracking-wide">Preço</span>
              <p className="font-semibold text-slate-800 inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {desvioLabel(health.fatores.valor_vs_mercado.desvio_percentual)}
              </p>
            </div>
          </div>

          {alertas.length > 0 && (
            <div className="mt-3 space-y-1">
              {alertas.slice(0, 2).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs text-rose-700">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {a.titulo}
                </div>
              ))}
            </div>
          )}

          {nextAction && (
            <div className="mt-3 p-2 rounded-lg bg-white/70 border border-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-400">Próximo passo</p>
              <p className="text-sm font-medium text-slate-800">{nextAction.titulo}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {(['tempo_restante', 'risco_institucional', 'valor_vs_mercado'] as const).map((key) => {
                const f = health.fatores[key];
                const label = key === 'tempo_restante' ? 'Prazo' : key === 'risco_institucional' ? 'Risco' : 'Preço';
                return (
                  <span
                    key={key}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusPill[f.classificacao]}`}
                  >
                    {label} {f.score}
                  </span>
                );
              })}
            </div>
            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(contrato.id)}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Ver detalhes <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
