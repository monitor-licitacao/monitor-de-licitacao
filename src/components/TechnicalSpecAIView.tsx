import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Dumbbell,
  Scale,
  Clock,
  FileText,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Award
} from 'lucide-react';
import { Edital, RestrictiveSpecAnalysis, ProductSupplierMatch } from '../types';
import { apiClient } from '../apiClient';

interface TechnicalSpecAIViewProps {
  editais: Edital[];
  initialClause?: string;
}

const PRESET_EXAMPLES = [
  {
    id: 'preset-item-4-3',
    title: 'Item 4.3 - FlexWave Duo & Amortecimento (Exemplo Principal)',
    badge: 'NCM 9506.91 - Risco Crítico',
    organ: 'Prefeitura de Frederico Westphalen / SESC RS',
    text: `Item 4.3 - DAS ESPECIFICAÇÕES TÉCNICAS RESTRITIVAS:
Os equipamentos deverão possuir sistema exclusivo de absorção de impacto patenteado modelo "FlexWave Duo" ou equivalente estrito aprovado previamente pelo corpo técnico antes da sessão de lances. Prazo para entrega e montagem integral: impreterivelmente 05 (cinco) dias corridos após emissão da Ordem de Fornecimento.`
  },
  {
    id: 'preset-esteira-inversor',
    title: 'Item 2.1 - Esteira Profissional com Deck Flutuante e Inversor Específico',
    badge: 'NCM 9506.91.00',
    organ: 'Secretaria Municipal de Esportes',
    text: `Item 2.1 - Esteiras Ergométricas Profissionais com sistema Shock Absorption com amortecedores em elastômero de compressão progressiva não inferior a 35%, deck ortopédico com lubrificação perene e inversor de frequência exclusivo de fabricação nacional WEG CFW300.`
  },
  {
    id: 'preset-estacao-peso',
    title: 'Item 5.2 - Estação de Musculação com Carenagem Laser e Torre Fechada',
    badge: 'NCM 9506.91',
    organ: 'SESI / SENAT Centro de Treinamento',
    text: `Item 5.2 - Estação Multifuncional 8 Torres com tubulação oblonga mínima de 3,5mm de espessura, solda robotizada helicoidal contínua e sistema de polias em alumínio aeronáutico anodizado com rolamentos blindados NSK selados.`
  }
];

