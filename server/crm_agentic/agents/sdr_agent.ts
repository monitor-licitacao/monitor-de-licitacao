import { tool, jsonSchema } from 'ai';
import type { Session } from '@amplitude/ai';
import { crmTools } from '../tools/tool_registry';
import { generateTextWithFallback } from '../../lib/ai';

const SYSTEM_INSTRUCTION = `Você é um Agente SDR (Sales Development Representative) especialista em licitações públicas operando dentro de um CRM B2B Autônomo.
Seu objetivo: Analisar o resumo do edital recém aprovado e decidir o próximo passo no funil de vendas.

Instruções:
1. Sempre use as ferramentas fornecidas para agir (move_stage, set_status, add_note, draft_email). NUNCA responda apenas com texto, execute uma ação no CRM.
2. Se o edital não tiver informações suficientes para qualificação, rascunhe um e-mail para o pregoeiro (draft_email) solicitando o edital completo ou esclarecimentos, e mova para "qualification" anotando o motivo (move_stage).
3. Se o objeto do edital não parecer viável (ex: valores incompatíveis, atestados que o tenant não tem), marque como LOST usando set_status e deixe o motivo explícito na nota.
4. Se for promissor, mova para "proposal" (move_stage) e deixe uma nota de recomendação estratégica para os humanos prepararem a documentação.

Respire fundo, analise os dados fornecidos pelo ambiente e invoque a ferramenta correta.`;

const tools = Object.fromEntries(
  crmTools.map(t => [
    t.name,
    tool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters as any)
    })
  ])
);

export class SDRAgent {
  async processObservation(observation: string, session?: Session) {
    console.log('[SDR Agent] Thinking...');
    const start = performance.now();
    const { text, toolCalls, response, usage } = await generateTextWithFallback({
      system: SYSTEM_INSTRUCTION,
      prompt: observation,
      tools
    });
    const latencyMs = performance.now() - start;
    const modelName = response?.modelId ?? 'unknown';
    // generateTextWithFallback tenta Gemini primeiro e cai para xAI (nomes de
    // modelo 'grok-*') — não há como saber qual respondeu além do modelId.
    const provider = modelName.includes('grok') ? 'xai' : 'google';

    session?.trackAiMessage(text || '[Ação decidida via ferramenta CRM]', modelName, provider, latencyMs, {
      inputTokens: usage?.inputTokens ?? undefined,
      outputTokens: usage?.outputTokens ?? undefined,
      totalTokens: usage?.totalTokens ?? undefined,
      toolCalls: toolCalls?.length
        ? toolCalls.map(call => ({ name: call.toolName, arguments: call.input }))
        : undefined,
    });

    if (toolCalls && toolCalls.length > 0) {
      return toolCalls.map(call => ({ name: call.toolName, args: call.input }));
    }

    // Fallback se não usar ferramenta
    return null;
  }
}
