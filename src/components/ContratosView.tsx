import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { apiClient, assertOk } from '../apiClient';
import type {
  ContractAnalysis,
  ContratoTab,
  DashboardData,
} from '../types/contratos';
import { ContratoCard } from './contratos/ContratoCard';
import { ContratoDetailView } from './contratos/ContratoDetailView';
import { ContratoHero } from './contratos/ContratoHero';
import { ContratoManualModal } from './contratos/ContratoManualModal';
import type { GrupoFilter } from './contratacoes/ContratacaoItensPanel';

const TABS: { id: ContratoTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Visão geral', icon: <FileText className="w-4 h-4" /> },
  { id: 'contratos', label: 'Meus contratos', icon: <FileText className="w-4 h-4" /> },
  { id: 'atas', label: 'Minhas atas', icon: <Layers className="w-4 h-4" /> },
  { id: 'criticos', label: 'Precisam de ação', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'vencendo', label: 'Vencendo logo', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'vencidos', label: 'Vencidos', icon: <AlertTriangle className="w-4 h-4" /> },
];

function getTabFromUrl(): ContratoTab {
  if (typeof window === 'undefined') return 'dashboard';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((t) => t.id === tab) ? (tab as ContratoTab) : 'dashboard';
}

interface ContratosViewProps {
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
}

function getModalPrefillFromUrl(): {
  contratacaoId: string | null;
  openModal: boolean;
  grupoFilter: GrupoFilter;
  itemNumero: number | null;
} {
  if (typeof window === 'undefined') {
    return { contratacaoId: null, openModal: false, grupoFilter: 'ALL', itemNumero: null };
  }
  const params = new URLSearchParams(window.location.search);
  const itemRaw = params.get('item');
  const itemNumero = itemRaw ? Number.parseInt(itemRaw, 10) : null;
  return {
    contratacaoId: params.get('contratacaoId'),
    openModal: params.get('novo') === '1',
    grupoFilter: (params.get('grupo') ?? 'ALL') as GrupoFilter,
    itemNumero: Number.isFinite(itemNumero) ? itemNumero : null,
  };
}

