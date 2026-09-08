import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Download, 
  Send,
  ExternalLink,
  Bot
} from 'lucide-react';
import { Edital, HumanDecision, ReviewStatus } from '../types';
import { generateEditalPDFReport } from '../utils/pdfGenerator';

interface ReviewWorkflowViewProps {
  editais: Edital[];
  selectedEditalForReview: Edital | null;
  onSelectEditalForReview: (edital: Edital | null) => void;
  onSubmitReview: (
    editalId: string,
    payload: {
      humanReviewStatus: ReviewStatus;
      reviewedBy: string;
      reviewNotes: string;
      findingsDecisions: { findingId: string; decision: HumanDecision; comment?: string }[];
      publishedInternally: boolean;
    }
  ) => Promise<void>;
  onSendWhatsApp: (editalId: string) => Promise<any>;
}

export const ReviewWorkflowView: React.FC<ReviewWorkflowViewProps> = ({
  editais,
  selectedEditalForReview,
  onSelectEditalForReview,
  onSubmitReview
}) => {
  const pendingEditais = editais.filter(e => e.humanReviewStatus === 'PENDING');
  const currentEdital = selectedEditalForReview || pendingEditais[0] || editais[0];

  const [confirmedGoldenRule, setConfirmedGoldenRule] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Ao mudar de edital, resetamos a governança
  React.useEffect(() => {
    setConfirmedGoldenRule(false);
    setSyncStatus('idle');
  }, [currentEdital?.id]);

  const handleSyncPloomes = async () => {
    if (!currentEdital || !confirmedGoldenRule) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      // Regra de Ouro: garantir que está aprovado no banco local antes de mandar pro CRM
      if (currentEdital.humanReviewStatus === 'PENDING') {
         await onSubmitReview(currentEdital.id, {
          humanReviewStatus: 'APPROVED',
          reviewedBy: 'Analista RevOps',
          reviewNotes: 'Aprovado para envio ao Ploomes.',
          findingsDecisions: [],
          publishedInternally: true
        });
      }

      const res = await fetch('/api/crm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editalId: currentEdital.id, tenantId: '1' })
      });
      
      if (!res.ok) throw new Error(await res.text());
      setSyncStatus('success');
      
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* OPÇÃO 1: Terminal de Oportunidades (Alta Densidade) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
            {/* Header Terminal */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                Terminal de Triagem & Homologação
              </h2>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-mono">
                {pendingEditais.length} Pendentes
              </span>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Órgão / Edital</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Objeto</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Valor</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editais.map(edital => {
                    const isSelected = currentEdital?.id === edital.id;
                    const isPending = edital.humanReviewStatus === 'PENDING';

                    return (
                      <tr 
                        key={edital.id}
                        onClick={() => onSelectEditalForReview(edital)}
                        className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800 text-xs line-clamp-1">{edital.agency || edital.sourceName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{edital.processNumber}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          <div className="line-clamp-2">{edital.objectDescription}</div>
                        </td>
                        <td className="px-4 py-4 font-mono font-bold text-slate-700 text-xs">
                          {edital.estimatedValue ? `R$ ${edital.estimatedValue.toLocaleString('pt-BR')}` : '-'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isPending ? (
                            <span className="inline-flex bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">REVISAR</span>
                          ) : (
                            <span className="inline-flex bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* OPÇÃO 2: Card de Análise de IA (Foco em Transparência) */}
        {currentEdital ? (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border-l-4 border-emerald-500 shadow-md rounded-r-lg p-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-5">
                <Bot size={120} />
              </div>
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    IA Analyst Bot
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm">Resumo Estratégico</h3>
                </div>
                <a href={currentEdital.url || currentEdital.rawUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-[11px] font-bold hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> Ver Edital Original
                </a>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed relative z-10">
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <p><strong>Objeto Oficial:</strong> {currentEdital.objectDescription}</p>
                </div>
                
                {currentEdital.findings.length > 0 ? (
                  <div className="space-y-2">
                    <strong className="text-rose-700 flex items-center gap-1">
                      <XCircle size={14} /> {currentEdital.findings.length} Alertas Jurídicos Detectados:
                    </strong>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                      {currentEdital.findings.map(f => (
                        <li key={f.id}>
                          <span className="font-semibold">{f.findingType.replace(/_/g, ' ')}:</span> {f.explanation} (Pág {f.page})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Nenhum alerta jurídico gravíssimo detectado.
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-4 relative z-10">
                <label className="flex items-start gap-2 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-lg transition-colors hover:bg-amber-100">
                  <input 
                    type="checkbox" 
                    checked={confirmedGoldenRule}
                    onChange={(e) => setConfirmedGoldenRule(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-amber-900">Regra de Ouro (Zero Alucinação)</span>
                    <span className="text-[10px] text-amber-700 leading-tight mt-0.5">
                      Confirmo que revisei os dados originais e atesto a validade para inserção no CRM.
                    </span>
                  </div>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => generateEditalPDFReport(currentEdital)}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button 
                    onClick={handleSyncPloomes}
                    disabled={!confirmedGoldenRule || isSyncing}
                    className={`flex-[2] px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                      confirmedGoldenRule 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isSyncing ? (
                      <span className="animate-pulse">SINCRONIZANDO...</span>
                    ) : (
                      <>
                        <Send size={14} /> {currentEdital.ploomesDealId ? 'ATUALIZAR PLOOMES' : 'ENVIAR AO PLOOMES'}
                      </>
                    )}
                  </button>
                </div>
                
                {syncStatus === 'success' && (
                  <div className="text-[10px] text-emerald-600 font-bold text-center animate-fade-in">
                    ✓ Sincronizado com sucesso!
                  </div>
                )}
                {syncStatus === 'error' && (
                  <div className="text-[10px] text-rose-600 font-bold text-center animate-fade-in">
                    ✕ Falha na integração. Verifique os logs.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
           <div className="lg:col-span-5 flex items-center justify-center p-12 bg-white border border-slate-200 rounded-lg text-slate-400 text-sm">
             Selecione um edital para análise.
           </div>
        )}
      </div>
    </div>
  );
};
