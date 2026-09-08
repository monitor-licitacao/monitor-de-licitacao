import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RotateCcw, AlertTriangle, Inbox, RefreshCw, X } from 'lucide-react';
import { MuralCardMVP, StatusFamily, STATUS_FAMILIES, STATUS_FAMILY_LABELS } from '../../types/mural';
import { MuralCard } from './MuralCard';
import { apiClient, assertOk } from '../../apiClient';

interface MuralCardsViewProps {
  onOpenDetail: (codigo: string) => void;
}

export const MuralCardsView: React.FC<MuralCardsViewProps> = ({ onOpenDetail }) => {
  const [cards, setCards] = useState<MuralCardMVP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (selectedFamily !== 'ALL') params.append('family', selectedFamily);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const url = `/api/mural/cards${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiClient(url);
      await assertOk(res);
      const data = await res.json();
      setCards(data.items || []);
    } catch (err: any) {
      console.error('[Mural Fetch Error]:', err);
      setErrorMessage(err.message || 'Não foi possível carregar o mural');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFamily, selectedStatus, searchTerm]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedFamily('ALL');
    setSelectedStatus('ALL');
  };

  const hasActiveFilters = searchTerm.trim().length > 0 || selectedFamily !== 'ALL' || selectedStatus !== 'ALL';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mural de Licitações
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Visualização consolidada de processos e chamamentos públicos do Sistema S e compras públicas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCards}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shadow-2xs min-h-11"
            aria-label="Atualizar lista de processos do mural"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <label htmlFor="mural-search-input" className="sr-only">
              Buscar processos
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                id="mural-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número do processo, código, unidade ou objeto..."
                className="w-full pl-10 pr-10 py-2.5 text-xs rounded-lg border border-slate-300 bg-white placeholder-slate-400 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-11"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  aria-label="Limpar termo de busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Family Filter */}
          <div className="md:col-span-4">
            <label htmlFor="mural-family-filter" className="sr-only">
              Filtrar por modalidade ou família de status
            </label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <select
                id="mural-family-filter"
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-11"
              >
                <option value="ALL">Todas as modalidades / famílias</option>
                {STATUS_FAMILIES.map((fam) => (
                  <option key={fam} value={fam}>
                    {STATUS_FAMILY_LABELS[fam]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear filters button */}
          <div className="md:col-span-2 flex items-center">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors min-h-11 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar filtros</span>
              </button>
            ) : (
              <div className="text-xs text-slate-400 px-2 py-2">
                {!isLoading && `${cards.length} ${cards.length === 1 ? 'processo' : 'processos'}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Loading / Error / Empty / Grid */}
      {isLoading ? (
        /* Loading Skeleton: 6 cards */
        <div
          role="status"
          aria-label="Carregando processos do mural"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs animate-pulse flex flex-col justify-between h-64"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-24 h-5 bg-slate-200 rounded-md" />
                  <div className="w-28 h-4 bg-slate-100 rounded-md" />
                </div>
                <div className="w-3/4 h-6 bg-slate-200 rounded-md mb-2" />
                <div className="w-1/2 h-4 bg-slate-100 rounded-md mb-4" />
                <div className="space-y-2 mb-4">
                  <div className="w-full h-3 bg-slate-100 rounded-md" />
                  <div className="w-4/5 h-3 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="w-16 h-4 bg-slate-100 rounded-md" />
                <div className="w-24 h-8 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
          <span className="sr-only">Carregando lista de editais...</span>
        </div>
      ) : errorMessage ? (
        /* Error State */
        <div className="p-10 bg-white rounded-xl border border-rose-200 shadow-2xs text-center flex flex-col items-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2">
            Não foi possível carregar o mural
          </h2>
          <p className="text-xs text-slate-600 mb-6 max-w-sm">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={fetchCards}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 min-h-11 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : cards.length === 0 ? (
        /* Empty State */
        <div className="p-12 bg-white rounded-xl border border-slate-200 shadow-2xs text-center flex flex-col items-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2">
            {hasActiveFilters ? 'Nenhum processo neste filtro' : 'Nenhum processo no mural ainda'}
          </h2>
          <p className="text-xs text-slate-500 mb-6 max-w-sm">
            {hasActiveFilters
              ? 'Tente ajustar os termos de busca ou remover os filtros aplicados para ver mais resultados.'
              : 'Novos processos sincronizados do Sistema S e ComprasNet aparecerão aqui assim que coletados.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 min-h-11 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => (
            <MuralCard
              key={card.codigo}
              card={card}
              onSelect={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
};
