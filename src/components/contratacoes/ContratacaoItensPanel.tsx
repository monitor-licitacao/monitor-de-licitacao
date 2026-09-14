import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Filter, Lock, Tag, TrendingUp } from 'lucide-react';
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

function itemMatchesFacet(item: ContratacaoItemRico, facetKey: string | null): boolean {
  if (!facetKey) return true;
  const f = item.parsed_facets;
  if (!f) return false;
  if (facetKey.startsWith('tipo:')) return f.tipo === facetKey.slice(5);
  if (facetKey.startsWith('material:')) return f.material === facetKey.slice(9);
  if (facetKey.startsWith('base:')) return f.base_class === facetKey.slice(5);
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

export function grupoFilterLabel(
  filter: GrupoFilter,
  grupos: ContratacaoGrupo[],
): string {
  if (filter === 'ALL') return 'Todos os itens';
  if (filter === 'AVULSOS') return 'Itens avulsos';
  return grupos.find((g) => g.identificador === filter)?.descricao ?? filter;
}

type FacetChip = { key: string; label: string; count: number };

interface ItemCardProps {
  key?: any;
  item: ContratacaoItemRico;
  expanded: boolean;
  onToggle: () => void;
  nested?: boolean;
}

function ItemCard({ item, expanded, onToggle, nested = false }: ItemCardProps) {
  const titulo =
    item.nome_comercial ??
    item.descricao_resumida.split(' tipo:')[0]?.trim() ??
    item.descricao_resumida;

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
              {item.tipo_catalogo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <Tag className="w-3 h-3" />
                  {item.tipo_catalogo}
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

interface GrupoSelectCardProps {
  key?: any;
  grupo: ContratacaoGrupo;
  selected: boolean;
  onSelect: () => void;
}

function GrupoSelectCard({ grupo, selected, onSelect }: GrupoSelectCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full flex flex-wrap items-start justify-between gap-3 p-4 text-left rounded-xl border transition shadow-xs ${
          selected
            ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
            : 'border-slate-200 bg-white hover:bg-slate-50/60 hover:border-slate-300'
        }`}
      >
        <div className="space-y-2 min-w-0 flex-1">
          <h3
            className={`text-sm font-bold uppercase tracking-wide ${
              selected ? 'text-white' : 'text-slate-900'
            }`}
          >
            {grupo.descricao}
            <span
              className={`font-semibold normal-case tracking-normal ${
                selected ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {' '}
              | {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <MeEppBadge label={grupo.tratamento_me_epp} />
            <SituacaoBadge label={grupo.situacao_label} />
          </div>
          {grupo.motivo_anulacao && (
            <p className={`text-xs ${selected ? 'text-slate-300' : 'text-slate-600'}`}>
              {grupo.motivo_anulacao}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 flex items-start gap-2">
          <div>
            <p className={`text-[11px] ${selected ? 'text-slate-400' : 'text-slate-500'}`}>
              Valor estimado (total)
            </p>
            <p
              className={`text-sm font-bold tabular-nums ${
                selected ? 'text-white' : 'text-slate-900'
              }`}
            >
              {formatValorOuSigiloso(grupo.valor_estimado_total, grupo.orcamento_sigiloso)}
            </p>
          </div>
          <ChevronRight
            className={`w-4 h-4 mt-1 shrink-0 ${selected ? 'text-slate-300' : 'text-slate-400'}`}
          />
        </div>
      </button>
    </li>
  );
}

interface ContratacaoGruposPanelProps {
  grupos: ContratacaoGrupo[];
  itensAvulsos?: ContratacaoItemRico[];
  selectedFilter: GrupoFilter;
  onSelectFilter: (filter: GrupoFilter) => void;
  onVerItens: () => void;
}

export const ContratacaoGruposPanel: React.FC<ContratacaoGruposPanelProps> = ({
  grupos,
  itensAvulsos = [],
  selectedFilter,
  onSelectFilter,
  onVerItens,
}) => {
  const structured = hasStructuredGrupos(grupos);

  if (!structured) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-lg">
        Esta contratação não possui agrupamento de itens — consulte a aba Itens.
      </p>
    );
  }

  const handleSelect = (filter: GrupoFilter) => {
    onSelectFilter(filter);
    onVerItens();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Selecione um grupo para filtrar os itens na aba seguinte — como no PNCP.
      </p>

      <ul className="space-y-2">
        <li>
          <button
            type="button"
            onClick={() => handleSelect('ALL')}
            aria-pressed={selectedFilter === 'ALL'}
            className={`w-full flex items-center justify-between gap-3 p-4 text-left rounded-xl border transition shadow-xs ${
              selectedFilter === 'ALL'
                ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 ring-offset-2'
                : 'border-slate-200 bg-white hover:bg-slate-50/60'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">Todos os grupos</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {grupos.reduce((n, g) => n + g.itens.length, 0) + itensAvulsos.length} itens no total
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </li>

        {grupos.map((grupo) => (
          <GrupoSelectCard
            key={grupo.identificador}
            grupo={grupo}
            selected={selectedFilter === grupo.identificador}
            onSelect={() => handleSelect(grupo.identificador)}
          />
        ))}

        {itensAvulsos.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => handleSelect('AVULSOS')}
              aria-pressed={selectedFilter === 'AVULSOS'}
              className={`w-full flex items-center justify-between gap-3 p-4 text-left rounded-xl border transition shadow-xs ${
                selectedFilter === 'AVULSOS'
                  ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 ring-offset-2'
                  : 'border-slate-200 bg-white hover:bg-slate-50/60'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-slate-900">Itens avulsos</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {itensAvulsos.length}{' '}
                  {itensAvulsos.length === 1 ? 'item fora de grupo' : 'itens fora de grupo'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
};

interface ContratacaoItensPanelProps {
  grupos: ContratacaoGrupo[];
  itensAvulsos?: ContratacaoItemRico[];
  grupoFilter?: GrupoFilter;
  onClearGrupoFilter?: () => void;
}

export const ContratacaoItensPanel: React.FC<ContratacaoItensPanelProps> = ({
  grupos,
  itensAvulsos = [],
  grupoFilter = 'ALL',
  onClearGrupoFilter,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeFacetKey, setActiveFacetKey] = useState<string | null>(null);

  const scopedItens = useMemo(
    () => resolveFilteredItens(grupos, itensAvulsos, grupoFilter),
    [grupos, itensAvulsos, grupoFilter],
  );

  const facetChips = useMemo((): FacetChip[] => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const item of scopedItens) {
      const facets = item.parsed_facets;
      if (facets?.tipo) {
        const key = `tipo:${facets.tipo}`;
        const prev = counts.get(key);
        counts.set(key, { label: `tipo: ${facets.tipo}`, count: (prev?.count ?? 0) + 1 });
      }
      if (facets?.material) {
        const key = `material:${facets.material}`;
        const prev = counts.get(key);
        counts.set(key, { label: `material: ${facets.material}`, count: (prev?.count ?? 0) + 1 });
      }
      if (facets?.base_class) {
        const short = facets.base_class.length > 48
          ? `${facets.base_class.slice(0, 45)}…`
          : facets.base_class;
        const key = `base:${facets.base_class}`;
        const prev = counts.get(key);
        counts.set(key, { label: short, count: (prev?.count ?? 0) + 1 });
      }
    }
    return [...counts.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);
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

  const showGrupoBanner =
    hasStructuredGrupos(grupos) && grupoFilter !== 'ALL';

  return (
    <div className="space-y-4">
      {showGrupoBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-900">
            <span className="font-semibold">Filtro de grupo:</span>{' '}
            {grupoFilterLabel(grupoFilter, grupos)}
            <span className="text-amber-700"> · {visibleItens.length} itens</span>
          </p>
          {onClearGrupoFilter && (
            <button
              type="button"
              onClick={onClearGrupoFilter}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {facetChips.length > 0 && (
        <div className="flex flex-wrap items-start gap-2 p-3 rounded-lg bg-sky-50/70 border border-sky-100">
          <Filter className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sky-900">Filtros por facet PNCP</p>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Vocabulário extraído na ingest — filtre itens por tipo, material ou classe base.
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
              {facetChips.map((chip) => {
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
                    <Tag className="w-3 h-3" aria-hidden="true" />
                    {chip.label}
                    <span className={active ? 'text-sky-200' : 'text-sky-600'}>({chip.count})</span>
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
