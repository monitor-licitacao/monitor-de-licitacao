import React, { useState, useEffect } from 'react';
import {
  Dumbbell,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  FileText,
  KeyRound,
  FileKey,
  Layers
} from 'lucide-react';
import { LexicalTerm, NCMConfig, NCMClassificationResult } from '../types';
import { StatusCatalogView } from './mural/StatusCatalogView';

interface SettingsViewProps {
  initialTab?: 'status-catalog' | 'ncm' | 'pncp';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'status-catalog' }) => {
  const [activeTab, setActiveTab] = useState<'status-catalog' | 'ncm' | 'pncp'>(initialTab);

  // NCM State
  const [config, setConfig] = useState<NCMConfig | null>(null);
  const [ncmCode, setNcmCode] = useState('9506.91.00');
  const [ncmDescription, setNcmDescription] = useState('Artigos e equipamentos para cultura física, ginástica ou atletismo');
  const [terms, setTerms] = useState<LexicalTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // New terms input state
  const [newPositive, setNewPositive] = useState('');
  const [newNegative, setNewNegative] = useState('');

  // Simulator / Test State
  const [testText, setTestText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<NCMClassificationResult | null>(null);

  // PNCP Config State
  const [pncpCertificatePath, setPncpCertificatePath] = useState('');
  const [pncpCertificatePassword, setPncpCertificatePassword] = useState('');
  const [pncpHasPassword, setPncpHasPassword] = useState(false);
  const [pncpIsActive, setPncpIsActive] = useState(false);
  const [isSavingPncp, setIsSavingPncp] = useState(false);
  const [isPncpSaved, setIsPncpSaved] = useState(false);

  // Load config from backend API
  useEffect(() => {
    fetchConfig();
    fetchPncpConfig();
  }, []);

  const fetchPncpConfig = async () => {
    try {
      const res = await fetch('/api/config/tenant/pncp');
      if (res.ok) {
        const data = await res.json();
        setPncpCertificatePath(data.certificatePath || '');
        setPncpHasPassword(!!data.hasPassword);
        setPncpIsActive(data.isActive || false);
      }
    } catch (err) {
      console.error('Error fetching PNCP config:', err);
    }
  };

  const handleSavePncp = async () => {
    try {
      setIsSavingPncp(true);
      const res = await fetch('/api/config/tenant/pncp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificatePath: pncpCertificatePath,
          certificatePassword: pncpCertificatePassword,
          isActive: pncpIsActive
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setPncpHasPassword(!!updated.hasPassword);
        setPncpCertificatePassword('');
        setIsPncpSaved(true);
        setTimeout(() => setIsPncpSaved(false), 2500);
      }
    } catch (err) {
      console.error('Error saving PNCP config:', err);
    } finally {
      setIsSavingPncp(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/config/ncm');
      if (res.ok) {
        const data: NCMConfig = await res.json();
        setConfig(data);
        setNcmCode(data.ncmCode);
        setNcmDescription(data.ncmDescription);
        setTerms(data.terms || []);
      }
    } catch (err) {
      console.error('Error fetching NCM config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBaseConfig = async () => {
    try {
      const res = await fetch('/api/config/ncm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncmCode, ncmDescription })
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    } catch (err) {
      console.error('Error saving NCM base config:', err);
    }
  };

  const handleAddTerm = async (term: string, type: 'INCLUSIVE' | 'EXCLUSIVE') => {
    if (!term.trim()) return;
    try {
      const res = await fetch('/api/config/ncm/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: term.trim(), type })
      });
      if (res.ok) {
        const newTerm: LexicalTerm = await res.json();
        setTerms(prev => [...prev, newTerm]);
        if (type === 'INCLUSIVE') setNewPositive('');
        else setNewNegative('');
      }
    } catch (err) {
      console.error('Error adding term:', err);
    }
  };

  const handleDeleteTerm = async (id: string) => {
    try {
      const res = await fetch(`/api/config/ncm/terms/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTerms(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting term:', err);
    }
  };

  const handleToggleTerm = async (id: string) => {
    try {
      const res = await fetch(`/api/config/ncm/terms/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updatedTerm: LexicalTerm = await res.json();
        setTerms(prev => prev.map(t => t.id === id ? updatedTerm : t));
      }
    } catch (err) {
      console.error('Error toggling term:', err);
    }
  };

  // Run Test / Simulator
  const handleRunTest = async () => {
    if (!testText.trim()) return;
    try {
      setIsTesting(true);
      const res = await fetch('/api/config/ncm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText })
      });
      if (res.ok) {
        const result: NCMClassificationResult = await res.json();
        setTestResult(result);
      }
    } catch (err) {
      console.error('Error testing NCM text:', err);
    } finally {
      setIsTesting(false);
    }
  };

  // Sample presets for test simulator
  const loadPreset = (type: 'positive' | 'negative' | 'anchor') => {
    if (type === 'positive') {
      setTestText('Contratação de empresa especializada para fornecimento e montagem de esteira ergométrica profissional de alto rendimento, estações multifuncionais de musculação, bancos articulados e kits de halteres emborrachados para os centros de cultura física e ginástica.');
    } else if (type === 'negative') {
      setTestText('Aquisição de brinquedos de parque infantil, parquinho de plástico tubular e piscina inflável infantil para atender aos alunos da rede municipal de ensino.');
    } else if (type === 'anchor') {
      setTestText('Pregão Eletrônico SRP 042/2026: Aquisição de equipamentos para cultura física e atletismo com classificação fiscal obrigatória sob o código NCM 9506.91.00, incluindo barras de supino e anilhas olímpicas.');
    }
  };

  const positiveTerms = terms.filter(t => t.type === 'INCLUSIVE');
  const negativeTerms = terms.filter(t => t.type === 'EXCLUSIVE');

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('status-catalog')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 min-h-[36px] ${activeTab === 'status-catalog' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Catálogo de Status</span>
        </button>
        <button
          onClick={() => setActiveTab('ncm')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[36px] ${activeTab === 'ncm' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Motor Semântico (NCM)
        </button>
        <button
          onClick={() => setActiveTab('pncp')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[36px] ${activeTab === 'pncp' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Integração PNCP (Certificados)
        </button>
      </div>

      {activeTab === 'status-catalog' && (
        <div className="animate-in fade-in duration-200">
          <StatusCatalogView />
        </div>
      )}

      {activeTab === 'ncm' && (
      <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-blue-600" />
            <span>Módulo de Configuração NCM & Filtros Lexicais (RF-01 / RF-11)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Parametrização do NCM-alvo 9506.91.00, vocabulário semântico e motor de validação cruzada
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveBaseConfig}
            className="px-3.5 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            {isSaved ? <Check className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Configurações Salvas!' : 'Salvar Parâmetros'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5/12): NCM Target & Anchor Explanation */}
        <div className="lg:col-span-5 space-y-4">
          {/* NCM Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                NCM Padrão Monitorado (RF-01)
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Especialista Ativo
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Código NCM Principal *</label>
                <input
                  type="text"
                  value={ncmCode}
                  onChange={e => setNcmCode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-blue-700 font-mono text-xs font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição Oficial NCM *</label>
                <input
                  type="text"
                  value={ncmDescription}
                  onChange={e => setNcmDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {config?.updatedAt && (
                <div className="pt-1 text-[10.5px] text-slate-400 font-mono">
                  Última parametrização: {new Date(config.updatedAt).toLocaleString('pt-BR')} por {config.updatedBy}
                </div>
              )}
            </div>
          </div>

          {/* Truth Anchor Comparison (PRD v1.0) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs text-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Âncora de Verdade & Validação Cruzada</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-blue-700 flex items-center justify-between">
                  <span>1. API ComprasNet (Governo Federal)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 text-blue-700 border border-blue-200">Ground Truth</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Os editais do ComprasNet possuem o código NCM categorizado estruturadamente no JSON da API. Essa base é usada como padrão-ouro (Ground Truth) para calibrar os modelos de extração.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-sky-700 flex items-center justify-between">
                  <span>2. Scrapers Sistema S & 28 Prefeituras</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-sky-100 text-sky-700 border border-sky-200">Extração NLP</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Nos portais que publicam apenas texto corrido e PDFs escaneados, o sistema aplica o vocabulário positivo e negativo abaixo associado ao OCR para classificar a pertinência ao NCM 9506.91.00.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7/12): Keywords & Stop-words */}
        <div className="lg:col-span-7 space-y-4">
          {/* Positive Keywords */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Termos Inclusivos (Vocabulário Positivo)</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {positiveTerms.filter(t => t.isActive).length} ativos ({positiveTerms.length} total)
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTerm(newPositive, 'INCLUSIVE');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Adicionar termo esportivo (ex: polia regulável, remo seco)..."
                value={newPositive}
                onChange={e => setNewPositive(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
              {positiveTerms.map((termItem) => (
                <span
                  key={termItem.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-opacity ${
                    termItem.isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <button
                    type="button"
                    title={termItem.isActive ? 'Desativar termo' : 'Ativar termo'}
                    onClick={() => handleToggleTerm(termItem.id)}
                    className="cursor-pointer hover:opacity-80"
                  >
                    {termItem.term}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTerm(termItem.id)}
                    className="text-emerald-600 hover:text-emerald-950 cursor-pointer ml-0.5"
                    title="Excluir termo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Negative Keywords (Anti-False Positives) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-xs text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Filtro de Exclusão (Evitar Falsos Positivos)</span>
              </div>
              <span className="text-[11px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {negativeTerms.filter(t => t.isActive).length} ativos ({negativeTerms.length} total)
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTerm(newNegative, 'EXCLUSIVE');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Adicionar termo a excluir (ex: brinquedos infláveis, piso emborrachado)..."
                value={newNegative}
                onChange={e => setNewNegative(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
              {negativeTerms.map((termItem) => (
                <span
                  key={termItem.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-opacity ${
                    termItem.isActive
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <button
                    type="button"
                    title={termItem.isActive ? 'Desativar termo' : 'Ativar termo'}
                    onClick={() => handleToggleTerm(termItem.id)}
                    className="cursor-pointer hover:opacity-80"
                  >
                    {termItem.term}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTerm(termItem.id)}
                    className="text-rose-600 hover:text-rose-950 cursor-pointer ml-0.5"
                    title="Excluir termo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simulator / Real-Time Testing Engine (RF-01 / RF-06 / RF-07) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-xs text-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Simulador de Classificação Semântica em Tempo Real (Testar Configuração)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Carregar Exemplo:</span>
            <button
              type="button"
              onClick={() => loadPreset('positive')}
              className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium hover:bg-emerald-100 cursor-pointer"
            >
              🏋️‍♂️ Academia / Musculação
            </button>
            <button
              type="button"
              onClick={() => loadPreset('negative')}
              className="text-[10.5px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium hover:bg-rose-100 cursor-pointer"
            >
              🧒 Parquinho Infantil (Falso Positivo)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('anchor')}
              className="text-[10.5px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 cursor-pointer"
            >
              🎯 Com NCM 9506.91.00 Exato
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cole o texto do edital, objeto ou especificação para simular a classificação do pipeline:
            </label>
            <textarea
              rows={3}
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder="Cole aqui o trecho de um termo de referência ou objeto de licitação..."
              className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setTestText('');
                setTestResult(null);
              }}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>

            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting || !testText.trim()}
              className="px-4 py-1.5 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isTesting ? 'Processando Classificação...' : 'Testar Classificação em Tempo Real'}</span>
            </button>
          </div>

          {/* Test Result Output Box */}
          {testResult && (
            <div className={`mt-3 p-3.5 rounded-lg border space-y-2.5 ${
              testResult.status === 'CONFIRMED'
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : testResult.status === 'LIKELY'
                ? 'bg-sky-50/90 border-sky-300 text-sky-950'
                : testResult.status === 'REJECTED'
                ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Resultado da Classificação Semântica:
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    testResult.status === 'CONFIRMED'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : testResult.status === 'LIKELY'
                      ? 'bg-sky-600 text-white border-sky-700'
                      : testResult.status === 'REJECTED'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}>
                    {testResult.status === 'CONFIRMED' && '✅ CONFIRMADO (Âncora de Verdade Exata)'}
                    {testResult.status === 'LIKELY' && '⚡ ALTA RELEVÂNCIA (Match Semântico)'}
                    {testResult.status === 'REJECTED' && '❌ DESCARTADO (Falso Positivo Excluído)'}
                    {testResult.status === 'INCONCLUSIVE' && '⚠️ INCONCLUSIVO (Baixa Densidade)'}
                    {testResult.status === 'AMBIGUOUS' && '⚠️ CONFLITO SEMÂNTICO (Revisão Necessária)'}
                  </span>
                </div>

                <div className="text-xs font-mono font-bold">
                  Confiança do Motor: <span className="underline">{Math.round(testResult.confidence * 100)}%</span>
                  <span className="text-slate-500 font-normal ml-2">({testResult.method})</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed font-medium">
                💡 <strong>Diagnóstico do Motor:</strong> {testResult.reason}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                <div className="bg-white/80 p-2 rounded border border-black/10">
                  <div className="font-bold text-slate-700 mb-1">Âncora NCM Exata:</div>
                  <div className={testResult.hasExactNcm ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                    {testResult.hasExactNcm ? `✅ Código ${ncmCode} Detectado` : 'Não localizado no texto'}
                  </div>
                </div>

                <div className="bg-white/80 p-2 rounded border border-black/10">
                  <div className="font-bold text-emerald-800 mb-1">
                    Termos Inclusivos ({testResult.inclusiveScore}):
                  </div>
                  {testResult.inclusiveHits.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {testResult.inclusiveHits.map((h, i) => (
                        <span key={i} className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded font-medium">
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">Nenhum termo positivo</span>
                  )}
                </div>

                <div className="bg-white/80 p-2 rounded border border-black/10">
                  <div className="font-bold text-rose-800 mb-1">
                    Termos Exclusivos ({testResult.exclusiveScore}):
                  </div>
                  {testResult.exclusiveHits.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {testResult.exclusiveHits.map((h, i) => (
                        <span key={i} className="px-1.5 py-0.2 bg-rose-100 text-rose-900 rounded font-medium">
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">Nenhum termo de exclusão</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {activeTab === 'pncp' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileKey className="w-5 h-5 text-indigo-600" />
                  Certificado Digital A1 (PNCP)
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Configure o certificado digital (.pfx ou .p12) para autenticação mTLS nas rotas transacionais do PNCP.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${pncpIsActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {pncpIsActive ? 'ATIVO' : 'INATIVO'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input type="checkbox" className="sr-only peer" checked={pncpIsActive} onChange={e => setPncpIsActive(e.target.checked)} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <strong className="block mb-1">Atenção ao Mapeamento (Docker)</strong>
                  O caminho do arquivo informado abaixo deve ser absoluto. Caso o sistema seja conteinerizado (ex: VPS Hetzner), garanta que o diretório `D:\CERTIFICADOS` está mapeado como volume para o container e informe o caminho interno (ex: `/app/certs/...`).
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Caminho Absoluto do Arquivo (.pfx)</label>
                <input
                  type="text"
                  value={pncpCertificatePath}
                  onChange={e => setPncpCertificatePath(e.target.value)}
                  placeholder="Ex: D:\CERTIFICADOS 2026-2027\empresa_xyz.pfx"
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Senha do Certificado {pncpHasPassword && <span className="text-emerald-600 font-normal">(já configurada — deixe em branco para manter)</span>}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pncpCertificatePassword}
                    onChange={e => setPncpCertificatePassword(e.target.value)}
                    placeholder={pncpHasPassword ? '••••••••••••••' : 'Digite a senha do certificado'}
                    className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSavePncp}
                  disabled={isSavingPncp}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSavingPncp ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : isPncpSaved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isPncpSaved ? 'Salvo!' : 'Salvar Configuração PNCP'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
