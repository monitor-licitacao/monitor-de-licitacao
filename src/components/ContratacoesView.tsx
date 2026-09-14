import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { apiClient, assertOk } from '../apiClient';
import type { ContratacaoListItem } from '../types/contratacoes';
import { ContratacaoDetailView } from './contratacoes/ContratacaoDetailView';
import type { RegisterContratoPrefill } from './contratacoes/ContratacaoItensPanel';

function formatCurrency(value: number | null): string {
  if (value == null || value === 0) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

interface ContratacoesViewProps {
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  onRegisterContrato?: (prefill: RegisterContratoPrefill) => void;
  onParticipar?: (contratacaoId: string) => void;
}

export const ContratacoesView: React.FC<ContratacoesViewProps> = ({
  selectedId: propId,
  onSelectId,
  onRegisterContrato,
  onParticipar,
}) => {
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = propId !== undefined ? propId : internalId;

  const [items, setItems] = useState<ContratacaoListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSelected = (id: string | null) => {
    if (onSelectId) onSelectId(id);
    else setInternalId(id);
  };

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient('/api/contratacoes');
      await assertOk(res);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contratações');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.objeto?.toLowerCase().includes(q) ||
      item.numeroControlePncp.toLowerCase().includes(q) ||
      item.cnpjOrgao.includes(q)
    );
  });

  if (selectedId) {
    return (
      <ContratacaoDetailView
        contratacaoId={selectedId}
        onBack={() => setSelected(null)}
        onRegisterContrato={onRegisterContrato}
        onParticipar={onParticipar}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contratações PNCP</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tier 1 — detalhe no formato Mural (resumo, itens, anexos, histórico)
          </p>
        </div>
        <button
          type="button"
          onClick={fetchList}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Buscar objeto, controle PNCP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhuma contratação encontrada.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-slate-900 line-clamp-2">{item.objeto ?? 'Sem objeto'}</p>
                <span className="text-xs font-mono text-slate-500 shrink-0">{item.numeroControlePncp}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{item.uf ?? '—'}</span>
                <span>{formatCurrency(item.valorEstimado)}</span>
                <span>{item.pncpItemCount} itens</span>
                <span>{formatDate(item.dataPublicacao)}</span>
                {item.idCompra && <span className="font-mono">CG: {item.idCompra}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
