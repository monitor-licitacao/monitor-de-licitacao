import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, XCircle, RefreshCw, Sparkles, Clock } from 'lucide-react';

interface CRMViewProps {
  tenantId?: string;
}

export const CRMView: React.FC<CRMViewProps> = ({ tenantId = '1' }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/revops/insights?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Falha ao carregar insights de RevOps');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [tenantId]);

  const handleAction = async (dealId: number, action: 'WON' | 'LOST') => {
    setProcessingId(dealId);
    // TODO: In a real app, call a specific endpoint for updating the deal status
    // For now, optimistic update to clear it from the list
    setTimeout(() => {
      setData((prev: any) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          hygieneData: {
            ...prev.metrics.hygieneData,
            staleDeals: prev.metrics.hygieneData.staleDeals.filter((d: any) => d.id !== dealId),
            staleCount: prev.metrics.hygieneData.staleCount - 1
          }
        }
      }));
      setProcessingId(null);
    }, 800);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800">RevOps Command Center</h2>
        </div>
        
        {/* Skeleton for Briefing */}
        <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>
           <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
           </div>
           <div className="space-y-3">
              <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 w-4/6 bg-slate-200 rounded animate-pulse"></div>
           </div>
        </div>

        {/* Skeletons for KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm h-32 flex flex-col justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-10 w-32 bg-slate-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-96 text-slate-500">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-lg font-medium">{error}</p>
        <button onClick={fetchInsights} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar Novamente
        </button>
      </div>
    );
  }

  const { metrics, aiBriefing } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            RevOps Command Center
          </h2>
          <p className="text-slate-500 mt-1">Inteligência de Receita e Higiene do Pipeline B2B (Licitações)</p>
        </div>
        <button onClick={fetchInsights} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all cursor-pointer">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* THE BRIEFING (GLASSMORPHISM) */}
      <div className="relative bg-white/70 backdrop-blur-xl border border-white rounded-2xl p-6 sm:p-8 shadow-xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 via-blue-500 to-sky-400"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900">Briefing Estratégico (SDR Agent)</h3>
          </div>
          <div className="prose prose-slate prose-sm sm:prose-base max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
            {aiBriefing}
          </div>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Win Rate */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lagging Indicator</p>
              <h3 className="text-lg font-semibold text-slate-800">Win Rate (Mês)</h3>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">
            {metrics.winRateData.winRate}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Baseado em <strong className="text-slate-700">{metrics.winRateData.totalClosed}</strong> negócios finalizados.
          </p>
        </div>

        {/* Cohort Conversion */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Health</p>
              <h3 className="text-lg font-semibold text-slate-800">Conversão de Coorte</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">
            {metrics.cohortData.conversionRate}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Coorte 3m atrás: <strong className="text-slate-700">{metrics.cohortData.cohortSize}</strong> opps criadas.
          </p>
        </div>

        {/* Pipeline Hygiene */}
        <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ${metrics.hygieneData.staleCount > 0 ? 'ring-2 ring-rose-500/20' : ''}`}>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Operacional</p>
              <h3 className="text-lg font-semibold text-slate-800">Ervas Daninhas</h3>
            </div>
            <div className={`p-2 rounded-lg ${metrics.hygieneData.staleCount > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
              <AlertTriangle className={`w-5 h-5 ${metrics.hygieneData.staleCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 tracking-tighter">
            {metrics.hygieneData.staleCount}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Negócios sem ação há &gt; <strong className="text-slate-700">{metrics.hygieneData.slaDays} dias</strong>.
          </p>
        </div>
      </div>

      {/* STALE DEALS ACTION LIST */}
      {metrics.hygieneData.staleCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Ação Requerida: Higiene do Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-1">Negócios estagnados que estão poluindo as métricas. Mova-os para LOST ou reative-os.</p>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {metrics.hygieneData.staleDeals.map((deal: any) => (
              <div key={deal.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Clock className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800 text-sm">Deal #{deal.id} (Edital {deal.editalId})</h4>
                      <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold">Estagnado há {deal.daysStagnant} dias</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono">Última att: {new Date(deal.lastUpdate).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleAction(deal.id, 'WON')}
                    disabled={processingId === deal.id}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Manter Aberto
                  </button>
                  <button 
                    onClick={() => handleAction(deal.id, 'LOST')}
                    disabled={processingId === deal.id}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 border border-transparent rounded hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {processingId === deal.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Aprovar Descarte
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
