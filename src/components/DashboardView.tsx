import React, { useState } from 'react';
import { 
  Building2, 
  FileText, 
  Scale, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink,
  ShieldCheck, 
  Zap, 
  Download, 
  Eye, 
  RefreshCw, 
  Cpu,
  Smartphone,
  Layers,
  Database,
  Copy,
  Check,
  Link2,
  X,
  Calendar,
  DollarSign,
  Hash,
  FileCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Source, Edital, SchedulerState, WhatsAppNotification, OCRPage } from '../types';
import { generateEditalPDFReport } from '../utils/pdfGenerator';

interface DashboardViewProps {
  sources: Source[];
  editais: Edital[];
  scheduler: SchedulerState;
  notifications: WhatsAppNotification[];
  onSelectEdital: (edital: Edital) => void;
  onNavigateTab: (tab: string) => void;
  onTriggerScheduler: () => void;
  isTriggering: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  sources,
  editais,
  scheduler,
  notifications,
  onSelectEdital,
  onNavigateTab,
  onTriggerScheduler,
  isTriggering
}) => {
  const [selectedDetailEdital, setSelectedDetailEdital] = useState<Edital | null>(null);
  const [activeOcrPageNum, setActiveOcrPageNum] = useState<number>(1);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeSources = sources.filter(s => s.status === 'ACTIVE').length;
  const pendingReviewCount = editais.filter(e => e.humanReviewStatus === 'PENDING').length;
  const approvedCount = editais.filter(e => e.humanReviewStatus === 'APPROVED').length;
  const totalFindings = editais.reduce((acc, e) => acc + e.findings.length, 0);
  const avgLatency = Math.round(sources.reduce((acc, s) => acc + s.latencyMs, 0) / (sources.length || 1));
  const apiSourcesCount = sources.filter(s => s.type === 'API').length;
  const scraperSourcesCount = sources.filter(s => s.type === 'SCRAPER').length;
  const retifiedCount = editais.filter(e => e.retificationStatus === 'RETIFICADO').length;

  const handleOpenDetailModal = (edital: Edital) => {
    setSelectedDetailEdital(edital);
    setActiveOcrPageNum(1);
    setCopiedLink(false);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top High Density Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Monitoramento</span>
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{sources.length}</span>
            <span className="text-blue-600 font-medium text-xs">28 Mun. + 4 Nac.</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Editais NCM 9506</span>
            <FileText className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{editais.length}</span>
            <span className="text-green-600 font-medium text-xs">↑ 12% vs. ontem</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Aguardando Revisão</span>
            <UserCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-bold ${pendingReviewCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {pendingReviewCount}
            </span>
            <span className="text-slate-500 font-medium text-xs">
              {approvedCount} homologados
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Achados Vinculados</span>
            <Scale className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{totalFindings}</span>
            <span className="text-slate-500 text-xs">Com evidência</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Saúde das Fontes</span>
            <Zap className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">98.4%</span>
            <span className="text-slate-500 text-xs">Latência: {avgLatency}ms</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-slate-500 text-[11px] uppercase font-semibold mb-1 tracking-tight flex items-center justify-between">
            <span>Meta WhatsApp</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-800">{notifications.length}</span>
            <span className="text-emerald-600 font-medium text-xs">Cloud API OK</span>
          </div>
        </div>
      </div>

      {/* Golden Rule Callout Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900 uppercase tracking-wide text-[11px]">
                Regra de Ouro do PRD v1.1
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-800 font-bold uppercase">
                Obrigatório
              </span>
            </div>
            <p className="text-amber-800 text-[11.5px] mt-0.5 leading-relaxed">
              Nenhum achado gerado pelo motor de OCR e NLP é considerado válido externamente sem <strong>revisão e validação humana</strong>.
              O status <em>"Inconclusivo"</em> é mandatório para casos sem fundamentação textual suficiente.
            </p>
          </div>
        </div>

        {pendingReviewCount > 0 ? (
          <button
            onClick={() => onNavigateTab('review')}
            className="shrink-0 px-3 py-1.5 text-xs font-bold rounded bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Revisar ({pendingReviewCount})</span>
          </button>
        ) : (
          <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Fila Zerada</span>
          </div>
        )}
      </div>

      {/* AI Technical Spec & Market Scanner Spotlight Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 border border-blue-800/80 rounded-lg p-3.5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 shrink-0">
            <Sparkles className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">
                Item 4.3 - Pesquisa de Fornecedores & Amortecimento via IA
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-200 border border-blue-400/40 font-mono font-bold">
                Novo Recurso Gemini 3.7
              </span>
            </div>
            <p className="text-slate-300 text-[11.5px] mt-0.5 max-w-2xl leading-relaxed">
              Auditoria de especificações patenteadas (ex: <em>FlexWave Duo</em>, sistemas de absorção de impacto), verificação de prazo exíguo (5 dias) e mapeamento de fornecedores com produtos equivalentes.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('tech-spec-ai')}
          className="shrink-0 px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <span>Abrir Pesquisa de Produtos</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Grid: Feed & Right Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8/12: Editais Fila de Detecção (NCM 9506) */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                Fila de Detecção (NCM 9506.91 - Cultura Física & Ginástica)
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">API ComprasNet</span>
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">SCRAPER 28 Mun.</span>
            </div>
          </div>

            <div className="divide-y divide-slate-100">
            {editais.slice(0, 6).map(edital => {
              const isApproved = edital.humanReviewStatus === 'APPROVED';
              const isApi = edital.sourceType === 'API';

              return (
                <div
                  key={edital.id}
                  id="edital-card-item"
                  data-testid={`edital-card-${edital.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenDetailModal(edital)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenDetailModal(edital);
                    }
                  }}
                  className="p-3.5 hover:bg-blue-50/50 hover:border-l-4 hover:border-l-blue-600 transition-all duration-150 cursor-pointer flex flex-col sm:flex-row justify-between gap-3 items-start group"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                        isApi ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'
                      }`}>
                        {edital.sourceName}
                      </span>
                      <span className="text-slate-400 text-[10px]">•</span>
                      <span className="text-[10.5px] font-bold text-slate-700">
                        {edital.sourceCategory} • {edital.uf} {edital.city ? `(${edital.city})` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        (Proc: {edital.processNumber})
                      </span>
                      {edital.retificationStatus === 'RETIFICADO' && (
                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded text-[9.5px] font-bold">
                          v{edital.version}.0 Retificado
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-800 text-[13px] group-hover:text-blue-600 transition-colors leading-snug flex items-center gap-1.5">
                      <span>{edital.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </h3>

                    <p className="text-slate-500 text-[11.5px] line-clamp-2 italic leading-relaxed">
                      "{edital.objectDescription}"
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[10.5px] text-slate-500 font-medium">
                      <span className="uppercase tracking-tight font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        NCM {edital.ncmCode}
                      </span>
                      {edital.budgetEstimated && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(edital.budgetEstimated)}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>OCR: <strong className="text-slate-700">{edital.ocrConfidenceAvg}%</strong></span>
                      <span>•</span>
                      <span>Achados: <strong className="text-amber-600">{edital.findings.length}</strong></span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isApproved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isApproved ? '✓ Revisado' : 'Requer Revisão'}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Direct Hyperlink Button on Card */}
                    <a
                      href={edital.rawUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Abrir hiperlink do edital original no portal"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-600" />
                      <span>Link Edital</span>
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetailModal(edital);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Detalhes</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateEditalPDFReport(edital);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
                      title="Gerar Relatório PDF"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4/12: Hybrid Architecture & Scheduler */}
        <div className="lg:col-span-4 space-y-4">
          {/* Integration Strategy Box */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Arquitetura Híbrida (RF-01/02)</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded bg-blue-50/60 border border-blue-100 space-y-0.5">
                <div className="flex items-center justify-between font-bold text-blue-900 text-[11.5px]">
                  <span>ComprasNet API (Gov.br)</span>
                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-blue-200 text-blue-800 font-bold">Âncora Oficial</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-tight">
                  Validação de NCM em campos oficiais JSON para calibragem do motor semântico.
                </p>
              </div>

              <div className="p-2.5 rounded bg-orange-50/60 border border-orange-100 space-y-0.5">
                <div className="flex items-center justify-between font-bold text-orange-900 text-[11.5px]">
                  <span>Scraper AMZOP + Sistema S</span>
                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-orange-200 text-orange-800 font-bold">Tesseract OCR</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-tight">
                  28 Portais de Prefeituras do RS + SESC/SENAT/SESI com OCR multi-página.
                </p>
              </div>
            </div>
          </div>

          {/* Scheduler Live Monitor */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Scheduler Logs ({(scheduler?.logs || []).length})</span>
              </div>
              <button
                onClick={onTriggerScheduler}
                disabled={isTriggering}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isTriggering ? 'animate-spin' : ''}`} />
                <span>{isTriggering ? 'Rodando...' : 'Executar'}</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {(scheduler?.logs || []).map(log => (
                <div key={log.id} className="p-2 rounded bg-slate-50 border border-slate-100 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span className="text-slate-800 font-semibold truncate max-w-[170px]">{log.sourceName}</span>
                    <span className="text-[10px] font-mono">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <p className="text-slate-600 text-[10.5px] leading-tight">
                    {log.message}
                  </p>
                  <div className="flex items-center gap-2 text-[9.5px] text-slate-400 pt-0.5">
                    <span>{log.sourceType}</span>
                    <span>•</span>
                    <span>{log.latencyMs}ms</span>
                    <span>•</span>
                    <span className="text-blue-600 font-semibold">Itens: {log.itemsFound}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom High Density Sub-Bar (From Theme Reference) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border-r border-slate-100 pr-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-tight">Próxima Coleta Scheduler</div>
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="w-[75%] h-full bg-blue-600"></div>
            </div>
            <span className="font-bold text-xs text-slate-700">12m 45s</span>
          </div>
        </div>

        <div className="border-r border-slate-100 pr-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-tight">Status S3 & OCR</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-xs text-slate-600 font-semibold">98.2 GB Utilizado (Active)</span>
          </div>
        </div>

        <div className="border-r border-slate-100 pr-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-tight">Retificações Detectadas</div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9.5px] font-bold">DIFF ATIVO</span>
            <span className="text-xs text-slate-600 font-medium">{retifiedCount} Editais Atualizados</span>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-tight">Meta WhatsApp Status</div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase">Conectado</span>
            <span className="text-[10px] text-slate-400">({notifications.length} envios/mês)</span>
          </div>
        </div>
      </div>

      {/* Modal: Detalhes Completos do Edital com Hiperlink Oficial */}
      {selectedDetailEdital && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSelectedDetailEdital(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50 shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                    NCM {selectedDetailEdital.ncmCode}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    {selectedDetailEdital.processNumber}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                    {selectedDetailEdital.sourceCategory} • {selectedDetailEdital.uf} {selectedDetailEdital.city ? `(${selectedDetailEdital.city})` : ''}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    selectedDetailEdital.humanReviewStatus === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {selectedDetailEdital.humanReviewStatus === 'APPROVED' ? '✓ Revisão Concluída' : '⏳ Aguardando Revisão Humana'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-800 leading-snug">
                  {selectedDetailEdital.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedDetailEdital(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 shrink-0 cursor-pointer transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* PRIMARY CALLOUT: Hiperlink Oficial do Edital */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                        <span>Hiperlink Oficial do Edital & Documentos</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-800 font-bold uppercase">
                          {selectedDetailEdital.sourceName}
                        </span>
                      </h4>
                      <p className="text-blue-800/80 text-[11.5px] mt-0.5 leading-relaxed">
                        Acesso direto ao portal de publicação oficial, anexos em PDF, termo de referência e caderno técnico.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={selectedDetailEdital.rawUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Edital no Portal</span>
                    </a>
                  </div>
                </div>

                {/* URL Display + Copy Button */}
                <div className="flex items-center gap-2 p-2 bg-white/90 border border-blue-100 rounded-lg text-slate-600 font-mono text-[11px]">
                  <span className="text-slate-400 shrink-0 font-sans font-semibold">URL:</span>
                  <input
                    type="text"
                    readOnly
                    value={selectedDetailEdital.rawUrl}
                    className="w-full bg-transparent outline-none truncate text-blue-700 select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(selectedDetailEdital.rawUrl)}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-600" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Informações Gerais & Metadados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10.5px] text-slate-400 font-bold uppercase">Entidade / Fonte</div>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5 truncate">{selectedDetailEdital.sourceName}</div>
                  <div className="text-[10px] text-slate-500">{selectedDetailEdital.sourceCategory} • {selectedDetailEdital.uf}</div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10.5px] text-slate-400 font-bold uppercase">Modalidade & Processo</div>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">{selectedDetailEdital.modality}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{selectedDetailEdital.processNumber}</div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10.5px] text-slate-400 font-bold uppercase">Datas de Sessão</div>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">
                    Abertura: {new Date(selectedDetailEdital.openingDate).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Publicado: {new Date(selectedDetailEdital.publicationDate).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10.5px] text-slate-400 font-bold uppercase">Orçamento Estimado</div>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">
                    {selectedDetailEdital.budgetEstimated 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedDetailEdital.budgetEstimated)
                      : 'Não informado'}
                  </div>
                  <div className="text-[10px] text-slate-500">Versão: v{selectedDetailEdital.version}.0 {selectedDetailEdital.retificationStatus === 'RETIFICADO' ? '(Retificado)' : ''}</div>
                </div>
              </div>

              {/* Objeto Descritivo */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Objeto da Licitação</span>
                </div>
                <p className="text-slate-700 text-xs leading-relaxed">
                  {selectedDetailEdital.objectDescription}
                </p>
              </div>

              {/* S3 Storage & Hash Cryptographic Integrity (RF-04) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Armazenamento Imutável S3 & Integridade SHA-256 (RF-04)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="text-slate-600 truncate bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 font-sans font-bold">Chave S3:</span> {selectedDetailEdital.s3StorageKey}
                  </div>
                  <div className="text-slate-600 truncate bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 font-sans font-bold">SHA-256:</span> {selectedDetailEdital.sha256Hash}
                  </div>
                </div>
              </div>

              {/* OCR Multi-page Preview (RF-05) */}
              {selectedDetailEdital.ocrPages && selectedDetailEdital.ocrPages.length > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Pipeline de OCR Tesseract Multi-Páginas ({selectedDetailEdital.ocrPages.length} páginas)</span>
                    </div>
                    <div className="text-[11px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">
                      Média OCR: {selectedDetailEdital.ocrConfidenceAvg}%
                    </div>
                  </div>

                  {/* Page Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {selectedDetailEdital.ocrPages.map(page => (
                      <button
                        key={page.pageNumber}
                        onClick={() => setActiveOcrPageNum(page.pageNumber)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 cursor-pointer transition-colors border ${
                          activeOcrPageNum === page.pageNumber
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Página {page.pageNumber} ({page.confidenceScore}%)
                      </button>
                    ))}
                  </div>

                  {/* Selected Page Text Viewer */}
                  {(() => {
                    const currentPage = selectedDetailEdital.ocrPages.find(p => p.pageNumber === activeOcrPageNum) || selectedDetailEdital.ocrPages[0];
                    return (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11.5px] font-mono text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {currentPage.manualText || currentPage.text}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Achados & Evidências Vinculadas */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    <span>Matriz de Achados & Evidências Jurídicas ({selectedDetailEdital.findings.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Regra de Ouro: Validação Humana Mandatória</span>
                </div>

                <div className="space-y-2">
                  {selectedDetailEdital.findings.map(finding => (
                    <div key={finding.id} className="p-3 rounded bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          {finding.findingType} • Pág. {finding.page}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Base: {finding.legalBasis}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border-l-2 border-amber-500 text-[11px] italic text-slate-700">
                        "{finding.snippet}"
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        <strong>Explicação:</strong> {finding.explanation}
                      </p>
                    </div>
                  ))}
                  {selectedDetailEdital.findings.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs bg-white rounded border border-slate-200">
                      Nenhum achado restritivo detectado neste edital.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <a
                  href={selectedDetailEdital.rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Acessar Portal Oficial</span>
                </a>

                <button
                  onClick={() => generateEditalPDFReport(selectedDetailEdital)}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Relatório PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const editalToView = selectedDetailEdital;
                    setSelectedDetailEdital(null);
                    onSelectEdital(editalToView);
                    onNavigateTab('editais');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspecionar OCR Completo</span>
                </button>

                {selectedDetailEdital.humanReviewStatus === 'PENDING' && (
                  <button
                    onClick={() => {
                      const editalToReview = selectedDetailEdital;
                      setSelectedDetailEdital(null);
                      onSelectEdital(editalToReview);
                      onNavigateTab('review');
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Revisar na Bancada</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedDetailEdital(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
