import { generateText, type ToolSet } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createOpenAI } from '@ai-sdk/openai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

// Ollama OpenAI-compatible API (default: http://127.0.0.1:11434/v1)
// hermes3:3b NÃO suporta "thinking" — nunca envie think/reasoning para esse modelo.
const ollama = createOpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  apiKey: process.env.OLLAMA_API_KEY || 'ollama',
  name: 'ollama',
});

const GEMINI_MODEL = 'gemini-2.5-flash';
const XAI_FALLBACK_MODEL = 'grok-4.6';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'hermes3:3b';
const OLLAMA_ENABLED = (process.env.OLLAMA_ENABLED || 'true').toLowerCase() === 'true';

interface GenerateWithFallbackOptions {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  tools?: ToolSet;
}

type ProviderAttempt = {
  name: string;
  run: () => ReturnType<typeof generateText>;
};

function buildAttempts({ system, prompt, maxOutputTokens, temperature, tools }: GenerateWithFallbackOptions): ProviderAttempt[] {
  const attempts: ProviderAttempt[] = [];

  if (OLLAMA_ENABLED) {
    attempts.push({
      name: 'ollama',
      // chat() usa o endpoint /v1/chat/completions — sem think/reasoning
      run: () =>
        generateText({
          model: ollama.chat(OLLAMA_MODEL),
          system,
          prompt,
          maxOutputTokens,
          temperature,
          tools,
        }),
    });
  }

  if (process.env.GEMINI_API_KEY) {
    attempts.push({
      name: 'gemini',
      run: () =>
        generateText({
          model: google(GEMINI_MODEL),
          system,
          prompt,
          maxOutputTokens,
          temperature,
          tools,
        }),
    });
  }

  if (process.env.XAI_API_KEY) {
    attempts.push({
      name: 'xai',
      run: () =>
        generateText({
          model: xai.chat(XAI_FALLBACK_MODEL),
          system,
          prompt,
          maxOutputTokens,
          temperature,
          tools,
        }),
    });
  }

  return attempts;
}

/**
 * Ordem: Ollama (local) → Gemini → xAI.
 * hermes3:3b rejeita think=true com 400; usamos só o path chat OpenAI-compatible.
 */
export async function generateTextWithFallback(options: GenerateWithFallbackOptions) {
  const attempts = buildAttempts(options);
  if (attempts.length === 0) {
    throw new Error('Nenhum provider de IA configurado (OLLAMA / GEMINI_API_KEY / XAI_API_KEY).');
  }

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const result = await attempt.run();
      if (i > 0) {
        console.log(`[AI Fallback] ${attempt.name} respondeu com sucesso.`);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const next = attempts[i + 1]?.name;
      console.error(
        `[AI Fallback] ${attempt.name} falhou${next ? `, tentando ${next}` : ''}:`,
        err?.message || err,
      );
    }
  }

  throw lastError;
}

/** Health check leve da API Ollama (tags). Suporta localhost e ollama.com (Bearer). */
export async function checkOllamaHealth(timeoutMs = 1500): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/v1\/?$/, '');
  const apiKey = process.env.OLLAMA_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey && apiKey !== 'ollama' && base.includes('ollama.com')) {
    headers.Authorization = 'Bearer ' + apiKey;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/tags`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, models: [], error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: { name: string }[] };
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, models: [], error: `timeout after ${timeoutMs}ms` };
    }
    return { ok: false, models: [], error: err?.message || String(err) };
  } finally {
    clearTimeout(timeout);
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
