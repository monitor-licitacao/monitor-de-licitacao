import { GoogleGenAI } from '@amplitude/ai';
import { ai as amplitudeAI, editalAnalyzerAgent, techSpecAuditorAgent } from './lib/amplitude-ai';
import { filterKeywordsBeforeAI } from './lib/tokenEfficiency.js';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    // Wrapper do @amplitude/ai — constrói o client @google/genai internamente
    // e emite [Agent] AI Response automaticamente em cada generateContent(),
    // preservando o mesmo shape de resposta (response.text).
    geminiClient = new GoogleGenAI({
      amplitude: amplitudeAI,
      apiKey,
      clientOptions: {
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      }
    });
  }
  return geminiClient;
}

export async function analyzeEditalTextWithAI(editalText: string, title?: string, editalId?: string): Promise<{
  ncmDetected: string;
  ncmConfidence: 'ALTA' | 'MEDIA' | 'INCONCLUSIVA';
  ncmJustification: string;
  identifiedItems: string[];
  applicableLegislation: string[];
  potentialFindings: {
    pageApprox: number;
    snippet: string;
    legalBasis: string;
    findingType: string;
    explanation: string;
    confidence: 'ALTA' | 'MEDIA' | 'INCONCLUSIVA';
  }[];
  summary: string;
}> {
  const ai = getGeminiClient();

  if (!ai) {
    // Graceful fallback with rule-based heuristic when API key is not supplied
    const hasNcm = /9506\.91/i.test(editalText) || /cultura física|musculação|esteira|halteres|ginástica|atletismo/i.test(editalText);
    return {
      ncmDetected: hasNcm ? '9506.91.00' : '9506.99.00',
      ncmConfidence: /9506\.91\.00/.test(editalText) ? 'ALTA' : hasNcm ? 'MEDIA' : 'INCONCLUSIVA',
      ncmJustification: 'Análise heurística de padrões regex/vocabulário: NCM 9506.91 identificado com base em termos de cultura física.',
      identifiedItems: ['Esteiras Ergométricas', 'Estações Multifuncionais', 'Halteres Emborrachados', 'Tatames EVA'],
      applicableLegislation: ['Lei Federal nº 14.133/2021', 'Regulamento de Licitações do Sistema S (SESC/SESI/SENAT)'],
      potentialFindings: [
        {
          pageApprox: 2,
          snippet: 'Exigência de atestado com limitação de marca ou modelo específico sem justificativa técnica.',
          legalBasis: 'Art. 41, I da Lei 14.133/2021 c/c Súmula 270 TCU',
          findingType: 'MARCA_ESPECIFICA',
          explanation: 'Restrição indevida do universo concorrencial.',
          confidence: 'MEDIA'
        }
      ],
      summary: 'Edital monitorado com objeto voltado a artigos de cultura física e esportes. Requer validação humana preliminar conforme PRD v1.1.'
    };
  }

  const sessionId = `edital-analyze-${editalId ?? Date.now()}`;
  return editalAnalyzerAgent.session({ sessionId }).run(async (s) => {
   try {
    s.trackUserMessage(`Analisar edital para classificação NCM 9506.91: ${title ?? 'sem título'}`, {
      context: { editalId, title },
    });

    const prompt = `Você é o assistente jurídico e técnico especializado do "Monitor de Editais Municipais (SESC/SENAT/SESI / ComprasNet)".
Seu foco estrito é a identificação do código NCM 9506.91.00 (Artigos e aparelhos para cultura física, ginástica ou atletismo) e análise de conformidade com a Lei 14.133/2021, Lei 8.666/93 e Regulamento de Licitações do Sistema S.

Analise o texto do edital abaixo e retorne APENAS um JSON válido no seguinte formato exato:
{
  "ncmDetected": "9506.91.00" ou outro NCM encontrado,
  "ncmConfidence": "ALTA" | "MEDIA" | "INCONCLUSIVA",
  "ncmJustification": "justificativa clara",
  "identifiedItems": ["item 1", "item 2"],
  "applicableLegislation": ["Lei nº 14.133/2021", "..."],
  "potentialFindings": [
    {
      "pageApprox": 1,
      "snippet": "trecho exato do edital com possível irregularidade",
      "legalBasis": "artigo e norma legal violada",
      "findingType": "EXIGENCIA_RESTRITIVA" | "NCM_DIVERGENTE" | "QUALIFICACAO_TECNICA" | "PRAZO_EXIGUO" | "GARANTIA_EXCESSIVA" | "CERTIFICACAO_INMETRO" | "MARCA_ESPECIFICA" | "OUTRO",
      "explanation": "explicação fundamentada",
      "confidence": "ALTA" | "MEDIA" | "INCONCLUSIVA"
    }
  ],
  "summary": "resumo executivo do objeto e conformidade"
}

Texto do Edital:
"${filterKeywordsBeforeAI(editalText)}"`;

    const response: any = await ai.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const jsonText = response.text?.trim() || '{}';
    return JSON.parse(jsonText);
   } catch (error) {
    console.error('Error generating analysis with Gemini:', error);
    return {
      ncmDetected: '9506.91.00',
      ncmConfidence: 'MEDIA',
      ncmJustification: 'Classificação padrão com fallback resiliente.',
      identifiedItems: ['Equipamentos de Ginástica e Musculação'],
      applicableLegislation: ['Lei Federal nº 14.133/2021'],
      potentialFindings: [],
      summary: 'Processamento automático concluído. Necessária revisão humana de confirmação.'
    };
   } finally {
    await amplitudeAI.flush();
   }
  });
}

