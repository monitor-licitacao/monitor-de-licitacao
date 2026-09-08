import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Hash,
  Mail,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderArchive,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trophy,
  ExternalLink
} from 'lucide-react';
import {
  MuralProcessDetail,
  MuralProcessItem,
  MuralProcessAnexo,
  MuralProcessHistorico
} from '../../types/mural';
import { StatusBadge } from './StatusBadge';
import { HonestField } from './HonestField';
import { CanonicalSourceAction } from './CanonicalSourceAction';
import {
  formatDateToBR,
  formatDateTimeToBR,
  formatCurrencyBRL
} from '../../utils/muralFormatters';
import { apiClient, assertOk } from '../../apiClient';

interface ProcessDetailViewProps {
  identifier: string; // codigo or numero_processo (e.g. "76" or "000010901-2/2026")
  onBack: () => void;
}

export const ProcessDetailView: React.FC<ProcessDetailViewProps> = ({
  identifier,
  onBack
}) => {
  const [detail, setDetail] = useState<MuralProcessDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tabs: 'itens' | 'anexos' | 'historico' (3 tabs only)
  const [activeTab, setActiveTab] = useState<'itens' | 'anexos' | 'historico'>('itens');

  // Resumo objeto expand/collapse
  const [isObjetoExpanded, setIsObjetoExpanded] = useState(false);

  // Expanded items in Itens table for ranking disclosure
  const [expandedItemNumbers, setExpandedItemNumbers] = useState<Set<number>>(new Set());

  // Download failure toast
  const [downloadErrorToast, setDownloadErrorToast] = useState<string | null>(null);

  const h1Ref = useRef<HTMLHeadingElement>(null);

  const fetchDetail = async () => {
    setIsLoading(true);
    setIsNotFound(false);
    setErrorMessage(null);

    try {
      const res = await apiClient(`/api/mural/processes/${encodeURIComponent(identifier)}`);
      if (res.status === 404) {
        setIsNotFound(true);
        return;
      }
      await assertOk(res);
      const data: MuralProcessDetail = await res.json();
      setDetail(data);
    } catch (err: any) {
      console.error('[Process Detail Fetch Error]:', err);
      setErrorMessage(err.message || 'Não foi possível carregar o processo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [identifier]);

  // Focus H1 upon successful load
  useEffect(() => {
    if (detail && h1Ref.current) {
      h1Ref.current.focus();
    }
  }, [detail]);

  const toggleItemRanking = (numeroItem: number) => {
    setExpandedItemNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(numeroItem)) {
        next.delete(numeroItem);
      } else {
        next.add(numeroItem);
      }
      return next;
    });
  };

  const handleDownloadAnexo = (anexo: MuralProcessAnexo) => {
    try {
      if (!anexo.url_download) {
        throw new Error('URL de download indisponível');
      }
      // Trigger download or open canonical file url
      window.open(anexo.url_download, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadErrorToast('Falha ao baixar. Tente de novo.');
      setTimeout(() => setDownloadErrorToast(null), 4000);
    }
  };

  // Group anexos by folder/grupo
  const groupedAnexos = React.useMemo<Record<string, MuralProcessAnexo[]>>(() => {
    if (!detail?.anexos) return {};
    const groups: Record<string, MuralProcessAnexo[]> = {};
    for (const anexo of detail.anexos) {
      const groupName = anexo.grupo || 'Outros Documentos';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(anexo);
    }
    return groups;
  }, [detail?.anexos]);

  // Loading State: Skeleton header + resumo + 3 rows
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Carregando detalhes do processo"
        className="max-w-6xl mx-auto p-6 space-y-6"
      >
        {/* Sticky header skeleton */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="w-32 h-6 bg-slate-200 rounded-md" />
            <div className="w-28 h-9 bg-slate-200 rounded-lg" />
          </div>
          <div className="w-2/3 h-8 bg-slate-300 rounded-md" />
          <div className="w-1/3 h-4 bg-slate-200 rounded-md" />
        </div>

        {/* Resumo skeleton */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3 animate-pulse">
          <div className="w-40 h-6 bg-slate-200 rounded-md mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full h-4 bg-slate-100 rounded-md" />
            <div className="w-full h-4 bg-slate-100 rounded-md" />
            <div className="w-full h-4 bg-slate-100 rounded-md" />
            <div className="w-full h-4 bg-slate-100 rounded-md" />
          </div>
        </div>

        {/* Rows skeleton */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3 animate-pulse">
          <div className="w-32 h-6 bg-slate-200 rounded-md mb-4" />
          <div className="h-10 bg-slate-100 rounded-md" />
          <div className="h-10 bg-slate-100 rounded-md" />
          <div className="h-10 bg-slate-100 rounded-md" />
        </div>
        <span className="sr-only">Carregando processo...</span>
      </div>
    );
  }

  // 404 State
  if (isNotFound) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-xl border border-slate-200 shadow-xs text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Processo não encontrado
        </h1>
        <p className="text-xs text-slate-600 mb-6 max-w-sm">
          O processo com identificador &quot;{identifier}&quot; não foi localizado no mural de licitações.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 min-h-11 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao mural</span>
        </button>
      </div>
    );
  }

  // Error State
  if (errorMessage || !detail) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-xl border border-rose-200 shadow-xs text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Não foi possível carregar o processo
        </h1>
        <p className="text-xs text-slate-600 mb-6 max-w-sm">
          {errorMessage || 'Ocorreu um erro inesperado ao consultar o servidor.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDetail}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 min-h-11 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 min-h-11 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao mural</span>
          </button>
        </div>
      </div>
    );
  }

  const { resumo } = detail;
  const isLinkConfirmed = Boolean(resumo.link_canonico && !resumo.link_canonico.includes('mock'));

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Toast de falha ao baixar anexo */}
      {downloadErrorToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-600 text-white rounded-lg shadow-lg text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>{downloadErrorToast}</span>
          </div>
        </div>
      )}

      {/* 1. Sticky Header v2 (mais magro) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
        <div className="max-w-6xl mx-auto px-6 py-3.5 space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Top row: Voltar · H1 numero_processo · status badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onBack}
                aria-label="Voltar para a listagem do mural de licitações"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg min-h-11 min-w-11 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Voltar</span>
              </button>

              <div className="h-5 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

              <h1
                ref={h1Ref}
                tabIndex={-1}
                className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight focus:outline-hidden"
              >
                <HonestField value={resumo.numero_processo} label="Número do processo" />
              </h1>

              <StatusBadge status={resumo.status_normalizado} size="md" />
            </div>

            {/* CTA Secundário: Abrir fonte */}
            <div>
              <CanonicalSourceAction
                url={resumo.link_canonico}
                fonteConfirmada={isLinkConfirmed}
                variant="header"
              />
            </div>
          </div>

          {/* Sublinha: unidade · codigo · modalidade (texto secundário) */}
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pl-1 sm:pl-12">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <HonestField value={resumo.unidade_compradora || resumo.unidade} label="Unidade compradora" />
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
              <HonestField value={resumo.codigo} label="Código do processo" />
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-600">
              <HonestField value={resumo.modalidade} label="Modalidade" />
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 2. Resumo = Definition List (Pares rótulo/valor em 2 col desktop / 1 mobile) */}
        <section
          aria-labelledby="resumo-heading"
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs"
        >
          <h2 id="resumo-heading" className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
            Resumo do Processo
          </h2>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs">
            {/* 1. edital */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Edital</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={resumo.edital} label="Edital" />
              </dd>
            </div>

            {/* 2. modalidade */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Modalidade</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={resumo.modalidade} label="Modalidade" />
              </dd>
            </div>

            {/* 3. fase */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Fase</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={resumo.fase} label="Fase" />
              </dd>
            </div>

            {/* 4. situação */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Situação</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={resumo.situacao} label="Situação" />
              </dd>
            </div>

            {/* 5. início propostas */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Início de Propostas</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={formatDateTimeToBR(resumo.inicio_propostas)} label="Início de propostas" />
              </dd>
            </div>

            {/* 6. término propostas */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Término de Propostas</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={formatDateTimeToBR(resumo.termino_propostas)} label="Término de propostas" />
              </dd>
            </div>

            {/* 7. homologação */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">Data de Homologação</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                <HonestField value={formatDateTimeToBR(resumo.data_homologacao)} label="Data de homologação" />
              </dd>
            </div>

            {/* 8. email */}
            <div className="flex flex-col py-1 border-b border-slate-50">
              <dt className="text-slate-500 font-medium">E-mail de Contato</dt>
              <dd className="font-semibold text-slate-800 mt-0.5">
                {resumo.email_contato ? (
                  <a
                    href={`mailto:${resumo.email_contato}`}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500"
                  >
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{resumo.email_contato}</span>
                  </a>
                ) : (
                  <HonestField value={null} label="E-mail de contato" />
                )}
              </dd>
            </div>

            {/* 9. objeto completo (clamp 6 linhas + Ver mais/Ver menos) */}
            <div className="md:col-span-2 pt-2">
              <dt className="text-slate-500 font-medium mb-1">Objeto Completo</dt>
              <dd className="text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <p className={!isObjetoExpanded ? 'line-clamp-6' : ''}>
                  <HonestField value={resumo.objeto} label="Objeto completo" />
                </p>
                {resumo.objeto && resumo.objeto.length > 280 && (
                  <button
                    type="button"
                    onClick={() => setIsObjetoExpanded(!isObjetoExpanded)}
                    aria-expanded={isObjetoExpanded}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 min-h-11"
                  >
                    <span>{isObjetoExpanded ? 'Ver menos' : 'Ver mais'}</span>
                    {isObjetoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* 3. Tabs (Itens · Anexos · Histórico) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Tab navigation */}
          <div
            role="tablist"
            aria-label="Seções do detalhe do processo"
            className="flex border-b border-slate-200 px-6 bg-slate-50/50"
          >
            <button
              id="tab-itens"
              role="tab"
              aria-selected={activeTab === 'itens'}
              aria-controls="panel-itens"
              tabIndex={activeTab === 'itens' ? 0 : -1}
              onClick={() => setActiveTab('itens')}
              className={`py-3.5 px-4 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 min-h-11 ${
                activeTab === 'itens'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Itens</span>
              {detail.itens && detail.itens.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {detail.itens.length}
                </span>
              )}
            </button>

            <button
              id="tab-anexos"
              role="tab"
              aria-selected={activeTab === 'anexos'}
              aria-controls="panel-anexos"
              tabIndex={activeTab === 'anexos' ? 0 : -1}
              onClick={() => setActiveTab('anexos')}
              className={`py-3.5 px-4 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 min-h-11 ${
                activeTab === 'anexos'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Anexos</span>
              {detail.anexos && detail.anexos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {detail.anexos.length}
                </span>
              )}
            </button>

            <button
              id="tab-historico"
              role="tab"
              aria-selected={activeTab === 'historico'}
              aria-controls="panel-historico"
              tabIndex={activeTab === 'historico' ? 0 : -1}
              onClick={() => setActiveTab('historico')}
              className={`py-3.5 px-4 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 min-h-11 ${
                activeTab === 'historico'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Histórico</span>
              {detail.historico && detail.historico.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {detail.historico.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="p-6">
            {/* TAB ITENS */}
            {activeTab === 'itens' && (
              <div
                id="panel-itens"
                role="tabpanel"
                aria-labelledby="tab-itens"
                className="space-y-4"
              >
                {/* Header dos Itens com chip de total SOMENTE se presente no payload (nunca somar no front) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Itens da Licitação
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {resumo.valor_estimado !== null && resumo.valor_estimado !== undefined && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                        <span>Valor Estimado:</span>
                        <span>{formatCurrencyBRL(resumo.valor_estimado)}</span>
                      </span>
                    )}

                    {resumo.total_homologado !== null && resumo.total_homologado !== undefined && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Total Homologado:</span>
                        <span>{formatCurrencyBRL(resumo.total_homologado)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Tabela magra de itens + disclosure */}
                {detail.itens.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-lg">
                    Nenhum item neste processo
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th scope="col" className="py-3 px-3 w-12 text-center">#</th>
                          <th scope="col" className="py-3 px-4">Descrição</th>
                          <th scope="col" className="py-3 px-3 w-20 text-right">Qtd</th>
                          <th scope="col" className="py-3 px-3 w-16 text-center">Un</th>
                          <th scope="col" className="py-3 px-4 w-36 text-right">Valor (Rank 1)</th>
                          <th scope="col" className="py-3 px-4 w-28">Situação</th>
                          <th scope="col" className="py-3 px-3 w-24 text-center">Ranking</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.itens.map((item) => {
                          const isExpanded = expandedItemNumbers.has(item.numero_item);
                          const rank1 = item.ranking && item.ranking.length > 0 ? item.ranking[0] : null;
                          const rank1Valor = rank1 ? rank1.valor : (item.valor_total || item.valor_unitario);

                          return (
                            <React.Fragment key={item.numero_item}>
                              <tr className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                                  {item.numero_item}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900 leading-snug">
                                    {item.descricao}
                                  </div>
                                  {item.marca && (
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      Marca/Ref: {item.marca}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-medium text-slate-700">
                                  {item.quantidade}
                                </td>
                                <td className="py-3 px-3 text-center font-medium text-slate-600">
                                  {item.unidade}
                                </td>
                                <td className="py-3 px-4 text-right font-semibold text-slate-900">
                                  {rank1Valor !== null && rank1Valor !== undefined ? (
                                    formatCurrencyBRL(rank1Valor)
                                  ) : (
                                    <HonestField value={null} label="Valor do item" />
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    <HonestField value={item.situacao} label="Situação do item" />
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {item.ranking && item.ranking.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleItemRanking(item.numero_item)}
                                      aria-expanded={isExpanded}
                                      aria-label={`Ver ranking de propostas do item ${item.numero_item}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors min-h-9"
                                    >
                                      <span>{item.ranking.length}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 font-mono">—</span>
                                  )}
                                </td>
                              </tr>

                              {/* Row Expand: Ranking Completo */}
                              {isExpanded && item.ranking && item.ranking.length > 0 && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={7} className="p-4 border-t border-slate-200">
                                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mb-2">
                                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Ranking de Propostas — Item #{item.numero_item}</span>
                                      </div>

                                      <table className="w-full text-left text-xs">
                                        <thead className="border-b border-slate-200 text-slate-500 font-semibold">
                                          <tr>
                                            <th className="py-1.5 px-2 w-12 text-center">Pos</th>
                                            <th className="py-1.5 px-2">Empresa</th>
                                            <th className="py-1.5 px-2 w-36">CNPJ</th>
                                            <th className="py-1.5 px-2 w-28 text-right">Valor</th>
                                            <th className="py-1.5 px-2 w-28 text-right">Data</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {item.ranking.map((rank) => (
                                            <tr
                                              key={rank.posicao}
                                              className={rank.posicao === 1 ? 'bg-emerald-50/50 font-medium' : ''}
                                            >
                                              <td className="py-2 px-2 text-center font-mono">
                                                {rank.posicao === 1 ? (
                                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                    1º
                                                  </span>
                                                ) : (
                                                  `${rank.posicao}º`
                                                )}
                                              </td>
                                              <td className="py-2 px-2 text-slate-800">
                                                {rank.empresa}
                                                {rank.posicao === 1 && (
                                                  <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                    Vencedor
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-2 font-mono text-slate-500">
                                                {rank.cnpj}
                                              </td>
                                              <td className="py-2 px-2 text-right font-semibold text-slate-900">
                                                {formatCurrencyBRL(rank.valor)}
                                              </td>
                                              <td className="py-2 px-2 text-right text-slate-500">
                                                <HonestField value={formatDateToBR(rank.data_proposta)} label="Data da proposta" />
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB ANEXOS */}
            {activeTab === 'anexos' && (
              <div
                id="panel-anexos"
                role="tabpanel"
                aria-labelledby="tab-anexos"
                className="space-y-6"
              >
                {detail.anexos.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-lg">
                    Nenhum anexo disponível
                  </div>
                ) : (
                  (Object.entries(groupedAnexos) as [string, MuralProcessAnexo[]][]).map(([grupo, anexosList]) => (
                    <div key={grupo} className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FolderArchive className="w-3.5 h-3.5 text-blue-600" />
                        <span>{grupo}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({anexosList.length})
                        </span>
                      </h3>

                      <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                        {anexosList.map((anexo) => (
                          <div
                            key={anexo.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-white hover:bg-slate-50/70 transition-colors gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-xs">
                                  {anexo.nome}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="font-medium text-slate-600 uppercase">
                                    {anexo.tipo}
                                  </span>
                                  {anexo.tamanho && (
                                    <>
                                      <span>·</span>
                                      <span>{anexo.tamanho}</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span>
                                    Publicado em: {formatDateToBR(anexo.data_publicacao)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDownloadAnexo(anexo)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 min-h-11 transition-colors shrink-0"
                              aria-label={`Baixar anexo ${anexo.nome}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB HISTÓRICO */}
            {activeTab === 'historico' && (
              <div
                id="panel-historico"
                role="tabpanel"
                aria-labelledby="tab-historico"
                className="space-y-4"
              >
                {!detail.historico || detail.historico.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-lg">
                    Histórico ainda não sincronizado
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 my-2">
                    {detail.historico.map((hist, index) => (
                      <div key={index} className="relative group">
                        {/* Dot on timeline */}
                        <div className="absolute -left-7.75 top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 group-hover:scale-110 transition-transform" />

                        <div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                            <span>{formatDateTimeToBR(hist.data_hora)}</span>
                            {hist.responsavel && (
                              <>
                                <span>·</span>
                                <span>{hist.responsavel}</span>
                              </>
                            )}
                          </div>

                          <div className="font-semibold text-slate-900 text-xs mt-0.5">
                            {hist.evento}
                          </div>

                          {hist.descricao && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {hist.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
