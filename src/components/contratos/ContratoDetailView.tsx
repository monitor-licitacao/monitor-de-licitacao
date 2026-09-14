import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { apiClient, assertOk } from '../../apiClient';
import type { ContractDetail } from '../../types/contratos';
import { ContratoCard } from './ContratoCard';

interface ContratoDetailViewProps {
  contratoId: string;
  onBack: () => void;
}

export const ContratoDetailView: React.FC<ContratoDetailViewProps> = ({ contratoId, onBack }) => {
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reajusteLoading, setReajusteLoading] = useState(false);
  const [oficioLoading, setOficioLoading] = useState(false);
  const [emailOrgao, setEmailOrgao] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient(`/api/contratos/${encodeURIComponent(contratoId)}`);
      if (res.status === 404) {
        setError('Contrato não encontrado.');
        return;
      }
      await assertOk(res);
      const body = await res.json();
      setDetail(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  }, [contratoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyReajuste = async () => {
    setReajusteLoading(true);
    try {
      const res = await apiClient(`/api/contratos/${contratoId}/reajuste`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indice: 'ipca' }),
      });
      await assertOk(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no reajuste');
    } finally {
      setReajusteLoading(false);
    }
  };

  const createOficio = async (tipo: 'renovacao' | 'reajuste' | 'encerramento') => {
    setOficioLoading(true);
    try {
      const res = await apiClient(`/api/contratos/${contratoId}/oficios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      await assertOk(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar ofício');
    } finally {
      setOficioLoading(false);
    }
  };

  const downloadPdf = async (oficioId: string) => {
    try {
      const res = await apiClient(`/api/contratos/oficios/${oficioId}/pdf`);
      await assertOk(res);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oficio-${oficioId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar PDF');
    }
  };

  const sendOficio = async (oficioId: string) => {
    if (!emailOrgao.trim()) {
      setError('Informe o e-mail do órgão.');
      return;
    }
    try {
      const res = await apiClient(`/api/contratos/oficios/${oficioId}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_orgao: emailOrgao.trim() }),
      });
      if (res.status === 503) {
        const body = await res.json();
        setError(body.error ?? 'Envio indisponível.');
        return;
      }
      await assertOk(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar ofício');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando contrato...
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="p-6">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-rose-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </button>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 text-sm text-slate-600">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <ContratoCard analysis={detail} />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">DNA de saúde</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(detail.health.fatores).map(([key, f]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400 font-bold">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-slate-900">{f.score}</p>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${f.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {detail.itens.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Itens do contrato</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b">
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Qtd</th>
                  <th className="pb-2">Unid.</th>
                  <th className="pb-2 text-right">Unit.</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.itens.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-2">{item.descricao ?? '—'}</td>
                    <td className="py-2">{item.quantidade ?? '—'}</td>
                    <td className="py-2">{item.unidade_medida ?? '—'}</td>
                    <td className="py-2 text-right font-mono">{item.valor_unitario ?? '—'}</td>
                    <td className="py-2 text-right font-mono">{item.valor_total ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Reajuste</h3>
        <p className="text-sm text-slate-500">Aplica IPCA acumulado desde o início da vigência (BCB SGS).</p>
        <button
          type="button"
          disabled={reajusteLoading}
          onClick={() => void applyReajuste()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg disabled:opacity-50"
        >
          {reajusteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Calcular reajuste IPCA
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">Ofícios</h3>
          <div className="flex flex-wrap gap-2">
            {(['renovacao', 'reajuste', 'encerramento'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                disabled={oficioLoading}
                onClick={() => void createOficio(tipo)}
                className="text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 capitalize"
              >
                + {tipo}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-xs font-bold uppercase text-slate-500">E-mail do órgão</span>
          <input
            type="email"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={emailOrgao}
            onChange={(e) => setEmailOrgao(e.target.value)}
            placeholder="licitacao@orgao.gov.br"
          />
        </label>

        {detail.oficios.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum ofício gerado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {detail.oficios.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="font-medium text-sm text-slate-800">{o.assunto}</p>
                  <p className="text-xs text-slate-500 capitalize">{o.tipo} · {o.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadPdf(o.id)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-slate-50"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendOficio(o.id)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Send className="w-3 h-3" /> Enviar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