export const ContratosView: React.FC<ContratosViewProps> = ({
  selectedId: propId,
  onSelectId,
}) => {
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = propId !== undefined ? propId : internalId;
  const setSelected = (id: string | null) => {
    if (onSelectId) onSelectId(id);
    else setInternalId(id);
  };

  const [tab, setTab] = useState<ContratoTab>(getTabFromUrl());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [listItems, setListItems] = useState<ContractAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialPrefill = getModalPrefillFromUrl();
  const [modalOpen, setModalOpen] = useState(initialPrefill.openModal);
  const [prefillContratacaoId, setPrefillContratacaoId] = useState<string | null>(
    initialPrefill.contratacaoId,
  );
  const [prefillGrupoFilter, setPrefillGrupoFilter] = useState<GrupoFilter>(initialPrefill.grupoFilter);
  const [prefillItemNumero, setPrefillItemNumero] = useState<number | null>(initialPrefill.itemNumero);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderBy, setOrderBy] = useState('health_score');

  const setTabAndUrl = (next: ContratoTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  };

  const fetchDashboard = useCallback(async () => {
    const res = await apiClient('/api/contratos/dashboard');
    await assertOk(res);
    const body = await res.json();
    setDashboard(body.data);
  }, []);

  const fetchList = useCallback(async () => {
    const params = new URLSearchParams({ page: '1', limit: '100', orderBy });
    if (statusFilter) params.set('status', statusFilter);
    if (tab === 'vencendo') params.set('vencimento', 'vencendo');
    if (tab === 'vencidos') params.set('vencimento', 'vencido');
    if (tab === 'atas') params.set('tipo', 'ata');
    if (tab === 'contratos') params.set('tipo', 'contrato');
    const res = await apiClient(`/api/contratos?${params.toString()}`);
    await assertOk(res);
    const body = await res.json();
    setListItems(body.data ?? []);
  }, [statusFilter, orderBy, tab]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchDashboard();
      if (tab !== 'dashboard') await fetchList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, fetchList, tab]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === 'dashboard') return;
    void fetchList();
  }, [tab, fetchList]);

  const tabList = useMemo((): ContractAnalysis[] => {
    if (!dashboard) return listItems;
    switch (tab) {
      case 'criticos':
        return dashboard.contratos_precisam_acao ?? dashboard.contratos_criticos;
      case 'vencendo':
        return dashboard.contratos_vencendo;
      case 'vencidos':
        return listItems;
      case 'atas':
        return dashboard.atas.length ? dashboard.atas : listItems;
      case 'contratos':
        return dashboard.contratos.length ? dashboard.contratos : listItems;
      default:
        return listItems;
    }
  }, [dashboard, listItems, tab]);

  const handleSync = async () => {
    try {
      const res = await apiClient('/api/contratos/sync', { method: 'POST' });
      await assertOk(res);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar PNCP');
    }
  };

  if (selectedId) {
    return (
      <ContratoDetailView
        contratoId={selectedId}
        onBack={() => setSelected(null)}
      />
    );
  }

  const empty = !loading && dashboard && dashboard.resumo.total_contratos + dashboard.resumo.total_atas === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Monitor · Contratos · Ativos</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Seus contratos em um lugar só</h1>
          <p className="text-sm text-slate-500 mt-1">
            Veja como cada contrato está indo, o que pede atenção e onde aplicar seu esforço primeiro
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Sync PNCP
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Novo contrato
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabAndUrl(t.id)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-700 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : tab === 'dashboard' && dashboard ? (
        empty ? (
          <div className="text-center py-16 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-800">Ainda sem contratos pra mostrar</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Quando seus contratos forem coletados do PNCP, aparecem aqui automaticamente, sem precisar configurar nada.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Novo contrato
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <ContratoHero dashboard={dashboard} />
            {dashboard.acoes_prioritarias.length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase text-slate-500 mb-3">O que fazer agora</h2>
                <ul className="space-y-2">
                  {dashboard.acoes_prioritarias.slice(0, 5).map((a) => (
                    <li key={a.id} className="p-3 rounded-lg border border-slate-200 bg-white text-sm">
                      <span className="text-xs font-bold uppercase text-rose-600">{a.prioridade}</span>
                      <p className="font-medium text-slate-800">{a.titulo}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(dashboard.contratos_precisam_acao?.length ?? dashboard.contratos_criticos.length) > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase text-rose-600">Precisam de ação agora</h2>
                {(dashboard.contratos_precisam_acao ?? dashboard.contratos_criticos).map((a) => (
                  <ContratoCard key={a.contrato.id} analysis={a} onViewDetails={setSelected} />
                ))}
              </section>
            )}
            {dashboard.contratos.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase text-slate-500">Todos os contratos</h2>
                {dashboard.contratos.slice(0, 5).map((a) => (
                  <ContratoCard key={a.contrato.id} analysis={a} onViewDetails={setSelected} />
                ))}
              </section>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Toda a saúde</option>
              <option value="saudavel">Sem problemas</option>
              <option value="atencao">Olhar com carinho</option>
              <option value="critico">Precisam de ação</option>
            </select>
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
            >
              <option value="health_score">por saúde</option>
              <option value="vencimento">por vencimento</option>
              <option value="valor">por valor</option>
              <option value="risco">por risco</option>
            </select>
          </div>
          {tabList.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">Nenhum contrato pra mostrar nesta aba.</p>
          ) : (
            tabList.map((a) => (
              <ContratoCard key={a.contrato.id} analysis={a} onViewDetails={setSelected} />
            ))
          )}
        </div>
      )}

      <ContratoManualModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setPrefillContratacaoId(null);
          setPrefillGrupoFilter('ALL');
          setPrefillItemNumero(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('contratacaoId');
          url.searchParams.delete('novo');
          url.searchParams.delete('grupo');
          url.searchParams.delete('item');
          window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
        }}
        preselectedContratacaoId={prefillContratacaoId}
        preselectedGrupoFilter={prefillGrupoFilter}
        preselectedItemNumero={prefillItemNumero}
        onCreated={(id) => {
          setSelected(id);
          void fetchAll();
        }}
      />
    </div>
  );
};