export const TechnicalSpecAIView: React.FC<TechnicalSpecAIViewProps> = ({
  editais,
  initialClause
}) => {
  const [clauseInput, setClauseInput] = useState<string>(
    initialClause || PRESET_EXAMPLES[0].text
  );
  const [selectedEditalId, setSelectedEditalId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<RestrictiveSpecAnalysis | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'legal' | 'draft'>('products');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');

  const [humanReviewed, setHumanReviewed] = useState<boolean>(false);

  const runAnalysis = async (textToAnalyze?: string) => {
    const text = textToAnalyze || clauseInput;
    if (!text.trim()) return;

    setLoading(true);
    setHumanReviewed(false); // Reset review on new analysis
    try {
      const selectedEdital = editais.find(e => e.id === selectedEditalId);
      const res = await apiClient('/api/gemini/analyze-technical-specification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clauseText: text,
          editalTitle: selectedEdital?.title,
          entityName: selectedEdital?.sourceName,
          processNumber: selectedEdital?.processNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        throw new Error('Falha na resposta da API');
      }
    } catch (err) {
      console.error('Error running AI technical analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first mount if initial clause is present
  useEffect(() => {
    runAnalysis(clauseInput);
  }, []);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const filteredProducts = analysis?.matchingSuppliersAndProducts.filter(p => {
    if (filterSupplier === 'ALL') return true;
    if (filterSupplier === 'EQUIVALENTE') return p.complianceVerdict.includes('EQUIVALENTE');
    if (filterSupplier === 'PROPRIETARIA') return p.complianceVerdict === 'TECNOLOGIA_PROPRIETARIA';
    return true;
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Inteligência Artificial Gemini 3.7 Flash
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                NCM 9506.91
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              Pesquisa de Produtos & Análise de Especificações Restritivas
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Mecanismo de engenharia reversa para identificar tecnologias patenteadas de amortecimento/absorção de impacto,
              cruzar fornecedores e modelos reais do mercado nacional, auditar restritividade jurídica e gerar minutas de impugnação.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => runAnalysis()}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Processando com IA...' : 'Analisar Especificação'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Section with Presets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Cláusula ou Especificação Técnica a Analisar
            </label>
          </div>

          {/* Optional context link */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Vincular a Edital (Opcional):</span>
            <select
              value={selectedEditalId}
              onChange={e => setSelectedEditalId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Nenhum (Análise Autônoma de Especificação)</option>
              {editais.map(edital => (
                <option key={edital.id} value={edital.id}>
                  {edital.sourceName} - {edital.processNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Input */}
        <div className="relative">
          <textarea
            rows={4}
            value={clauseInput}
            onChange={e => setClauseInput(e.target.value)}
            placeholder="Cole aqui o trecho da especificação técnica, cláusula de exigência ou descrição do item..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y leading-relaxed"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Carregar Casos de Teste / Especificações do Edital:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_EXAMPLES.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  setClauseInput(preset.text);
                  runAnalysis(preset.text);
                }}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-all cursor-pointer ${
                  clauseInput === preset.text
                    ? 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-400 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{preset.title}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                    {preset.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Analisando Especificação com Gemini AI...</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Identificando tecnologias de absorção de impacto, patentes, marcas registradas, fornecedores brasileiros e calculando equivalência técnica.
          </p>
        </div>
      )}

      {/* Analysis Content */}
      {!loading && analysis && (
        <div className="space-y-6">
          {/* Executive Overview Banner */}
          <div className={`rounded-xl border p-5 shadow-xs ${
            analysis.restrictionLevel === 'CRITICO_DIRECIONAMENTO'
              ? 'bg-rose-50 border-rose-200'
              : analysis.restrictionLevel === 'ALTO_RESTRITIVO'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    analysis.restrictionLevel === 'CRITICO_DIRECIONAMENTO'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : analysis.restrictionLevel === 'ALTO_RESTRITIVO'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-emerald-600 text-white border-emerald-700'
                  }`}>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {analysis.restrictionLevel === 'CRITICO_DIRECIONAMENTO'
                      ? 'DIRECIONAMENTO CRÍTICO IDENTIFICADO'
                      : analysis.restrictionLevel === 'ALTO_RESTRITIVO'
                      ? 'ALTA RESTRITIVIDADE CONCORRENCIAL'
                      : 'CONFORME / AMPLA DISPUTA'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Auditado em {new Date(analysis.analyzedAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {analysis.technologyIdentified.name}
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed max-w-4xl">
                  {analysis.technologyIdentified.description}
                </p>
              </div>

              {/* Competitive badge metric */}
              <div className="bg-white/80 backdrop-blur-xs p-3.5 rounded-lg border border-slate-200 shadow-2xs min-w-[240px]">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Competitividade Estimada
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {analysis.competitiveAssessment.estimatedAvailableBidders} Fornecedor(es) Apto(s)
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">
                  {analysis.competitiveAssessment.riskOfFrustration}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-slate-200 gap-2">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'products'
                  ? 'border-blue-600 text-blue-600 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Fornecedores & Produtos Pesquisados ({analysis.matchingSuppliersAndProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('legal')}
              className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'legal'
                  ? 'border-blue-600 text-blue-600 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Vícios Jurídicos & Prazo ({analysis.restrictiveElements.length + 1})</span>
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'draft'
                  ? 'border-blue-600 text-blue-600 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Minuta de Impugnação / Defesa Técnica</span>
            </button>
          </div>

          {/* TAB 1: SUPPLIERS & PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Filtrar por Veredito:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFilterSupplier('ALL')}
                      className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors cursor-pointer ${
                        filterSupplier === 'ALL'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({analysis.matchingSuppliersAndProducts.length})
                    </button>
                    <button
                      onClick={() => setFilterSupplier('EQUIVALENTE')}
                      className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors cursor-pointer ${
                        filterSupplier === 'EQUIVALENTE'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Equivalentes / Superiores
                    </button>
                    <button
                      onClick={() => setFilterSupplier('PROPRIETARIA')}
                      className={`px-2.5 py-1 text-xs rounded font-semibold transition-colors cursor-pointer ${
                        filterSupplier === 'PROPRIETARIA'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Detentor da Patente
                    </button>
                  </div>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  {filteredProducts.length} produto(s) correspondente(s) identificados no mercado
                </span>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map(product => {
                  const isProprietary = product.complianceVerdict === 'TECNOLOGIA_PROPRIETARIA';
                  const isSuperior = product.complianceVerdict === 'EQUIVALENTE_SUPERIOR';

                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-xl border p-4.5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                        isProprietary
                          ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                          : isSuperior
                          ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Top Badge & Brand */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{product.brandName}</span>
                              <span className="text-[11px] text-slate-500 font-normal">({product.manufacturer})</span>
                            </div>
                            <h4 className="text-xs font-semibold text-blue-700 mt-0.5">
                              {product.productModel}
                            </h4>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                            isProprietary
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isSuperior
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {isProprietary
                              ? 'Detentor Nominal'
                              : isSuperior
                              ? 'Equivalente Superior'
                              : 'Equivalente Direto'}
                          </span>
                        </div>

                        {/* Technology & Absorption Characteristics */}
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Tecnologia de Absorção:</span>
                            <span className="font-bold text-slate-800">{product.absorptionTechnologyName}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Atenuação de Impacto:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {product.impactAttenuationPercent}
                            </span>
                          </div>

                          <p className="text-slate-600 text-[11px] leading-relaxed pt-1 border-t border-slate-200">
                            {product.absorptionCharacteristics}
                          </p>
                        </div>

                        {/* Notes */}
                        <p className="text-xs text-slate-500 italic">
                          💡 {product.notes}
                        </p>
                      </div>

                      {/* Footer Info */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Estimativa de Preço:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {product.marketPriceRangeEstimate || 'Sob Consulta'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: LEGAL IRREGULARITIES & DEADLINE */}
          {activeTab === 'legal' && (
            <div className="space-y-4">
              {/* Deadline Analysis Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Auditoria do Prazo de Entrega e Montagem
                  </h4>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-slate-600 font-medium">Prazo Exigido no Edital: </span>
                      <strong className="text-rose-800 font-bold">{analysis.deadlineAnalysis.deadlineFound}</strong>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider w-fit">
                      Prazo Exíguo / Risco de Favorecimento
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {analysis.deadlineAnalysis.rationale}
                  </p>

                  <div className="pt-2 border-t border-rose-200/60 text-xs text-slate-800 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Prazo Razoável Recomendado para o Setor: <strong>{analysis.deadlineAnalysis.recommendedDeadline}</strong></span>
                  </div>
                </div>
              </div>

              {/* Identified Legal Elements */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cláusulas Restritivas & Violações Identificadas
                </h4>

                {analysis.restrictiveElements.map((elem, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        {elem.element}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase border border-rose-200">
                        Gravidade {elem.severity}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                      "{elem.snippet}"
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-slate-700">
                        <strong className="text-slate-900">Fundamentação Legal: </strong>
                        {elem.legalViolation}
                      </div>
                      <div className="text-blue-900 bg-blue-50/60 p-2 rounded border border-blue-100 text-[11px]">
                        <strong>Jurisprudência / Súmula TCU: </strong>
                        {elem.jurisprudence}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DRAFT IMPUGNATION / DEFENSE */}
          {activeTab === 'draft' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {analysis.recommendedActionPlan.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {analysis.recommendedActionPlan.description}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                    <input
                      type="checkbox"
                      id="human-review"
                      checked={humanReviewed}
                      onChange={(e) => setHumanReviewed(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded border-amber-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="human-review" className="text-[11px] text-amber-800 font-medium cursor-pointer flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Confirmo a revisão humana desta minuta gerada por IA
                    </label>
                  </div>
                  <button
                    onClick={() => handleCopy(analysis.recommendedActionPlan.draftArgumentation, 'draft')}
                    disabled={!humanReviewed}
                    className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      !humanReviewed ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                    }`}
                  >
                    {copiedSection === 'draft' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Minuta Completa</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Legal Basis Tag */}
              <div className="bg-blue-50 text-blue-900 px-3 py-2 rounded-lg border border-blue-200 text-xs font-semibold">
                Fundamentação: {analysis.recommendedActionPlan.legalGrounding}
              </div>

              {/* Formatted Text Box */}
              <div className="relative">
                <textarea
                  readOnly
                  rows={14}
                  value={analysis.recommendedActionPlan.draftArgumentation}
                  className="w-full bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs leading-relaxed focus:outline-none select-all shadow-inner"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
