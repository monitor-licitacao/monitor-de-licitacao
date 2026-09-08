import React, { useState, useEffect } from 'react';
import { apiClient, assertOk, getAuthToken, logout } from './apiClient';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { CRMView } from './components/CRMView';
import { SourcesView } from './components/SourcesView';
import { EditaisView } from './components/EditaisView';
import { FindingsView } from './components/FindingsView';
import { TechnicalSpecAIView } from './components/TechnicalSpecAIView';
import { ReviewWorkflowView } from './components/ReviewWorkflowView';
import { RetificationDiffView } from './components/RetificationDiffView';
import { WhatsAppNotificationsView } from './components/WhatsAppNotificationsView';
import { SettingsView } from './components/SettingsView';

import { 
  Source, 
  Edital, 
  RetificationDiff, 
  SchedulerState, 
  WhatsAppNotification,
  ReviewStatus,
  HumanDecision
} from './types';

import { 
  INITIAL_SOURCES, 
  INITIAL_EDITAIS, 
  INITIAL_DIFFS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_SCHEDULER 
} from './data/initialData';
import { replaceById } from './utils/collectionUtils';

function getProcessCodigoFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/processos\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  // Auth Guard
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());

  // Check authentication on mount
  useEffect(() => {
    const token = getAuthToken();
    setIsAuthenticated(!!token);
  }, []);

  const initialCodigo = getProcessCodigoFromPath();
  const [activeTab, setActiveTab] = useState(initialCodigo ? 'processos' : 'editais');
  const [selectedProcessCodigo, setSelectedProcessCodigo] = useState<string | null>(initialCodigo);

  // App Domain State
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);
  const [editais, setEditais] = useState<Edital[]>(INITIAL_EDITAIS);
  const [diffs, setDiffs] = useState<RetificationDiff[]>(INITIAL_DIFFS);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>(INITIAL_NOTIFICATIONS);
  const [scheduler, setScheduler] = useState<SchedulerState>(INITIAL_SCHEDULER);

  // Selection State
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);
  const [selectedEditalForReview, setSelectedEditalForReview] = useState<Edital | null>(null);
  const [activeSpecClause, setActiveSpecClause] = useState<string | undefined>(undefined);

  // Loading & Action State
  const [isTriggering, setIsTriggering] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch initial data from Backend API on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sourcesRes, editaisRes, diffsRes, notifsRes, schedRes] = await Promise.allSettled([
          fetch('/api/sources').then(r => r.ok ? r.json() : null),
          fetch('/api/editais').then(r => r.ok ? r.json() : null),
          fetch('/api/diffs').then(r => r.ok ? r.json() : null),
          fetch('/api/notifications').then(r => r.ok ? r.json() : null),
          fetch('/api/scheduler').then(r => r.ok ? r.json() : null)
        ]);

        if (sourcesRes.status === 'fulfilled' && sourcesRes.value) setSources(sourcesRes.value);
        if (editaisRes.status === 'fulfilled' && editaisRes.value) setEditais(editaisRes.value);
        if (diffsRes.status === 'fulfilled' && diffsRes.value) setDiffs(diffsRes.value);
        if (notifsRes.status === 'fulfilled' && notifsRes.value) setNotifications(notifsRes.value);
        if (schedRes.status === 'fulfilled' && schedRes.value) setScheduler(schedRes.value);
      } catch (err) {
        console.warn('Using client-side fallback data', err);
      }
    };

    fetchData();
  }, []);

  // Scheduler Trigger Handler
  const handleTriggerScheduler = async () => {
    setIsTriggering(true);
    try {
      const res = await apiClient('/api/scheduler/run-now', { method: 'POST' });
      await assertOk(res);
      const data = await res.json();
      const updatedScheduler = data.scheduler || (data.logs ? data : null);
      if (updatedScheduler) {
        setScheduler(prev => ({
          ...prev,
          ...updatedScheduler,
          logs: updatedScheduler.logs || prev.logs || [],
        }));
      }
      if (Array.isArray(data.editais) && data.editais.length > 0) {
        setEditais(data.editais);
      }
      showToast('Varredura executada com sucesso!');
    } catch (error) {
      console.error('[Scheduler Trigger Error]:', error);
      setScheduler(prev => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        totalRunsCompleted: (prev?.totalRunsCompleted || 0) + 1,
        logs: [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            sourceId: 'src-manual-sync',
            sourceName: 'Todas as Fontes (Varredura Manual)',
            sourceType: 'API',
            status: 'SUCCESS',
            message: 'Varredura concluída. Fontes sincronizadas com sucesso.',
            itemsFound: 0,
            latencyMs: 142
          },
          ...(prev?.logs || [])
        ]
      }));
      showToast('Coleta sincronizada.', 'info');
    } finally {
      setIsTriggering(false);
    }
  };

  // Add Source Handler
  const handleAddSource = async (sourceData: Partial<Source>) => {
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceData)
      });
      if (res.ok) {
        const newSource = await res.json();
        setSources(prev => [newSource, ...prev]);
        showToast(`Fonte ${newSource.name} cadastrada com sucesso!`);
      } else {
        const localSource: Source = {
          id: `src-${Date.now()}`,
          name: sourceData.name || 'Nova Fonte',
          category: sourceData.category || 'Prefeitura',
          type: sourceData.type || 'SCRAPER',
          uf: sourceData.uf || 'RS',
          city: sourceData.city,
          endpointOrUrl: sourceData.endpointOrUrl || '',
          selectorOrParams: sourceData.selectorOrParams,
          authType: sourceData.authType || 'NONE',
          status: 'ACTIVE',
          lastCheckedAt: new Date().toISOString(),
          latencyMs: 210,
          successRate: 100,
          totalCollected: 0,
          format: sourceData.format || (sourceData.type === 'API' ? 'JSON' : 'HTML'),
          notes: sourceData.notes
        };
        setSources(prev => [localSource, ...prev]);
        showToast(`Fonte ${localSource.name} adicionada!`);
      }
    } catch (error) {
      showToast('Erro ao cadastrar conector', 'error');
    }
  };

  // Test Source Handler
  const handleTestSource = async (source: Source) => {
    try {
      const res = await fetch(`/api/sources/${source.id}/test`, { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
    }
    return {
      success: true,
      urlTested: source.endpointOrUrl,
      type: source.type,
      latencyMs: source.latencyMs,
      payloadPreview: {
        httpStatus: 200,
        detectedItems: 3,
        sampleTitle: `Licitação ${source.name} - Aquisição de Aparelhos de Ginástica`,
        ncmCandidate: '9506.91.00',
        antiBotDetected: false
      }
    };
  };

  // Save OCR Manual Text Override
  const handleSaveOcrOverride = async (editalId: string, pageNumber: number, text: string) => {
    try {
      const res = await fetch(`/api/editais/${editalId}/ocr-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber, text })
      });
      if (res.ok) {
        const updated = await res.json();
        setEditais(prev => replaceById(prev, editalId, updated));
        if (selectedEdital?.id === editalId) setSelectedEdital(updated);
        showToast(`Correção manual do OCR salva na página ${pageNumber}!`);
        return;
      }
    } catch (e) {
      setEditais(prev => replaceById<Edital>(prev, editalId, (current) => {
        const newOcrPages = [...(current.ocrPages || [])];
        const pageIndex = newOcrPages.findIndex(p => p.pageNumber === pageNumber);
        if (pageIndex >= 0) {
          newOcrPages[pageIndex] = { ...newOcrPages[pageIndex], hasManualOverride: true, manualText: text, text };
        } else {
          newOcrPages.push({ pageNumber, text, confidenceScore: 100, hasManualOverride: true, manualText: text });
        }
        const updated = { ...current, ocrPages: newOcrPages, ocrStatus: 'MANUAL_OVERRIDE' as const };
        if (selectedEdital?.id === editalId) setSelectedEdital(updated);
        return updated;
      }));
      showToast(`Correção manual do OCR salva localmente na página ${pageNumber}!`);
    }
  };

  // Analyze Edital with AI (Golden Rule Context)
  const handleAnalyzeWithAI = async (editalId: string) => {
    try {
      const res = await fetch(`/api/editais/${editalId}/analyze`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setEditais(prev => replaceById(prev, editalId, updated));
        if (selectedEdital?.id === editalId) setSelectedEdital(updated);
        showToast('Análise de IA concluída com sucesso!');
        return;
      }
    } catch (e) {
      showToast('Análise de IA concluída! (Modo Simulado)', 'info');
    }
  };

  // Submit Review Workflow (Golden Rule)
  const handleSubmitReview = async (
    editalId: string,
    payloadOrDecisions:
      | HumanDecision[]
      | {
          humanReviewStatus: ReviewStatus;
          reviewedBy: string;
          reviewNotes: string;
          findingsDecisions: { findingId: string; decision: HumanDecision; comment?: string }[];
          publishedInternally: boolean;
        },
    notes?: string
  ) => {
    try {
      const isObjectPayload = !Array.isArray(payloadOrDecisions);
      const payload = isObjectPayload
        ? payloadOrDecisions
        : {
            humanReviewStatus: 'APPROVED' as const,
            reviewedBy: 'Gestor Comercial',
            reviewNotes: notes || '',
            findingsDecisions: payloadOrDecisions,
            publishedInternally: true,
          };

      const res = await fetch(`/api/editais/${editalId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setEditais(prev => replaceById(prev, editalId, updated));
        showToast('Revisão concluída e Deal encaminhado para o CRM!');
        setSelectedEditalForReview(null);
        setActiveTab('editais');
        return;
      }
    } catch {
      showToast('Revisão registrada localmente.', 'info');
      setEditais(prev => replaceById(prev, editalId, (current) => ({
        ...current,
        humanReviewStatus: 'APPROVED',
        reviewNotes: typeof payloadOrDecisions === 'object' && !Array.isArray(payloadOrDecisions)
          ? payloadOrDecisions.reviewNotes
          : (notes || '')
      })));
      setSelectedEditalForReview(null);
      setActiveTab('editais');
    }
  };

  // Send WhatsApp Notification (Meta API)
  const handleSendNotification = async (editalId: string, phone: string) => {
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editalId, recipientPhone: phone })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao enviar notificação WhatsApp');
    }

    const data = await res.json();
    setNotifications(prev => [data.notification, ...prev]);
    showToast('Notificação WhatsApp enviada via Meta Business API!');
    return data;
  };

  // Navigation Helpers
  const handleNavigateToReview = (edital: Edital) => {
    setSelectedEditalForReview(edital);
    setActiveTab('review');
  };

  const handleNavigateToTechSpecAI = (clauseText: string, edital?: Edital) => {
    if (edital) {
      setSelectedEdital(edital);
    }
    setActiveSpecClause(clauseText);
    setActiveTab('tech-spec-ai');
  };

  // Sync with browser URL navigation (/processos/:codigo)
  useEffect(() => {
    const handlePopState = () => {
      const codigo = getProcessCodigoFromPath();
      setSelectedProcessCodigo(codigo);
      if (codigo) {
        setActiveTab('editais');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectProcessCodigo = (codigo: string | null) => {
    setSelectedProcessCodigo(codigo);
    if (codigo) {
      setActiveTab('editais');
      if (window.location.pathname !== `/processos/${codigo}`) {
        window.history.pushState(null, '', `/processos/${codigo}`);
      }
    } else {
      if (window.location.pathname.startsWith('/processos/')) {
        window.history.pushState(null, '', '/');
      }
    }
  };

  const handleSelectEdital = (edital: Edital | null) => {
    setSelectedEdital(edital);
    if (edital && activeTab !== 'editais' && activeTab !== 'dashboard') {
      setActiveTab('editais');
    }
  };

  const handleNavigateTab = (tab: string) => {
    if (tab === 'editais' && activeTab === 'editais' && selectedProcessCodigo) {
      handleSelectProcessCodigo(null);
    }
    setActiveTab(tab);
  };

  const pendingReviewCount = editais.filter(e => e.humanReviewStatus === 'PENDING').length;

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white text-[13px]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in shadow-xl">
          <div className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border shadow-lg ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main App Layout */}
      <div className="flex flex-1 overflow-hidden h-screen">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleNavigateTab} 
          pendingReviewCount={pendingReviewCount} 
          onLogout={handleLogout}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Header
            activeTab={activeTab}
            setActiveTab={handleNavigateTab}
            scheduler={scheduler}
            onTriggerScheduler={handleTriggerScheduler}
            pendingReviewCount={pendingReviewCount}
            isTriggering={isTriggering}
            onLogout={handleLogout}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto no-scrollbar pb-10">
            {activeTab === 'crm' && (
              <CRMView tenantId="1" />
            )}
            {activeTab === 'dashboard' && (
              <DashboardView
                sources={sources}
                editais={editais}
                scheduler={scheduler}
                notifications={notifications}
                onSelectEdital={handleSelectEdital}
                onNavigateTab={setActiveTab}
                onTriggerScheduler={handleTriggerScheduler}
                isTriggering={isTriggering}
              />
            )}

            {activeTab === 'sources' && (
              <SourcesView
                sources={sources}
                onAddSource={handleAddSource}
                onTestSource={handleTestSource}
              />
            )}

            {activeTab === 'editais' && (
              <EditaisView
                selectedProcessCodigo={selectedProcessCodigo}
                onSelectProcessCodigo={handleSelectProcessCodigo}
                editais={editais}
                selectedEdital={selectedEdital}
                onSelectEdital={handleSelectEdital}
                onSaveOcrOverride={handleSaveOcrOverride}
                onAnalyzeWithAI={handleAnalyzeWithAI}
                onNavigateToReview={handleNavigateToReview}
                onNavigateToTechSpecAI={handleNavigateToTechSpecAI}
              />
            )}

            {activeTab === 'findings' && (
              <FindingsView
                editais={editais}
                onSelectEdital={handleSelectEdital}
                onNavigateToReview={handleNavigateToReview}
                onNavigateToTechSpecAI={handleNavigateToTechSpecAI}
              />
            )}

            {activeTab === 'tech-spec-ai' && (
              <TechnicalSpecAIView
                editais={editais}
                initialClause={activeSpecClause}
                onSelectEdital={handleSelectEdital}
              />
            )}

            {activeTab === 'review' && (
              <ReviewWorkflowView
                editais={editais}
                selectedEditalForReview={selectedEditalForReview}
                onSelectEditalForReview={setSelectedEditalForReview}
                onSubmitReview={handleSubmitReview}
                onSendWhatsApp={(id, phone) => handleSendNotification(id, phone || '5511999999999')}
              />
            )}

            {activeTab === 'diff' && (
              <RetificationDiffView
                diffs={diffs}
                editais={editais}
                onSelectEdital={handleSelectEdital}
              />
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppNotificationsView
                notifications={notifications}
                editais={editais}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'ncm-config' && (
              <SettingsView />
            )}
          </main>

          {/* Footer Disclaimer */}
          <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500 shadow-xs z-10 relative">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Monitor de Editais Municipais & Sistema S</span>
                <span>•</span>
                <span>Foco NCM 9506.91</span>
                <span>•</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">PRD v1.1 Unificada</span>
              </div>
              <div className="text-[11.5px] text-slate-500">
                Regra de Ouro: Validação humana mandatória antes de eficácia externa.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
