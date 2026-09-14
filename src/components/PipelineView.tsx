import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Columns3,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Table2,
  Target,
} from 'lucide-react';
import { apiClient, assertOk } from '../apiClient';
import type { PipelineColumn, PipelineItem, PipelineKpis, PipelineViewMode } from '../types/pipeline';
import {
  COLUMN_COLORS,
  PIPELINE_COLUMN_META,
  displayPipelineColumn,
  formatPipelineCurrency,
  formatPipelineDate,
  shortPncpCode,
} from '../types/pipeline';
import { PipelineKpis as PipelineKpisBar } from './pipeline/PipelineKpis';
import { PipelineKanban } from './pipeline/PipelineKanban';
import { PipelineTable } from './pipeline/PipelineTable';
import { PipelineImportModal } from './pipeline/PipelineImportModal';

function getViewFromUrl(): PipelineViewMode {
  if (typeof window === 'undefined') return 'kanban';
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'list' || view === 'table' ? view : 'kanban';
}

function getArchivedFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('arquivadas') === '1';
}

function getSearchFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('q') ?? '';
}

interface PipelineViewProps {
  onNavigateContratacoes?: () => void;
  onOpenContratacao?: (contratacaoId: string) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  onNavigateContratacoes,
  onOpenContratacao,
}) => {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [kpis, setKpis] = useState<PipelineKpis>({
    total: 0,
    ativas: 0,
    emDisputa: 0,
    homologadas: 0,
    perdidas: 0,
    valorPipeline: 0,
  });
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PipelineViewMode>(getViewFromUrl());
  const [showArchived, setShowArchived] = useState(getArchivedFromUrl());
  const [search, setSearch] = useState(getSearchFromUrl());
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<PipelineItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const syncUrl = useCallback((next: { view?: PipelineViewMode; arquivadas?: boolean; q?: string }) => {
    const url = new URL(window.location.href);
    if (next.view) url.searchParams.set('view', next.view);
    if (next.arquivadas != null) {
      if (next.arquivadas) url.searchParams.set('arquivadas', '1');
      else url.searchParams.delete('arquivadas');
    }
    if (next.q != null) {
      if (next.q) url.searchParams.set('q', next.q);
      else url.searchParams.delete('q');
    }
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '500',
        arquivadas: 'all',
      });
      if (search.trim()) params.set('q', search.trim());
      const res = await apiClient(`/api/pipeline?${params.toString()}`);
      await assertOk(res);
      const body = await res.json();
      const all: PipelineItem[] = body.data ?? [];
      setArchivedCount(body.archivedCount ?? all.filter((i) => i.arquivada).length);
      const filtered = all.filter((item) => item.arquivada === showArchived);
      const q = search.trim().toLowerCase();
      const visible = q
        ? filtered.filter(
            (item) =>
              item.numero_controle_pncp.toLowerCase().includes(q) ||
              (item.orgao_razao_social?.toLowerCase().includes(q) ?? false) ||
              (item.objeto_compra?.toLowerCase().includes(q) ?? false),
          )
        : filtered;
      setItems(visible);
      setKpis(
        body.kpis ?? {
          total: visible.length,
          ativas: 0,
          emDisputa: 0,
          homologadas: 0,
          perdidas: 0,
          valorPipeline: 0,
        },
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pipeline');
    } finally {
      setLoading(false);
    }
  }, [search, showArchived]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const isEmpty = items.length === 0;

  const updateStatus = async (item: PipelineItem, column: PipelineColumn) => {
    if (displayPipelineColumn(item) === column) return;
    setActionLoading(true);
    try {
      const res = await apiClient(`/api/pipeline/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column }),
      });
      await assertOk(res);
      await fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setActionLoading(false);
      setDraggingId(null);
      setDraggingItem(null);
    }
  };

  const handleArchive = async (item: PipelineItem) => {
    setOpenMenuId(null);
    setActionLoading(true);
    try {
      const res = await apiClient(`/api/pipeline/${item.id}/arquivar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivada: !item.arquivada }),
      });
      await assertOk(res);
      await fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient(`/api/pipeline/${id}`, { method: 'DELETE' });
      await assertOk(res);
      setConfirmRemoveId(null);
      await fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImport = async (numeroControlePncp: string) => {
    setImportLoading(true);
    setError(null);
    try {
      const res = await apiClient('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_controle_pncp: numeroControlePncp }),
      });
      if (res.status === 409) {
        setImportOpen(false);
        await fetchItems();
        return;
      }
      await assertOk(res);
      setImportOpen(false);
      await fetchItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não consegui importar esse processo.');
    } finally {
      setImportLoading(false);
    }
  };

  const listCards = useMemo(() => items, [items]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando suas licitações…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
          Monitor · Licitações · Pipeline
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Suas licitações em movimento</h1>
        <p className="text-sm text-slate-600">
          Licitações em curso, da data mais próxima pra mais distante. Arraste cards entre colunas para mudar status.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <PipelineKpisBar kpis={kpis} />

      <section className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar por código, órgão ou objeto…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              syncUrl({ q: e.target.value });
            }}
          />
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
            showArchived
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          onClick={() => {
            const next = !showArchived;
            setShowArchived(next);
            syncUrl({ arquivadas: next });
          }}
        >
          <Archive className="w-4 h-4" />
          {showArchived ? 'Ver pipeline' : 'Arquivadas'}
          {!showArchived && archivedCount > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {archivedCount}
            </span>
          ) : null}
        </button>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {([
            ['kanban', Columns3, 'Kanban'],
            ['list', LayoutGrid, 'Cards'],
            ['table', Table2, 'Tabela'],
          ] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                view === mode ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => {
                setView(mode);
                syncUrl({ view: mode });
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50"
          onClick={() => setImportOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Importar por PNCP
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          onClick={() => onNavigateContratacoes?.()}
        >
          <Target className="w-4 h-4" />
          Buscar oportunidades
        </button>
      </section>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <Target className="w-9 h-9 mx-auto text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-800">
            {search ? 'Nenhuma licitação bate com a busca' : 'Você ainda não salvou nenhuma licitação'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {search
              ? 'Tente outro termo ou limpe a busca.'
              : 'Vá em Contratações PNCP e clique em Participar para trazer pra cá e acompanhar o pipeline.'}
          </p>
          {!search ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
              onClick={() => onNavigateContratacoes?.()}
            >
              <Target className="w-4 h-4" />
              Buscar oportunidades
            </button>
          ) : null}
        </div>
      ) : null}

      {!isEmpty && view === 'kanban' ? (
        <PipelineKanban
          items={items}
          draggingId={draggingId}
          openMenuId={openMenuId}
          onDragStart={(item) => (e) => {
            setDraggingId(item.id);
            setDraggingItem(item);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDraggingItem(null);
          }}
          onDrop={(column) => async (e) => {
            e.preventDefault();
            if (draggingItem) await updateStatus(draggingItem, column);
          }}
          onMenuToggle={(id) => setOpenMenuId((prev) => (prev === id ? null : id))}
          onArchive={handleArchive}
          onRemove={(item) => setConfirmRemoveId(item.id)}
        />
      ) : null}

      {!isEmpty && view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listCards.map((item) => {
            const col = displayPipelineColumn(item);
            const meta = PIPELINE_COLUMN_META.find((c) => c.key === col);
            const accent = COLUMN_COLORS[meta?.semantic ?? 'neutral'];
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                style={{ borderTopWidth: 3, borderTopColor: accent }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {shortPncpCode(item.numero_controle_pncp)}
                    </span>
                    <span
                      className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {meta?.label}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-800 line-clamp-3">{item.objeto_compra ?? 'Sem descrição'}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="text-slate-400">Órgão</dt>
                    <dd className="font-medium truncate">{item.orgao_razao_social ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Encerramento</dt>
                    <dd className="font-medium">{formatPipelineDate(item.data_encerramento_proposta)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Valor</dt>
                    <dd className="font-medium">{formatPipelineCurrency(item.valor_total_estimado)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">UF · Portal</dt>
                    <dd className="font-medium">
                      {item.uf_sigla ?? '—'} · {item.portal}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs hover:bg-slate-50"
                    onClick={() => handleArchive(item)}
                  >
                    {item.arquivada ? 'Restaurar' : 'Arquivar'}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1.5 rounded-lg border border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                    onClick={() => setConfirmRemoveId(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!isEmpty && view === 'table' ? (
        <PipelineTable
          items={items}
          onArchive={handleArchive}
          onRemove={(item) => setConfirmRemoveId(item.id)}
          onOpenContratacao={onOpenContratacao}
        />
      ) : null}

      {actionLoading ? (
        <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs flex items-center gap-2 shadow-lg">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Salvando…
        </div>
      ) : null}

      <PipelineImportModal
        open={importOpen}
        loading={importLoading}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      {confirmRemoveId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Remover licitação</h3>
            <p className="text-sm text-slate-600">
              Tem certeza que deseja remover esta licitação? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm hover:bg-slate-100"
                onClick={() => setConfirmRemoveId(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
                onClick={() => handleRemove(confirmRemoveId)}
                disabled={actionLoading}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
