import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  Search,
  Plus,
  Edit3,
  PowerOff,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Info,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  StatusFamily,
  STATUS_FAMILIES,
  STATUS_FAMILY_LABELS,
  StatusCatalogItem,
  StatusCatalogCountsResponse
} from '../../types/mural';
import { StatusBadge } from './StatusBadge';
import { HonestField } from './HonestField';
import { apiClient, assertOk } from '../../apiClient';
import { replaceById } from '../../utils/collectionUtils';

export const StatusCatalogView: React.FC = () => {
  const [activeFamily, setActiveFamily] = useState<StatusFamily>('PregaoEletronico');
  const [counts, setCounts] = useState<StatusCatalogCountsResponse | null>(null);
  const [items, setItems] = useState<StatusCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Edit Drawer state
  const [editingItem, setEditingItem] = useState<StatusCatalogItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLabelError, setEditLabelError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createActive, setCreateActive] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  // Deactivate confirmation dialog state
  const [deactivatingItem, setDeactivatingItem] = useState<StatusCatalogItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Drawer ref for Escape key & focus management
  const drawerRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Fetch counts from /api/status-catalog/counts
  const fetchCounts = async () => {
    try {
      const res = await apiClient('/api/status-catalog/counts');
      if (res.ok) {
        const data: StatusCatalogCountsResponse = await res.json();
        setCounts(data);
      }
    } catch (err) {
      console.error('[Status Catalog Counts Error]:', err);
    }
  };

  // Fetch items for the active family and search
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.append('family', activeFamily);
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const res = await apiClient(`/api/status-catalog?${params.toString()}`);
      await assertOk(res);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      console.error('[Status Catalog List Error]:', err);
      setErrorMessage(err.message || 'Não foi possível carregar os itens do catálogo');
    } finally {
      setIsLoading(false);
    }
  }, [activeFamily, searchTerm]);

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle opening Edit Drawer
  const handleOpenEdit = (item: StatusCatalogItem) => {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditDescription(item.description || '');
    setEditActive(item.active);
    setEditLabelError(null);
  };

  // Focus label input when drawer opens
  useEffect(() => {
    if (editingItem && labelInputRef.current) {
      labelInputRef.current.focus();
    }
  }, [editingItem]);

  // Handle ESC key for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingItem) setEditingItem(null);
        if (isCreateOpen) setIsCreateOpen(false);
        if (deactivatingItem) setDeactivatingItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingItem, isCreateOpen, deactivatingItem]);

  // Save Edit (PUT /api/status-catalog/:id)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editLabel.trim()) {
      setEditLabelError('Informe o label');
      return;
    }

    setIsSavingEdit(true);
    setEditLabelError(null);

    try {
      const res = await apiClient(`/api/status-catalog/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editLabel.trim(),
          description: editDescription.trim() || null,
          active: editActive
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao atualizar status');
      }

      const updated: StatusCatalogItem = await res.json();
      setItems((prev) => replaceById(prev, updated.id, updated));
      setEditingItem(null);
      showToast('Status atualizado com sucesso!');
      fetchCounts();
    } catch (err: any) {
      setEditLabelError(err.message || 'Falha ao salvar alterações');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save Create (POST /api/status-catalog)
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCode.trim()) {
      setCreateError('Código é obrigatório.');
      return;
    }
    if (!createLabel.trim()) {
      setCreateError('Informe o label.');
      return;
    }

    setIsSavingCreate(true);
    setCreateError(null);

    try {
      const res = await apiClient('/api/status-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family: activeFamily,
          code: createCode.trim().toUpperCase().replace(/\s+/g, '_'),
          label: createLabel.trim(),
          description: createDescription.trim() || null,
          active: createActive
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao cadastrar status');
      }

      const created: StatusCatalogItem = await res.json();
      setItems((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setCreateCode('');
      setCreateLabel('');
      setCreateDescription('');
      setCreateActive(true);
      showToast('Status cadastrado com sucesso!');
      fetchCounts();
    } catch (err: any) {
      setCreateError(err.message || 'Código não existe no catálogo ou já existe.');
    } finally {
      setIsSavingCreate(false);
    }
  };

  // Confirm Deactivate (DELETE /api/status-catalog/:id)
  const handleConfirmDeactivate = async () => {
    if (!deactivatingItem) return;

    setIsDeactivating(true);
    try {
      const res = await apiClient(`/api/status-catalog/${deactivatingItem.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao desativar status');
      }

      const result = await res.json();
      const updatedItem = result.item || { ...deactivatingItem, active: false };

      setItems((prev) => replaceById(prev, deactivatingItem.id, updatedItem));
      setDeactivatingItem(null);
      showToast('Status desativado com sucesso!');
      fetchCounts();
    } catch (err: any) {
      showToast(err.message || 'Falha ao desativar status', 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  // Quick toggle active state
  const handleToggleActiveQuick = async (item: StatusCatalogItem) => {
    if (item.active) {
      // Opening confirmation dialog before deactivating
      setDeactivatingItem(item);
      return;
    }

    // Re-activating does not require confirmation dialog
    try {
      const res = await apiClient(`/api/status-catalog/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true })
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => replaceById(prev, item.id, updated));
        showToast('Status reativado com sucesso!');
        fetchCounts();
      }
    } catch (err) {
      showToast('Erro ao reativar status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in shadow-xl">
          <div
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border shadow-lg ${
              toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header section with title and "Novo status" CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <span>Catálogo de Status de Licitações</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gerencie os rótulos visuais e descrições dos códigos estáveis mapeados nas 5 famílias contratuais
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shadow-2xs min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Novo status</span>
        </button>
      </div>

      {/* 1. Tabs for 5 Families with counts */}
      <div
        role="tablist"
        aria-label="Famílias do catálogo de status"
        className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto"
      >
        {STATUS_FAMILIES.map((family) => {
          const isActive = activeFamily === family;
          const familyCountInfo = counts?.families?.[family];
          const countTotal = familyCountInfo ? familyCountInfo.total : undefined;

          return (
            <button
              key={family}
              id={`tab-${family}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${family}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                setActiveFamily(family);
                setSearchTerm('');
              }}
              className={`py-3 px-4 font-semibold text-xs border-b-2 transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{STATUS_FAMILY_LABELS[family]}</span>
              {countTotal !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {countTotal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar inside Family */}
      <div className="bg-white p-4 rounded-b-xl border border-t-0 border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por código ou label nesta família..."
              className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[44px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                aria-label="Limpar filtro de busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2 self-end sm:self-auto">
            <span>Família ativa:</span>
            <span className="font-semibold text-slate-800">{STATUS_FAMILY_LABELS[activeFamily]}</span>
          </div>
        </div>
      </div>

      {/* 2. Table: code · label · description · active · actions */}
      <div
        id={`panel-${activeFamily}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeFamily}`}
        className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
      >
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-slate-200 rounded-md w-1/4 mb-4" />
            <div className="h-10 bg-slate-100 rounded-md" />
            <div className="h-10 bg-slate-100 rounded-md" />
            <div className="h-10 bg-slate-100 rounded-md" />
          </div>
        ) : errorMessage ? (
          <div className="p-8 text-center">
            <p className="text-xs text-rose-600 mb-3">{errorMessage}</p>
            <button
              type="button"
              onClick={fetchItems}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 min-h-[44px]"
            >
              Tentar novamente
            </button>
          </div>
        ) : items.length === 0 ? (
          searchTerm ? (
            <div className="p-12 text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-slate-800 mb-1">
                Nenhum status com esse termo
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Não encontramos correspondência para &quot;{searchTerm}&quot; na família {STATUS_FAMILY_LABELS[activeFamily]}.
              </p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar busca</span>
              </button>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-slate-800 mb-1">
                Nenhum status nesta família
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Não existem status cadastrados para a família {STATUS_FAMILY_LABELS[activeFamily]}.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar primeiro status</span>
              </button>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 w-44">Código (Estável)</th>
                  <th scope="col" className="py-3 px-4 w-52">Label (Exibição)</th>
                  <th scope="col" className="py-3 px-4">Descrição</th>
                  <th scope="col" className="py-3 px-3 w-28 text-center">Ativo</th>
                  <th scope="col" className="py-3 px-4 w-36 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* code (mono, read-only) */}
                    <td className="py-3.5 px-4">
                      <code className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        {item.code}
                      </code>
                    </td>

                    {/* label */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          family={item.family}
                          code={item.code}
                          label={item.label}
                          active={item.active}
                          size="sm"
                        />
                      </div>
                    </td>

                    {/* descrição */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="line-clamp-2" title={item.description || undefined}>
                        <HonestField value={item.description} label="Descrição do status" />
                      </span>
                    </td>

                    {/* ativo toggle switch */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.active}
                        aria-label={`Status ${item.label} está ${item.active ? 'ativo' : 'inativo'}. Clique para alterar.`}
                        onClick={() => handleToggleActiveQuick(item)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                          item.active ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            item.active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>

                    {/* ações: Editar · Desativar */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors min-h-[36px]"
                          aria-label={`Editar status ${item.label}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {item.active && (
                          <button
                            type="button"
                            onClick={() => setDeactivatingItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors min-h-[36px]"
                            aria-label={`Desativar status ${item.label}`}
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            <span>Desativar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. EDIT DRAWER (Right flyout) */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-edit-title"
          className="fixed inset-0 z-50 overflow-hidden flex justify-end"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setEditingItem(null)}
          />

          {/* Drawer content */}
          <div
            ref={drawerRef}
            className="relative w-full max-w-md bg-white shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 id="drawer-edit-title" className="text-base font-bold text-slate-900">
                  Editar Status do Catálogo
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Família: {STATUS_FAMILY_LABELS[editingItem.family]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fechar gaveta de edição"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form */}
            <form onSubmit={handleSaveEdit} className="p-6 flex-1 overflow-y-auto space-y-5 text-xs">
              {/* Code (disabled / read-only) */}
              <div>
                <label htmlFor="edit-status-code" className="block font-semibold text-slate-700 mb-1">
                  Código (Imutável)
                </label>
                <input
                  id="edit-status-code"
                  type="text"
                  disabled
                  value={editingItem.code}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-100 font-mono text-slate-600 cursor-not-allowed text-xs min-h-[44px]"
                  title="O código é estável e não pode ser alterado"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  O código interno é imutável para manter a integridade dos processos existentes.
                </p>
              </div>

              {/* Label (required) */}
              <div>
                <label htmlFor="edit-status-label" className="block font-semibold text-slate-700 mb-1">
                  Label de Exibição <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={labelInputRef}
                  id="edit-status-label"
                  type="text"
                  value={editLabel}
                  onChange={(e) => {
                    setEditLabel(e.target.value);
                    if (editLabelError) setEditLabelError(null);
                  }}
                  aria-describedby={editLabelError ? 'edit-label-error' : undefined}
                  className={`w-full px-3 py-2.5 rounded-lg border text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px] ${
                    editLabelError ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                  }`}
                  placeholder="Nome exibido nos badges do mural"
                />
                {editLabelError && (
                  <p id="edit-label-error" className="text-rose-600 text-[11px] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{editLabelError}</span>
                  </p>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="edit-status-desc" className="block font-semibold text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  id="edit-status-desc"
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalhes sobre a fase do processo em que esse status é aplicado..."
                />
              </div>

              {/* Ativo toggle */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block font-semibold text-slate-800">Status Ativo</span>
                  <span className="text-[11px] text-slate-500">
                    Se inativo, deixará de ser selecionável em novos filtros
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editActive}
                  onClick={() => setEditActive(!editActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    editActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      editActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Preview badge */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 block mb-1.5">
                  Pré-visualização do badge no mural:
                </span>
                <StatusBadge
                  family={editingItem.family}
                  code={editingItem.code}
                  label={editLabel || 'Prévia'}
                  active={editActive}
                  size="md"
                />
              </div>

              {/* Drawer actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 min-h-[44px] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 min-h-[44px] transition-colors flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {isSavingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CREATE MODAL ("Novo status") */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-title"
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs"
        >
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 id="modal-create-title" className="text-base font-bold text-slate-900">
                  Novo Status de Licitação
                </h3>
                <p className="text-xs text-slate-500">
                  Família: {STATUS_FAMILY_LABELS[activeFamily]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCreate} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Code */}
              <div>
                <label htmlFor="create-status-code" className="block font-semibold text-slate-700 mb-1">
                  Código Estável <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-status-code"
                  type="text"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  placeholder="EX: EM_ANALISE_TECNICA"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Use maiúsculas e sublinhados (ex: HOMOLOGADO, EM_DISPUTA).
                </p>
              </div>

              {/* Label */}
              <div>
                <label htmlFor="create-status-label" className="block font-semibold text-slate-700 mb-1">
                  Label de Exibição <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-status-label"
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="Ex: Em Análise Técnica"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="create-status-desc" className="block font-semibold text-slate-700 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  id="create-status-desc"
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Explicação sobre esta etapa..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 min-h-[44px] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCreate}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 min-h-[44px] transition-colors flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {isSavingCreate && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Cadastrar status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DEACTIVATE CONFIRMATION DIALOG */}
      {deactivatingItem && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-deactivate-title"
          aria-describedby="dialog-deactivate-desc"
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs"
        >
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 id="dialog-deactivate-title" className="text-base font-bold text-slate-900 mb-2">
              Desativar status &quot;{deactivatingItem.label}&quot;?
            </h3>

            <p id="dialog-deactivate-desc" className="text-xs text-slate-600 mb-6 leading-relaxed">
              Processos que utilizam este status continuarão exibindo o histórico com o badge de inativo. O status deixará de aparecer em novos cadastros. Desativar mesmo assim?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeactivatingItem(null)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 min-h-[44px] transition-colors flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeactivating}
                onClick={handleConfirmDeactivate}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 min-h-[44px] transition-colors flex-1 flex items-center justify-center gap-1.5"
              >
                {isDeactivating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Desativar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
