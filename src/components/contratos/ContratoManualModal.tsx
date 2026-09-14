import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, X } from 'lucide-react';
import { apiClient, assertOk } from '../../apiClient';
import type { ContratacaoDetail, ContratacaoItemRico } from '../../types/contratacoes';
import type { ManualContractSource, ManualItemPreview, VigenciaExpectativa } from '../../types/contratos';
import { formatCurrencyBRL } from '../../utils/muralFormatters';
import {
  type GrupoFilter,
  getAllContratacaoItens,
  grupoFilterLabel,
  hasStructuredGrupos,
  resolveRegisterPrefillItens,
} from '../contratacoes/ContratacaoItensPanel';

function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function parseMoney(value: string): number | undefined {
  const n = Number(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function vigenciaHintLabel(expectativa: VigenciaExpectativa | undefined): string | null {
  switch (expectativa) {
    case 'aguardando_contrato':
      return 'Vigência do contrato virá da publicação no PNCP — informe manualmente se já tiver o instrumento assinado.';
    case 'aguardando_ata':
      return 'Processo com registro de preços (SRP/IRP) — vigência virá da ata publicada no PNCP.';
    case 'nao_aplicavel':
      return 'Contratação anulada ou sem vigência aplicável nesta fase.';
    default:
      return null;
  }
}

function flattenItens(detail: ContratacaoDetail): ContratacaoItemRico[] {
  return getAllContratacaoItens(detail.grupos ?? [], detail.itens_avulsos ?? []);
}

function itemLabel(item: ContratacaoItemRico): string {
  return (
    item.nome_comercial?.split('\n')[0]?.trim() ||
    item.descricao_resumida?.trim() ||
    item.descricao_detalhada?.trim() ||
    `Item ${item.numero_item}`
  );
}

function toPreview(item: ContratacaoItemRico): ManualItemPreview {
  return {
    numero_item: item.numero_item,
    descricao: itemLabel(item),
    quantidade: item.quantidade,
    unidade: item.unidade,
    valor_unitario: item.orcamento_sigiloso ? null : item.valor_unitario,
    valor_total: item.orcamento_sigiloso ? null : item.valor_total,
    orcamento_sigiloso: item.orcamento_sigiloso,
  };
}

interface ContratoManualModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  preselectedContratacaoId?: string | null;
  preselectedGrupoFilter?: GrupoFilter;
  preselectedItemNumero?: number | null;
}

export const ContratoManualModal: React.FC<ContratoManualModalProps> = ({
  open,
  onClose,
  onCreated,
  preselectedContratacaoId,
  preselectedGrupoFilter = 'ALL',
  preselectedItemNumero = null,
}) => {
  const [sources, setSources] = useState<ManualContractSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [contratacaoId, setContratacaoId] = useState('');
  const [numeroValor, setNumeroValor] = useState('');
  const [numeroTipo, setNumeroTipo] = useState<'pncp' | 'processo' | 'edital' | 'compra'>('pncp');
  const [detail, setDetail] = useState<ContratacaoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orgaoMsg, setOrgaoMsg] = useState<string | null>(null);
  const [valorGlobal, setValorGlobal] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [objeto, setObjeto] = useState('');
  const [selectedItens, setSelectedItens] = useState<Set<number>>(new Set());
  const [grupoFilter, setGrupoFilter] = useState<GrupoFilter>('ALL');
  const [prefillHint, setPrefillHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setContratacaoId('');
    setNumeroValor('');
    setNumeroTipo('pncp');
    setDetail(null);
    setOrgaoMsg(null);
    setValorGlobal('');
    setInicio('');
    setFim('');
    setObjeto('');
    setSelectedItens(new Set());
    setGrupoFilter('ALL');
    setPrefillHint(null);
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    setGrupoFilter(preselectedGrupoFilter);
  }, [open, preselectedGrupoFilter]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setSourcesLoading(true);
    const pin = preselectedContratacaoId?.trim();
    const qs = pin ? `?contratacaoId=${encodeURIComponent(pin)}` : '';
    void apiClient(`/api/contratos/manual/sources${qs}`)
      .then(async (res) => {
        await assertOk(res);
        const body = await res.json();
        setSources(body.data?.contratacoes ?? []);
      })
      .catch(() => setError('Não foi possível carregar contratações.'))
      .finally(() => setSourcesLoading(false));
  }, [open, preselectedContratacaoId]);

  useEffect(() => {
    if (!open || !preselectedContratacaoId) return;
    setContratacaoId(preselectedContratacaoId);
  }, [open, preselectedContratacaoId]);

  const applyDetail = useCallback(
    (
      data: ContratacaoDetail,
      source?: ManualContractSource,
      filter: GrupoFilter = 'ALL',
      itemNumero: number | null = null,
    ) => {
      setDetail(data);
      setObjeto(data.resumo.objeto_curto || data.resumo.objeto);

      const numeros = source?.numeros_sugeridos?.length
        ? source.numeros_sugeridos
        : [
            { tipo: 'pncp' as const, label: 'Controle PNCP', valor: data.resumo.numero_controle_pncp },
            ...(data.resumo.numero_processo
              ? [{ tipo: 'processo' as const, label: 'Processo', valor: data.resumo.numero_processo }]
              : []),
          ];
      const first = numeros[0];
      if (first) {
        setNumeroValor(first.valor);
        setNumeroTipo(first.tipo);
      }

      const itemFacetKey = itemNumero != null ? `item:${itemNumero}` : null;
      const preselected = resolveRegisterPrefillItens(
        data.grupos ?? [],
        data.itens_avulsos ?? [],
        filter,
        itemFacetKey,
      );
      setSelectedItens(new Set(preselected.map((i) => i.numero_item)));

      const defaultValor =
        data.resumo.total_homologado ??
        data.resumo.valor_estimado ??
        preselected.reduce((acc, item) => {
          if (item.orcamento_sigiloso) return acc;
          return acc + (item.valor_total ?? (item.valor_unitario ?? 0) * item.quantidade);
        }, 0);

      if (defaultValor > 0) {
        setValorGlobal(defaultValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      } else if (filter !== 'ALL' || itemNumero != null) {
        setValorGlobal('');
      }

      const cnpj = source?.cnpj_orgao ?? '';
      const orgaoNome = source?.orgao_razao_social || data.resumo.unidade_compradora || data.resumo.unidade;
      setOrgaoMsg(
        orgaoNome
          ? `Usando dados da contratação: ${orgaoNome}${cnpj ? ` (${maskCnpj(cnpj)})` : ''}`
          : 'Dados do órgão carregados da contratação selecionada.',
      );

      if (itemNumero != null) {
        setPrefillHint(`Pré-selecionado: item ${itemNumero}`);
      } else if (filter !== 'ALL' && hasStructuredGrupos(data.grupos ?? [])) {
        setPrefillHint(
          `Pré-selecionado: ${grupoFilterLabel(filter, data.grupos ?? [])} (${preselected.length} itens)`,
        );
      } else {
        setPrefillHint(null);
      }
    },
    [],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setError(null);
      try {
        const res = await apiClient(`/api/contratacoes/${encodeURIComponent(id)}`);
        if (res.status === 404) {
          setError('Contratação não encontrada.');
          return;
        }
        await assertOk(res);
        const data = (await res.json()) as ContratacaoDetail;
        const source = sources.find((s) => s.id === id);
        applyDetail(data, source, preselectedGrupoFilter, preselectedItemNumero);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar contratação.');
      } finally {
        setDetailLoading(false);
      }
    },
    [applyDetail, sources, preselectedGrupoFilter, preselectedItemNumero],
  );

  useEffect(() => {
    if (!open || !contratacaoId) return;
    void loadDetail(contratacaoId);
  }, [open, contratacaoId, loadDetail]);

  const sourceOptions = useMemo((): ManualContractSource[] => {
    if (!contratacaoId || sources.some((s) => s.id === contratacaoId)) return sources;
    if (!detail) return sources;
    return [
      {
        id: contratacaoId,
        numero_controle_pncp: detail.resumo.numero_controle_pncp,
        objeto: detail.resumo.objeto,
        cnpj_orgao: detail.resumo.numero_controle_pncp.slice(0, 14),
        uf: null,
        orgao_razao_social: detail.resumo.unidade_compradora || detail.resumo.unidade,
        numeros_sugeridos: [
          { tipo: 'pncp', label: 'Controle PNCP', valor: detail.resumo.numero_controle_pncp },
        ],
      },
      ...sources,
    ];
  }, [sources, contratacaoId, detail]);

  const numerosOpcoes = useMemo(() => {
    const source = sourceOptions.find((s) => s.id === contratacaoId);
    if (source?.numeros_sugeridos?.length) return source.numeros_sugeridos;
    if (!detail) return [];
    return [
      { tipo: 'pncp' as const, label: 'Controle PNCP', valor: detail.resumo.numero_controle_pncp },
      ...(detail.resumo.numero_processo && detail.resumo.numero_processo !== detail.resumo.numero_controle_pncp
        ? [{ tipo: 'processo' as const, label: 'Processo', valor: detail.resumo.numero_processo }]
        : []),
    ];
  }, [sourceOptions, contratacaoId, detail]);

  const itemRows = useMemo(() => {
    if (!detail) return [] as ManualItemPreview[];
    return flattenItens(detail).map(toPreview);
  }, [detail]);

  const applyGrupoFilter = (filter: GrupoFilter) => {
    setGrupoFilter(filter);
    if (!detail) return;
    const preselected = resolveRegisterPrefillItens(
      detail.grupos ?? [],
      detail.itens_avulsos ?? [],
      filter,
      preselectedItemNumero != null ? `item:${preselectedItemNumero}` : null,
    );
    setSelectedItens(new Set(preselected.map((i) => i.numero_item)));
    if (filter !== 'ALL' && hasStructuredGrupos(detail.grupos ?? [])) {
      setPrefillHint(`Selecionado: ${grupoFilterLabel(filter, detail.grupos ?? [])} (${preselected.length} itens)`);
    } else {
      setPrefillHint(null);
    }
  };

  const toggleItem = (numero: number) => {
    setSelectedItens((prev) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!contratacaoId || !numeroValor.trim()) {
      setError('Selecione a contratação e o número do contrato.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const parsedValor = parseMoney(valorGlobal);
      const payload = {
        contratacao_id: contratacaoId,
        numero_tipo: numeroTipo,
        numero_contrato_empenho: numeroValor.trim(),
        objeto_contrato: objeto.trim() || undefined,
        ...(parsedValor != null && parsedValor > 0 ? { valor_global: parsedValor } : {}),
        data_vigencia_inicio: inicio || undefined,
        data_vigencia_fim: fim || undefined,
        item_numeros: Array.from(selectedItens),
      };
      const res = await apiClient('/api/contratos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Falha ao criar contrato.');
      }
      const body = await res.json();
      onCreated(body.data.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar contrato.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const selectedSource = sourceOptions.find((s) => s.id === contratacaoId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Novo contrato (manual)</h2>
            <p className="text-sm text-slate-500 mt-1">
              Escolha uma contratação do painel PNCP. Órgão, itens e número vêm dos dados já ingeridos.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Contratação de origem *</span>
            {sourcesLoading ? (
              <p className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando contratações…
              </p>
            ) : (
              <select
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={contratacaoId}
                onChange={(e) => setContratacaoId(e.target.value)}
              >
                <option value="">Selecione uma contratação…</option>
                {sourceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero_controle_pncp}
                    {s.objeto ? ` · ${s.objeto.slice(0, 60)}` : ''}
                    {s.uf ? ` · ${s.uf}` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          {detailLoading && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens da contratação…
            </p>
          )}

          {selectedSource && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs font-bold uppercase text-slate-400">Órgão contratante</p>
              <p className="font-medium text-slate-800">
                {selectedSource.orgao_razao_social || detail?.resumo.unidade_compradora || '—'}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-1">{maskCnpj(selectedSource.cnpj_orgao)}</p>
              {orgaoMsg && <p className="text-xs text-amber-700 mt-2">{orgaoMsg}</p>}
            </div>
          )}

          {numerosOpcoes.length > 0 && (
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase text-slate-500">Nº do contrato *</span>
              <select
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={`${numeroTipo}:${numeroValor}`}
                onChange={(e) => {
                  const [tipo, ...rest] = e.target.value.split(':');
                  setNumeroTipo(tipo as typeof numeroTipo);
                  setNumeroValor(rest.join(':'));
                }}
              >
                {numerosOpcoes.map((n) => (
                  <option key={`${n.tipo}:${n.valor}`} value={`${n.tipo}:${n.valor}`}>
                    {n.label}: {n.valor}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase text-slate-500">Valor global</span>
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={valorGlobal}
                onChange={(e) => setValorGlobal(e.target.value)}
                placeholder="R$ 0,00"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase text-slate-500">Início da vigência</span>
              <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500">Fim da vigência</span>
              <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={fim} onChange={(e) => setFim(e.target.value)} />
            </label>
            {vigenciaHintLabel(detail?.vigencia_expectativa) && (
              <p className="text-xs text-amber-700 sm:col-span-2">
                {vigenciaHintLabel(detail?.vigencia_expectativa)}
              </p>
            )}
          </div>

          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Objeto do contrato</span>
            <input
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
            />
          </label>

          {itemRows.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              {detail && hasStructuredGrupos(detail.grupos ?? []) && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyGrupoFilter('ALL')}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                      grupoFilter === 'ALL'
                        ? 'bg-violet-900 text-white border-violet-900'
                        : 'bg-white text-violet-900 border-violet-200'
                    }`}
                  >
                    Todos ({flattenItens(detail).length})
                  </button>
                  {(detail.grupos ?? []).map((grupo) => (
                    <button
                      key={grupo.identificador}
                      type="button"
                      onClick={() => applyGrupoFilter(grupo.identificador)}
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                        grupoFilter === grupo.identificador
                          ? 'bg-violet-900 text-white border-violet-900'
                          : 'bg-white text-violet-900 border-violet-200'
                      }`}
                    >
                      {grupo.descricao} ({grupo.itens.length})
                    </button>
                  ))}
                  {(detail.itens_avulsos ?? []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => applyGrupoFilter('AVULSOS')}
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                        grupoFilter === 'AVULSOS'
                          ? 'bg-violet-900 text-white border-violet-900'
                          : 'bg-white text-violet-900 border-violet-200'
                      }`}
                    >
                      Avulsos ({detail.itens_avulsos.length})
                    </button>
                  )}
                </div>
              )}
              {prefillHint && (
                <p className="mb-2 text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  {prefillHint}
                </p>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Itens da contratação ({itemRows.length})
                </span>
                <span className="text-xs text-slate-500">Marque os itens a incluir no contrato</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="p-2 w-8" />
                      <th className="p-2">Item</th>
                      <th className="p-2">Qtd</th>
                      <th className="p-2">Unid.</th>
                      <th className="p-2 text-right">Unit.</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.map((item) => (
                      <tr key={item.numero_item} className="border-t border-slate-100">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedItens.has(item.numero_item)}
                            onChange={() => toggleItem(item.numero_item)}
                          />
                        </td>
                        <td className="p-2">
                          <span className="font-medium text-slate-800">{item.descricao}</span>
                          {item.orcamento_sigiloso && (
                            <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                              <Lock className="w-3 h-3" /> Sigiloso
                            </span>
                          )}
                        </td>
                        <td className="p-2">{item.quantidade}</td>
                        <td className="p-2">{item.unidade}</td>
                        <td className="p-2 text-right font-mono">
                          {item.orcamento_sigiloso ? 'Sigiloso' : formatCurrencyBRL(item.valor_unitario) ?? '—'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {item.orcamento_sigiloso ? 'Sigiloso' : formatCurrencyBRL(item.valor_total) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !contratacaoId || !numeroValor.trim()}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar contrato
          </button>
        </div>
      </div>
    </div>
  );
};
