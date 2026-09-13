import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertTriangle,
  FileText,
  Clock,
  FolderArchive,
  Layers,
} from 'lucide-react';
import { apiClient, assertOk } from '../../apiClient';
import type { ContratacaoDetail, ContratacaoGrupo } from '../../types/contratacoes';
import { EnrichmentBadge } from './EnrichmentBadge';
import {
  ContratacaoGruposPanel,
  ContratacaoItensPanel,
  hasStructuredGrupos,
  type GrupoFilter,
} from './ContratacaoItensPanel';
import { StatusBadge } from '../mural/StatusBadge';
import { HonestField } from '../mural/HonestField';
import { formatCurrencyBRL, formatDateTimeToBR } from '../../utils/muralFormatters';

interface ContratacaoDetailViewProps {
  contratacaoId: string;
  onBack: () => void;
}

export const ContratacaoDetailView: React.FC<ContratacaoDetailViewProps> = ({
  contratacaoId,
  onBack,
}) => {
  const [detail, setDetail] = useState<ContratacaoDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'grupos' | 'itens' | 'anexos' | 'historico'>('itens');
  const [grupoFilter, setGrupoFilter] = useState<GrupoFilter>('ALL');

  useEffect(() => {
    if (!detail) return;
    const gruposLoaded = detail.grupos?.length ? detail.grupos : [];
    setActiveTab(hasStructuredGrupos(gruposLoaded) ? 'grupos' : 'itens');
    setGrupoFilter('ALL');
  }, [detail?.resumo.numero_controle_pncp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient(`/api/contratacoes/${encodeURIComponent(contratacaoId)}`);
        if (res.status === 404) {
          if (!cancelled) setError('Contratação não encontrada.');
          return;
        }
        await assertOk(res);
        if (!cancelled) setDetail(await res.json());
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar contratação');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contratacaoId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando contratação...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error ?? 'Contratação não encontrada.'}
        </div>
      </div>
    );
  }

  const { resumo, anexos, historico, enriquecimento } = detail;
  const itensAvulsos = detail.itens_avulsos ?? [];
  const grupos: ContratacaoGrupo[] =
    detail.grupos?.length
      ? detail.grupos
      : [
          {
            identificador: 'ALL',
            descricao: 'Todos os itens',
            item_numeros: detail.itens.map((i) => i.numero_item),
            valor_estimado_total: resumo.valor_estimado,
            orcamento_sigiloso: false,
            tratamento_me_epp: null,
            motivo_anulacao: null,
            situacao_label: null,
            itens: detail.itens.map((i) => ({
              numero_item: i.numero_item,
              descricao_resumida: i.descricao,
              descricao_detalhada: i.descricao,
              nome_comercial: null,
              quantidade: i.quantidade,
              unidade: i.unidade,
              valor_unitario: i.valor_unitario ?? null,
              valor_total: i.valor_total ?? null,
              orcamento_sigiloso: false,
              criterio_julgamento: null,
              beneficio_me_epp: null,
              situacao: i.situacao,
              material_ou_servico: null,
              codigo_catalogo: null,
              catalogo_tipo: null,
              ncm_nbs: null,
              tipo_catalogo: null,
              exigencia_conteudo_nacional: null,
              margem_preferencia: null,
              catalogo_hint: null,
              parsed_facets: null,
              catalog_match_method: null,
              preco_mercado: null,
            })),
          },
        ];
  const totalItens =
    grupos.reduce((n, g) => n + g.itens.length, 0) + itensAvulsos.length;
  const structuredGrupos = hasStructuredGrupos(grupos);
  const grupoTabCount =
    grupos.filter((g) => g.identificador !== 'ALL').length + (itensAvulsos.length > 0 ? 1 : 0);

  const tabs = [
    ...(structuredGrupos
      ? [{ id: 'grupos' as const, label: 'Grupos', count: grupoTabCount, icon: Layers }]
      : []),
    { id: 'itens' as const, label: 'Itens', count: totalItens, icon: FileText },
    { id: 'anexos' as const, label: 'Anexos', count: anexos.length, icon: FolderArchive },
    { id: 'historico' as const, label: 'Histórico', count: historico.length, icon: Clock },
  ];

  const effectiveTab =
    activeTab === 'grupos' && !structuredGrupos ? 'itens' : activeTab;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar à lista
      </button>

      <header className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4 border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                Pregão {resumo.edital} · {resumo.unidade}
              </h1>
              <p className="text-xs font-mono text-slate-500 mt-1 break-all">
                {resumo.numero_controle_pncp}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={resumo.status_normalizado} size="sm" />
              <EnrichmentBadge badge={enriquecimento.badge} size="sm" />
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">{resumo.objeto}</p>

          <div className="flex flex-wrap gap-2">
            <a
              href={resumo.link_pncp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
            >
              Ver no PNCP
              <ExternalLink className="w-4 h-4" />
            </a>
            {resumo.link_compras_gov ? (
              <a
                href={resumo.link_compras_gov}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
              >
                Acessar Contratação
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <HonestField label="Modalidade" value={resumo.modalidade} />
            <HonestField label="Situação" value={resumo.situacao} />
            <HonestField
              label="Valor estimado"
              value={formatCurrencyBRL(resumo.valor_estimado) ?? '—'}
            />
            <HonestField label="Processo" value={resumo.numero_processo} />
            <HonestField label="Abertura propostas" value={resumo.inicio_propostas} />
            <HonestField label="Encerramento propostas" value={resumo.termino_propostas} />
            <HonestField label="Itens PNCP" value={String(totalItens)} />
            <HonestField label="idCompra" value={enriquecimento.idCompra} />
          </dl>
        </div>

        <div
          role="tablist"
          aria-label="Seções da contratação"
          className="flex border-b border-slate-200 px-4 bg-slate-50/60"
        >
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={effectiveTab === id}
              onClick={() => setActiveTab(id)}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
                effectiveTab === id
                  ? 'border-slate-900 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {effectiveTab === 'grupos' && structuredGrupos && (
            <ContratacaoGruposPanel
              grupos={grupos}
              itensAvulsos={itensAvulsos}
              selectedFilter={grupoFilter}
              onSelectFilter={setGrupoFilter}
              onVerItens={() => setActiveTab('itens')}
            />
          )}

          {effectiveTab === 'itens' && (
            <ContratacaoItensPanel
              grupos={grupos}
              itensAvulsos={itensAvulsos}
              grupoFilter={grupoFilter}
              onClearGrupoFilter={() => setGrupoFilter('ALL')}
            />
          )}

          {effectiveTab === 'anexos' && (
            <ul className="space-y-2">
              {anexos.length === 0 ? (
                <li className="text-sm text-slate-500 py-8 text-center flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-slate-300" />
                  Nenhum anexo disponível via PNCP nesta contratação.
                </li>
              ) : (
                anexos.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{a.nome}</p>
                      <p className="text-xs text-slate-500">
                        {a.grupo} · {a.tipo}
                      </p>
                    </div>
                    {a.url_download && (
                      <a
                        href={a.url_download}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Abrir
                      </a>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}

          {effectiveTab === 'historico' && (
            <ul className="space-y-3">
              {historico.length === 0 ? (
                <li className="text-sm text-slate-500 py-8 text-center flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  Sem eventos de histórico registrados.
                </li>
              ) : (
                historico.map((h, idx) => (
                  <li key={idx} className="flex gap-3 p-3 rounded-lg border border-slate-100">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">
                        {formatDateTimeToBR(h.data_hora) ?? h.data_hora}
                      </p>
                      <p className="font-medium text-slate-800">{h.evento}</p>
                      {h.descricao && (
                        <p className="text-sm text-slate-600 mt-0.5">{h.descricao}</p>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </header>
    </div>
  );
};