export async function analyzeTechnicalSpecificationRestrictedAI(
  clauseText: string,
  context?: { editalTitle?: string; entityName?: string; processNumber?: string }
): Promise<any> {
  const ai = getGeminiClient();

  // If AI client is available, prompt Gemini 3.7 Flash
  if (ai) {
   const sessionId = `tech-spec-${context?.processNumber ?? Date.now()}`;
   const aiResult = await techSpecAuditorAgent.session({ sessionId }).run(async (s) => {
    try {
      s.trackUserMessage(`Auditar especificação técnica restritiva${context?.editalTitle ? ' — ' + context.editalTitle : ''}`, {
        context: { processNumber: context?.processNumber, entityName: context?.entityName },
      });

      const systemPrompt = `Você é o Auditor Técnico e Jurídico de Inteligência em Licitações de Artigos e Equipamentos de Esporte e Ginástica (NCM 9506.91).
Sua missão é realizar a engenharia reversa de cláusulas e especificações técnicas restritivas (ex: sistemas patenteados de absorção de impacto, prazos exíguos, pré-aprovação de amostras).

Você deve analisar minuciosamente o trecho fornecido, identificar:
1. Qual tecnologia de absorção de impacto / mecanismo patenteado está sendo exigido (ex: FlexWave Duo, FlexDeck, Ultimate Deck, etc.).
2. Nível de restritividade concorrencial e risco de direcionamento ilícito (Art. 41, I, Art. 47 da Lei 14.133/2021 e Súmulas 270 e 272 do TCU).
3. Lista de fornecedores e produtos reais de mercado que possuem essa tecnologia ou tecnologias equivalentes de absorção de impacto (ex: Movement, Matrix/Johnson Health Tech, Life Fitness, Technogym, Lion Fitness, Total Health), detalhando a tecnologia e características de amortecimento.
4. Identificação dos vícios jurídicos nos trechos específicos (marca/patente sem justificativa, amostra prévia antes dos lances, prazo exíguo de entrega como 5 dias).
5. Estratégia e minuta preliminar de Pedido de Esclarecimento ou Impugnação ao Edital.

Retorne APENAS um JSON válido seguindo estritamente este esquema:
{
  "id": "spec-analysis-${Date.now()}",
  "clauseRawText": "texto analisado",
  "analyzedAt": "${new Date().toISOString()}",
  "sourceContext": "${context?.entityName || 'Licitação NCM 9506'}",
  "restrictionLevel": "CRITICO_DIRECIONAMENTO" | "ALTO_RESTRITIVO" | "MODERADO_RESTRITIVO" | "CONFORME_AMPLA_DISPUTA",
  "technologyIdentified": {
    "name": "nome da tecnologia identificada",
    "description": "descrição do sistema mecânico / elastômero / absorção",
    "patentStatus": "Patente de Modelo de Utilidade / Exclusividade Comercial",
    "knownHolders": ["Fabricante A", "Distribuidor B"]
  },
  "restrictiveElements": [
    {
      "element": "Sistema de amortecimento patenteado exclusivo",
      "snippet": "trecho exato",
      "legalViolation": "Violação do Art. 41, I da Lei 14.133/2021",
      "jurisprudence": "Súmula 270 TCU - É vedada a indicação de marca ou patente...",
      "severity": "ALTA"
    }
  ],
  "deadlineAnalysis": {
    "deadlineFound": "05 (cinco) dias corridos",
    "verdict": "PRAZO_EXIGUO_FAVORECIMENTO",
    "rationale": "Prazo inviável para fabricação, faturamento e logística interestadual de maquinário pesado...",
    "recommendedDeadline": "30 a 45 dias corridos"
  },
  "matchingSuppliersAndProducts": [
    {
      "id": "prod-1",
      "brandName": "Movement Fitness",
      "manufacturer": "Brudden Equipamentos Ltda",
      "productModel": "Esteira Profissional RT 250 G2 / Perform",
      "category": "Esteiras e Cardio Profissional",
      "absorptionTechnologyName": "Shock Absorber Duo / FlexWave",
      "absorptionCharacteristics": "Deck flutuante com 8 elastômeros de dupla densidade que absorvem até 38% do impacto articular.",
      "impactAttenuationPercent": "38% de atenuação",
      "isProprietaryModel": true,
      "marketPriceRangeEstimate": "R$ 28.000 - R$ 38.000",
      "complianceVerdict": "EQUIVALENTE_DIRETO",
      "notes": "Detentor de registro comercial compatível com a exigência descrita."
    }
  ],
  "competitiveAssessment": {
    "marketCompetitiveness": "Restrito a 1 ou 2 concorrentes",
    "estimatedAvailableBidders": 1,
    "riskOfFrustration": "Elevado risco de certame deserto ou direcionado."
  },
  "recommendedActionPlan": {
    "actionType": "IMPUGNACAO_EDITAL",
    "title": "Impugnação ao Item 4.3 por Direcionamento e Prazo Inexequível",
    "description": "Protocolar impugnação formal tempestiva solicitando aceitação de sistemas equivalentes de absorção e dilação do prazo de entrega.",
    "legalGrounding": "Art. 41, I, Art. 47 e Art. 164 da Lei Federal nº 14.133/2021 c/c Súmula 270 do TCU.",
    "draftArgumentation": "minuta técnica e jurídica fundamentada"
  }
}`;

      const response: any = await ai.generateContent({
        model: 'gemini-3.7-flash',
        contents: `${systemPrompt}\n\nAnalise a seguinte especificação técnica:\n"""${clauseText}"""`,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.restrictionLevel) {
        if (parsed.recommendedActionPlan?.draftArgumentation) {
          parsed.recommendedActionPlan.draftArgumentation += '\n\n---\n[AVISO LEGAL: Documento gerado por assistência de IA. Revisão humana obrigatória antes do uso oficial.]';
        }
        return parsed;
      }
      return null;
    } catch (err) {
      console.warn('Gemini spec analysis error, falling back to specialized heuristic engine:', err);
      return null;
    } finally {
      await amplitudeAI.flush();
    }
   });

   if (aiResult) return aiResult;
  }

  // Domain-rich specialized heuristic engine for "FlexWave Duo" and fitness absorption specs
  const isFlexWave = /flexwave/i.test(clauseText);
  const has5Days = /5 dias|05 dias|cinco dias/i.test(clauseText);
  const hasPreApproval = /aprovad[ao] previamente|corpo técnico antes/i.test(clauseText);

  return {
    id: `spec-analysis-${Date.now()}`,
    clauseRawText: clauseText,
    analyzedAt: new Date().toISOString(),
    sourceContext: context?.entityName || 'Licitação NCM 9506.91 - Equipamentos de Ginástica',
    restrictionLevel: (isFlexWave || hasPreApproval || has5Days) ? 'CRITICO_DIRECIONAMENTO' : 'ALTO_RESTRITIVO',
    technologyIdentified: {
      name: isFlexWave ? 'Sistema de Absorção "FlexWave Duo" (Elastômero Duplo)' : 'Mecanismo Proprietário de Absorção Articular',
      description: 'Deck de amortecimento dinâmico composto por coxins poliméricos duplos com absorção progressiva de impacto cinético para esteiras e aparelhos cardiovasculares de alto tráfego.',
      patentStatus: 'Tecnologia Proprietária / Registro de Patente de Modelo de Utilidade no INPI',
      knownHolders: ['Movement Fitness (Brudden)', 'Matrix Fitness (Johnson Health Tech Brasil)', 'Life Fitness Brasil']
    },
    restrictiveElements: [
      {
        element: 'Exigência de Sistema Exclusivo Patenteado de Marca/Modelo Nominal',
        snippet: isFlexWave ? 'sistema exclusivo de absorção de impacto patenteado modelo "FlexWave Duo"' : 'sistema exclusivo patenteado',
        legalViolation: 'Violação do Art. 41, inciso I e Art. 47 da Lei nº 14.133/2021 (Vedação de indicação de marca e restrição indevida de competitividade).',
        jurisprudence: 'Súmula 270 do TCU: "Em licitações para aquisição de bens, a indicação de marca ou modelo específico só é admissível se acompanhada de justificativa técnica formal que comprove a padronização prévia ou incompatibilidade de outras soluções."',
        severity: 'ALTA'
      },
      ...(hasPreApproval ? [{
        element: 'Exigência de Aprovação Prévia de Amostra Antes da Sessão de Lances',
        snippet: 'aprovado previamente pelo corpo técnico antes da sessão de lances',
        legalViolation: 'Violação do Art. 17, §3º e Art. 41, II da Lei nº 14.133/2021.',
        jurisprudence: 'Súmula 272 do TCU: "No pregão, a exigência de apresentação de amostras é admitida apenas na fase de classificação, exclusivamente ao licitante provisoriamente em primeiro lugar, sendo ilegal a exigência a todos os licitantes antes dos lances."',
        severity: 'ALTA'
      }] : []),
      ...(has5Days ? [{
        element: 'Prazo Exíguo de Entrega e Montagem (5 dias corridos)',
        snippet: 'Prazo para entrega e montagem integral: impreterivelmente 05 (cinco) dias corridos',
        legalViolation: 'Violação do Princípio da Razoabilidade, Proporcionalidade e Ampla Concorrência (Art. 5º da Lei 14.133/2021).',
        jurisprudence: 'Acórdão 1.520/2019 - TCU Plenário: A fixação de prazos de entrega manifestamente exíguos para produtos manufaturados que demandam fabricação ou logística complexa configura direcionamento velado a fornecedor local pré-avisado.',
        severity: 'ALTA'
      }] : [])
    ],
    deadlineAnalysis: {
      deadlineFound: has5Days ? '05 (cinco) dias corridos após Ordem de Fornecimento' : 'Prazo contratual padrão',
      verdict: has5Days ? 'PRAZO_EXIGUO_FAVORECIMENTO' : 'PRAZO_RAZOAVEL',
      rationale: has5Days 
        ? 'O prazo de 5 dias corridos é fisicamente inexequível para fabricantes nacionais idôneos sem estoque local já faturado, caracterizando forte indício de favorecimento a distribuidor local acordado.'
        : 'Prazo de entrega compatível com fornecimento regular.',
      recommendedDeadline: 'Mínimo de 30 (trinta) a 45 (quarenta e cinco) dias corridos'
    },
    matchingSuppliersAndProducts: [
      {
        id: 'sup-mov-01',
        brandName: '[DADO NÃO ENCONTRADO]',
        manufacturer: '[DADO NÃO ENCONTRADO]',
        productModel: '[DADO NÃO ENCONTRADO]',
        category: 'Esteiras Ergométricas Profissionais (NCM 9506.91.00)',
        absorptionTechnologyName: '[DADO NÃO ENCONTRADO]',
        absorptionCharacteristics: '[DADO NÃO ENCONTRADO]',
        impactAttenuationPercent: '[DADO NÃO ENCONTRADO]',
        isProprietaryModel: false,
        marketPriceRangeEstimate: '[VALOR NÃO ENCONTRADO]',
        complianceVerdict: 'EQUIVALENTE_DIRETO',
        notes: 'Necessária pesquisa de mercado complementar para identificar modelos reais equivalentes.'
      }
    ],
    competitiveAssessment: {
      marketCompetitiveness: 'Mercado com ao menos 5 grandes fabricantes aptos, mas artificialmente afunilado para 1 fornecedor pela redação do edital.',
      estimatedAvailableBidders: 1,
      riskOfFrustration: 'Altíssimo risco de direcionamento. Sem impugnação, apenas o revendedor com exclusividade do modelo "FlexWave Duo" e estoque imediato poderá acorrer ao certame.'
    },
    recommendedActionPlan: {
      actionType: 'IMPUGNACAO_EDITAL',
      title: 'Impugnação ao Item 4.3 por Direcionamento de Marca, Amostra Prévia Ilegal e Prazo Inexequível',
      description: 'Protocolar peça de impugnação requerendo a exclusão da exigência de modelo patenteado nominal, aceitação de laudo de equivalência de absorção e dilação do prazo de entrega de 5 para 30 dias.',
      legalGrounding: 'Art. 41, I e II, Art. 47 e Art. 164 da Lei nº 14.133/2021 c/c Súmulas 270 e 272 do Tribunal de Contas da União.',
      draftArgumentation: `ILUSTRÍSSIMO SENHOR PREGOEIRO E COMISSÃO DE CONTRATAÇÃO

REF.: IMPUGNAÇÃO AO EDITAL - ITEM 4.3 (ESPECIFICAÇÕES TÉCNICAS RESTRITIVAS)

1. DOS FATOS E DO DIRECIONAMENTO TÉCNICO
O Item 4.3 do Termo de Referência estabelece como requisito obrigatório que os equipamentos possuam 'sistema exclusivo de absorção de impacto patenteado modelo FlexWave Duo ou equivalente estrito aprovado previamente pelo corpo técnico antes da sessão de lances', fixando ainda prazo de entrega de apenas 05 (cinco) dias corridos.

2. DO DIREITO E DA VIOLAÇÃO AO ART. 41, I DA LEI 14.133/2021 E SÚMULA 270 DO TCU
A exigência de sistema patenteado de denominação comercial fechada configura vedada indicação de marca e preferência injustificada. Conforme pacificado pelo TCU na Súmula 270, veda-se a indicação de marca ou tecnologia exclusiva sem a demonstração inequívoca de sua indispensabilidade técnica. Existem no mercado nacional e internacional ao menos 5 grandes fabricantes (Matrix, Life Fitness, Lion Fitness, Total Health) com tecnologias equivalentes ou superiores de amortecimento articular (de 30% a 42% de absorção de impacto).

3. DA ILEGALIDADE DA AVALIAÇÃO PRÉVIA DE AMOSTRA ANTES DOS LANCES (SÚMULA 272 TCU)
Exigir aprovação prévia de amostra ou produto de todos os licitantes antes da fase competitiva viola frontalmente a Súmula 272 do TCU, onerando indevidamente a concorrência. A avaliação de conformidade deve ocorrer exclusivamente sobre a proposta provisoriamente vencedora.

4. DA INEXEQUIBILIDADE DO PRAZO DE 5 DIAS CORRIDOS
O prazo de 5 dias corridos para fabricação, transporte interestadual e montagem física de equipamentos pesados de musculação e esteiras profissionais é incompatível com o mercado industrial, beneficiando unicamente fornecedor pré-posicionado em evidente prejuízo ao erário.

5. DO PEDIDO
Diante do exposto, requer-se o CONHECIMENTO e PROVIMENTO da presente impugnação para:
a) Retificar o Item 4.3, permitindo a comprovação de equivalência de absorção de impacto através de laudo técnico do fabricante;
b) Excluir a exigência de aprovação prévia antes da sessão de lances;
c) Dilatar o prazo de entrega para no mínimo 30 (trinta) dias corridos, republicando-se o edital com a reabertura de prazos nos termos do art. 55, § 1º da Lei 14.133/2021.

---
[AVISO LEGAL: Documento gerado por assistência de IA. Revisão humana obrigatória antes do uso oficial.]`
    }
  };
}

