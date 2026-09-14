import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Layers,
  Lock,
  Tag,
  TrendingUp,
} from 'lucide-react';
import type {
  ContratacaoGrupo,
  ContratacaoItemRico,
  PrecoMercadoStats,
} from '../../types/contratacoes';
import { formatCurrencyBRL } from '../../utils/muralFormatters';

function PrecoMercadoBlock({ stats }: { stats: PrecoMercadoStats | null }) {
  if (!stats) return null;

  if (stats.status === 'INSUFICIENTE') {
    return (
      <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <TrendingUp className="w-3.5 h-3.5" />
          Preço de mercado
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Dados insuficientes — informe CATMAT/CATSER ou NCM para cruzar com histórico PNCP.
        </p>
      </div>
    );
  }

  const confLabel =
    stats.confidence === 'HIGH'
      ? 'Alta'
      : stats.confidence === 'MEDIUM'
        ? 'Média'
        : stats.confidence === 'LOW'
          ? 'Baixa'
          : '—';

  return (
    <div className="col-span-full rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-900">
        <TrendingUp className="w-3.5 h-3.5" />
        Preço de mercado
        {stats.label && (
          <span className="font-normal text-emerald-700">({stats.label})</span>
        )}
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
          confiança {confLabel} · {stats.join_level}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <dt className="text-emerald-700/80">Mediana (P50)</dt>
          <dd className="font-semibold text-emerald-950">
            {formatCurrencyBRL(stats.mediana) ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-700/80">Faixa P25–P75</dt>
          <dd className="font-semibold text-emerald-950">
            {formatCurrencyBRL(stats.p25) ?? '—'} – {formatCurrencyBRL(stats.p75) ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-700/80">Observações</dt>
          <dd className="font-semibold text-emerald-950">{stats.n}</dd>
        </div>
        <div>
          <dt className="text-emerald-700/80">Período</dt>
          <dd className="font-semibold text-emerald-950">{stats.periodo_meses} meses</dd>
        </div>
      </dl>
    </div>
  );
}

function formatValorOuSigiloso(
  valor: number | null | undefined,
  sigiloso: boolean,
): string {
  if (sigiloso && (valor == null || valor === 0)) {
    return 'Sigiloso';
  }
  return formatCurrencyBRL(valor) ?? '—';
}

function MeEppBadge({ label }: { label: string | null }) {
  if (!label) return null;
  const isSemBeneficio = /sem benef/i.test(label);
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${
        isSemBeneficio
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {label}
    </span>
  );
}

function SituacaoBadge({ label }: { label: string | null }) {
  if (!label) return null;
  const isAnulado = /anulad|revogad|cancelad/i.test(label);
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${
        isAnulado
          ? 'bg-violet-50 text-violet-800 border-violet-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {label}
    </span>
  );
}

/** Nome curto do item para chips de facet e badges — sem descrição PNCP completa. */
export function getItemDisplayName(item: ContratacaoItemRico): string {
  const raw =
    item.nome_comercial?.split('\n')[0]?.trim() ??
    item.parsed_facets?.nome_comercial?.split('\n')[0]?.trim() ??
    item.parsed_facets?.tipo?.split('\n')[0]?.trim() ??
    item.descricao_resumida.split(' tipo:')[0]?.trim() ??
    item.descricao_resumida;
  return raw.replace(/:\s*$/, '').trim();
}

function itemMatchesFacet(item: ContratacaoItemRico, facetKey: string | null): boolean {
  if (!facetKey) return true;
  if (facetKey.startsWith('item:')) {
    const numero = Number.parseInt(facetKey.slice(5), 10);
    return item.numero_item === numero;
  }
  return true;
}

function filterItens(itens: ContratacaoItemRico[], facetKey: string | null) {
  if (!facetKey) return itens;
  return itens.filter((item) => itemMatchesFacet(item, facetKey));
}

export type GrupoFilter = 'ALL' | 'AVULSOS' | (string & {});

export function hasStructuredGrupos(grupos: ContratacaoGrupo[]): boolean {
  return !(grupos.length === 1 && grupos[0]?.identificador === 'ALL');
}

export function resolveFilteredItens(
  grupos: ContratacaoGrupo[],
  itensAvulsos: ContratacaoItemRico[],
  filter: GrupoFilter,
): ContratacaoItemRico[] {
  if (filter === 'ALL') {
    return [...grupos.flatMap((g) => g.itens), ...itensAvulsos];
  }
  if (filter === 'AVULSOS') return itensAvulsos;
  return grupos.find((g) => g.identificador === filter)?.itens ?? [];
}

export function getAllContratacaoItens(
  grupos: ContratacaoGrupo[],
  itensAvulsos: ContratacaoItemRico[],
): ContratacaoItemRico[] {
  if (hasStructuredGrupos(grupos)) {
    return [...grupos.flatMap((g) => g.itens), ...itensAvulsos];
  }
  return grupos.flatMap((g) => g.itens).length > 0
    ? grupos.flatMap((g) => g.itens)
    : itensAvulsos;
}

export function grupoFilterLabel(
  filter: GrupoFilter,
  grupos: ContratacaoGrupo[],
): string {
  if (filter === 'ALL') return 'Todos os itens';
  if (filter === 'AVULSOS') return 'Itens avulsos';
  return grupos.find((g) => g.identificador === filter)?.descricao ?? filter;
}

export function parseItemFacetKey(key: string | null | undefined): number | null {
  if (!key?.startsWith('item:')) return null;
  const numero = Number.parseInt(key.slice(5), 10);
  return Number.isFinite(numero) ? numero : null;
}

export function resolveRegisterPrefillItens(
  grupos: ContratacaoGrupo[],
  itensAvulsos: ContratacaoItemRico[],
  grupoFilter: GrupoFilter = 'ALL',
  itemFacetKey: string | null = null,
): ContratacaoItemRico[] {
  let itens =
    grupoFilter === 'ALL'
      ? getAllContratacaoItens(grupos, itensAvulsos)
      : resolveFilteredItens(grupos, itensAvulsos, grupoFilter);
  const itemNumero = parseItemFacetKey(itemFacetKey);
  if (itemNumero != null) {
    itens = itens.filter((item) => item.numero_item === itemNumero);
  }
  return itens;
}

export type RegisterContratoPrefill = {
  contratacaoId: string;
  grupoFilter?: GrupoFilter;
  itemFacetKey?: string | null;
};

type FacetChip = { key: string; label: string; count: number };

interface ItemCardProps {
  item: ContratacaoItemRico;
  expanded: boolean;
  onToggle: () => void;
  nested?: boolean;
  motivoAnulacao?: string | null;
}

function ItemCard({
  item,
  expanded,
  onToggle,
  nested = false,
  motivoAnulacao = null,
}: ItemCardProps) {
  const displayName = getItemDisplayName(item);
  const titulo = displayName || item.descricao_resumida;

  return (
    <li
      className={
        nested
          ? 'bg-white'
          : 'rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full text-left hover:bg-slate-50/50 transition ${
          nested ? 'p-3 pl-5' : 'p-4'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                {item.numero_item}
              </span>
              <span className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                {titulo}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <MeEppBadge label={item.beneficio_me_epp} />
              {item.situacao && <SituacaoBadge label={item.situacao} />}
              {displayName && (
                <span className="inline-flex items-center gap-1 max-w-56 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate">
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate">{displayName}</span>
                </span>
              )}
              {item.catalog_match_method === 'PNCP_FACET_ONLY' && (
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200">
                  facet PNCP
                </span>
              )}
              {item.catalog_match_method === 'NCM_HINT' && item.ncm_nbs && (
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-800 border border-violet-200 font-mono">
                  NCM {item.ncm_nbs}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-4 shrink-0 text-right">
            <div>
              <p className="text-[10px] text-slate-500">Qtde solicitada</p>
              <p className="text-sm font-semibold text-slate-800 tabular-nums">
                {item.quantidade}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Valor estimado (unitário)</p>
              <p className="text-sm font-semibold text-slate-800 tabular-nums flex items-center justify-end gap-1">
                {item.orcamento_sigiloso && (
                  <Lock className="w-3 h-3 text-amber-600" aria-label="Orçamento sigiloso" />
                )}
                {formatValorOuSigiloso(item.valor_unitario, item.orcamento_sigiloso)}
              </p>
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400 mt-1" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 mt-1" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div
          className={`px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 ${
            nested ? 'bg-slate-50/40' : ''
          }`}
        >
          {motivoAnulacao && (
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Motivo da anulação:</span>{' '}
              {motivoAnulacao}
            </p>
          )}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-1">Descrição detalhada</p>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
              {item.descricao_detalhada}
            </p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-slate-500">Quantidade solicitada</dt>
              <dd className="font-medium text-slate-800">
                {item.quantidade} {item.unidade}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Critério de julgamento</dt>
              <dd className="font-medium text-slate-800">{item.criterio_julgamento ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor unitário / total</dt>
              <dd className="font-medium text-slate-800">
                {formatValorOuSigiloso(item.valor_unitario, item.orcamento_sigiloso)}
                {' / '}
                {formatValorOuSigiloso(item.valor_total, item.orcamento_sigiloso)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Orçamento sigiloso</dt>
              <dd className="font-medium text-slate-800">{item.orcamento_sigiloso ? 'Sim' : 'Não'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Margem de preferência</dt>
              <dd className="font-medium text-slate-800">
                {item.margem_preferencia ? 'Sim' : 'Não'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Conteúdo nacional</dt>
              <dd className="font-medium text-slate-800">
                {item.exigencia_conteudo_nacional ? 'Exigido' : 'Não'}
              </dd>
            </div>
            {item.codigo_catalogo && (
              <div>
                <dt className="text-slate-500">Código catálogo</dt>
                <dd className="font-medium text-slate-800 font-mono">
                  {item.catalogo_tipo ?? 'CATMAT'} {item.codigo_catalogo}
                </dd>
              </div>
            )}
            {item.parsed_facets && (
              <div className="col-span-full">
                <dt className="text-slate-500">Facets PNCP</dt>
                <dd className="font-medium text-sky-800 text-xs space-y-0.5">
                  {item.parsed_facets.base_class && (
                    <div>Classe: {item.parsed_facets.base_class}</div>
                  )}
                  {item.parsed_facets.tipo && <div>Tipo: {item.parsed_facets.tipo}</div>}
                  {item.parsed_facets.variante && (
                    <div>Variante PNCP: {item.parsed_facets.variante}</div>
                  )}
                  {item.parsed_facets.material && (
                    <div>Material: {item.parsed_facets.material}</div>
                  )}
                  {item.parsed_facets.aplicacao && (
                    <div>Aplicação: {item.parsed_facets.aplicacao}</div>
                  )}
                </dd>
              </div>
            )}
            {item.catalogo_hint && !item.codigo_catalogo && !item.parsed_facets?.tipo && (
              <div className="col-span-full">
                <dt className="text-slate-500">Hint catálogo (sem código PNCP)</dt>
                <dd className="font-medium text-sky-800">{item.catalogo_hint}</dd>
              </div>
            )}
            <PrecoMercadoBlock stats={item.preco_mercado} />
          </dl>
        </div>
      )}
    </li>
  );
}

interface GrupoAccordionCardProps {
  grupo: ContratacaoGrupo;
  expanded: boolean;
  expandedItems: Set<number>;
  onToggleGrupo: () => void;
  onToggleItem: (numero: number) => void;
}

function GrupoAccordionCard({
  grupo,
  expanded,
  expandedItems,
  onToggleGrupo,
  onToggleItem,
}: GrupoAccordionCardProps) {
  const tituloGrupo = grupo.descricao.toUpperCase();

  return (
    <li className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={onToggleGrupo}
        aria-expanded={expanded}
        className="w-full flex flex-wrap items-start justify-between gap-3 p-4 text-left hover:bg-slate-50/50 transition"
      >
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Layers className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              {tituloGrupo}
              <span className="font-semibold text-slate-500">
                {' '}
                | {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-6">
            <MeEppBadge label={grupo.tratamento_me_epp} />
            <SituacaoBadge label={grupo.situacao_label} />
          </div>
        </div>
        <div className="text-right shrink-0 flex items-start gap-2">
          <div>
            <p className="text-[11px] text-slate-500">Valor estimado (total)</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">
              {formatValorOuSigiloso(grupo.valor_estimado_total, grupo.orcamento_sigiloso)}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-blue-600 mt-1 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-600 mt-1 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/30">
          {grupo.motivo_anulacao && (
            <p className="px-4 pt-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Motivo da anulação:</span>{' '}
              {grupo.motivo_anulacao}
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {grupo.itens.map((item) => (
              <ItemCard
                key={item.numero_item}
                item={item}
                expanded={expandedItems.has(item.numero_item)}
                onToggle={() => onToggleItem(item.numero_item)}
                nested
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

interface ContratacaoItensPanelProps {
  grupos: ContratacaoGrupo[];
  itensAvulsos?: ContratacaoItemRico[];
  grupoFilter?: GrupoFilter;
  onGrupoFilterChange?: (filter: GrupoFilter) => void;
  itemFacetKey?: string | null;
  onItemFacetChange?: (key: string | null) => void;
}

export const ContratacaoItensPanel: React.FC<ContratacaoItensPanelProps> = ({
  grupos,
  itensAvulsos = [],
  grupoFilter: grupoFilterProp,
  onGrupoFilterChange,
  itemFacetKey: itemFacetKeyProp,
  onItemFacetChange,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());
  const [internalGrupoFilter, setInternalGrupoFilter] = useState<GrupoFilter>('ALL');
  const [internalItemFacetKey, setInternalItemFacetKey] = useState<string | null>(null);

  const grupoFilter = grupoFilterProp ?? internalGrupoFilter;
  const setGrupoFilter = onGrupoFilterChange ?? setInternalGrupoFilter;
  const activeFacetKey = itemFacetKeyProp ?? internalItemFacetKey;
  const setActiveFacetKey = onItemFacetChange ?? setInternalItemFacetKey;

  const structuredGrupos = hasStructuredGrupos(grupos);
  const usePncpLayout = structuredGrupos && !activeFacetKey && grupoFilter !== 'AVULSOS';
  const motivoAnulacaoAvulso = grupos.find((g) => g.motivo_anulacao)?.motivo_anulacao ?? null;

  const scopedItens = useMemo(
    () =>
      grupoFilter === 'ALL'
        ? getAllContratacaoItens(grupos, itensAvulsos)
        : resolveFilteredItens(grupos, itensAvulsos, grupoFilter),
    [grupos, itensAvulsos, grupoFilter],
  );

  const gruposVisiveis = useMemo(() => {
    if (!structuredGrupos || grupoFilter === 'ALL') return grupos;
    if (grupoFilter === 'AVULSOS') return [];
    return grupos.filter((g) => g.identificador === grupoFilter);
  }, [grupos, grupoFilter, structuredGrupos]);

  const avulsosVisiveis = useMemo(() => {
    if (grupoFilter === 'ALL' || grupoFilter === 'AVULSOS') return itensAvulsos;
    return [];
  }, [grupoFilter, itensAvulsos]);

  const facetChips = useMemo((): FacetChip[] => {
    return scopedItens.map((item) => ({
      key: `item:${item.numero_item}`,
      label: getItemDisplayName(item) || `Item ${item.numero_item}`,
      count: 1,
    }));
  }, [scopedItens]);

  const visibleItens = useMemo(
    () => filterItens(scopedItens, activeFacetKey),
    [scopedItens, activeFacetKey],
  );

  if (!grupos.length && !itensAvulsos.length) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-lg">
        Nenhum item ingerido do PNCP.
      </p>
    );
  }

  const toggleItem = (numero: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  };

  const toggleGrupo = (identificador: string) => {
    setExpandedGrupos((prev) => {
      const next = new Set(prev);
      if (next.has(identificador)) next.delete(identificador);
      else next.add(identificador);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {structuredGrupos && (
        <div className="flex flex-wrap items-start gap-2 p-3 rounded-lg bg-violet-50/70 border border-violet-100">
          <Layers className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-violet-900">Filtros por grupo</p>
            <p className="text-[11px] text-violet-700 mt-0.5">
              Selecione um grupo ou avulsos antes de registrar como contrato.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setGrupoFilter('ALL')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${
                  grupoFilter === 'ALL'
                    ? 'bg-violet-900 text-white border-violet-900'
                    : 'bg-white text-violet-900 border-violet-200 hover:border-violet-400'
                }`}
              >
                Todos ({getAllContratacaoItens(grupos, itensAvulsos).length})
              </button>
              {grupos.map((grupo) => (
                <button
                  key={grupo.identificador}
                  type="button"
                  onClick={() => setGrupoFilter(grupo.identificador)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${
                    grupoFilter === grupo.identificador
                      ? 'bg-violet-900 text-white border-violet-900'
                      : 'bg-white text-violet-900 border-violet-200 hover:border-violet-400'
                  }`}
                >
                  {grupo.descricao} ({grupo.itens.length})
                </button>
              ))}
              {itensAvulsos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGrupoFilter('AVULSOS')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${
                    grupoFilter === 'AVULSOS'
                      ? 'bg-violet-900 text-white border-violet-900'
                      : 'bg-white text-violet-900 border-violet-200 hover:border-violet-400'
                  }`}
                >
                  Avulsos ({itensAvulsos.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {facetChips.length > 0 && (
        <div className="flex flex-wrap items-start gap-2 p-3 rounded-lg bg-sky-50/70 border border-sky-100">
          <Filter className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sky-900">Filtros por item</p>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Selecione um item pelo nome para isolar na listagem.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setActiveFacetKey(null)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${
                  activeFacetKey === null
                    ? 'bg-sky-900 text-white border-sky-900'
                    : 'bg-white text-sky-900 border-sky-200 hover:border-sky-400'
                }`}
              >
                Todos ({scopedItens.length})
              </button>
              {facetChips
                .filter((chip) => scopedItens.some((item) => `item:${item.numero_item}` === chip.key))
                .map((chip) => {
                const active = activeFacetKey === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setActiveFacetKey(active ? null : chip.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition ${
                      active
                        ? 'bg-sky-900 text-white border-sky-900'
                        : 'bg-white text-sky-900 border-sky-200 hover:border-sky-400'
                    }`}
                  >
                    <Tag className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-48" title={chip.label}>
                      {chip.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {visibleItens.length === 0 ? (
          <li className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-lg">
            Nenhum item corresponde ao filtro selecionado.
          </li>
        ) : usePncpLayout ? (
          <>
            {gruposVisiveis.map((grupo) => (
              <GrupoAccordionCard
                key={grupo.identificador}
                grupo={grupo}
                expanded={expandedGrupos.has(grupo.identificador)}
                expandedItems={expandedItems}
                onToggleGrupo={() => toggleGrupo(grupo.identificador)}
                onToggleItem={toggleItem}
              />
            ))}
            {avulsosVisiveis.map((item) => (
              <ItemCard
                key={item.numero_item}
                item={item}
                expanded={expandedItems.has(item.numero_item)}
                onToggle={() => toggleItem(item.numero_item)}
                motivoAnulacao={motivoAnulacaoAvulso}
              />
            ))}
          </>
        ) : (
          visibleItens.map((item) => (
            <ItemCard
              key={item.numero_item}
              item={item}
              expanded={expandedItems.has(item.numero_item)}
              onToggle={() => toggleItem(item.numero_item)}
            />
          ))
        )}
      </ul>
    </div>
  );
};
