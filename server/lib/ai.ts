import { generateText, type ToolSet } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

const GEMINI_MODEL = 'gemini-2.5-flash';
// xAI: usado como fallback quando o Gemini estoura quota/rate-limit
// (free tier: 5 req/min, 20/dia).
const XAI_FALLBACK_MODEL = 'grok-4.6';

interface GenerateWithFallbackOptions {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  tools?: ToolSet;
}

/**
 * Chama o Gemini primeiro; se falhar (quota, rate-limit, indisponibilidade),
 * tenta de novo com xAI usando os mesmos parâmetros, antes de propagar o
 * erro pro fallback heurístico de cada agente.
 */
export async function generateTextWithFallback({ system, prompt, maxOutputTokens, temperature, tools }: GenerateWithFallbackOptions) {
  try {
    return await generateText({
      model: google(GEMINI_MODEL),
      system,
      prompt,
      maxOutputTokens,
      temperature,
      tools,
    });
  } catch (geminiError: any) {
    console.error('[AI Fallback] Gemini falhou, tentando xAI:', geminiError.message);
    try {
      const result = await generateText({
        model: xai.chat(XAI_FALLBACK_MODEL),
        system,
        prompt,
        maxOutputTokens,
        temperature,
        tools,
      });
      console.log('[AI Fallback] xAI respondeu com sucesso.');
      return result;
    } catch (xaiError: any) {
      console.error('[AI Fallback] xAI também falhou:', xaiError.message);
      throw xaiError;
    }
  }
}

export async function analyzeEditalMultiAgent(prompt: string, editalContent: string) {
  const result = await generateTextWithFallback({
    system: "Você é um agente analisador de editais. Responda em JSON.",
    prompt: `Contexto do Edital:\n${editalContent}\n\nInstrução:\n${prompt}\n\nResponda em formato JSON com as chaves: "finalSummary" (string), "reasoning" (string), "warnings" (array of strings).`,
    maxOutputTokens: 2000,
  });

  try {
    // Tenta extrair JSON se o modelo respondeu com marcação markdown ou texto bruto
    const text = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);
    return {
      finalSummary: parsed.finalSummary || "Resumo não gerado",
      reasoning: parsed.reasoning || "{}",
      warnings: parsed.warnings || []
    };
  } catch (e) {
    return {
      finalSummary: result.text,
      reasoning: "[]",
      warnings: ["Falha ao processar JSON da IA"]
    };
  }
}
