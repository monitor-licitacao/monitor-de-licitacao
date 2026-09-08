import { calculateWinRate, calculateConversionRate, analyzePipelineHygiene } from '../tools/revops_tools';
import { generateTextWithFallback } from '../../lib/ai';
import { ai as amplitudeAI, revopsAgent } from '../../lib/amplitude-ai';

export class RevOpsAgent {
  /**
   * Executa a análise de RevOps gerando um relatório executivo para o Gestor Comercial.
   */
  async generateStrategicBriefing(tenantId: string) {
    const tid = parseInt(tenantId, 10);
    const now = new Date();

    // Mês atual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Coorte de 3 meses atrás (para licitações, ciclo longo)
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const cohortEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0);

    // 1. Puxar as métricas brutas através das ferramentas
    const winRateData = await calculateWinRate(tid, startOfMonth, now);
    const cohortData = await calculateConversionRate(tid, cohortStart, cohortEnd);
    const hygieneData = await analyzePipelineHygiene(tid, 30); // 30 dias de SLA por padrão

    // 2. Acionar a IA (Strategist) para interpretar
    const prompt = `
Você é o Agente de RevOps (Revenue Operations) de uma empresa que trabalha com Licitações Públicas.
Seu trabalho não é fazer contas (o Data Analyst já fez isso), mas sim EXPLICAR "O PORQUÊ" dos números.
Foque em conectar os pontos entre Leading Indicators e Lagging Indicators e alerte sobre os riscos.

DADOS FORNECIDOS PELO DATA ANALYST ESTE MÊS:
- Win Rate (Lagging Indicator): ${winRateData.winRate} (Fechados no mês: ${winRateData.totalClosed} | Ganhos: ${winRateData.won})
- Taxa de Conversão da Coorte de 3 meses atrás (Pipeline Health): ${cohortData.conversionRate} (Vendas da Coorte: ${cohortData.wonFromCohort} / Tamanho Coorte: ${cohortData.cohortSize})
- Higiene de Pipeline (Operational Risk): Existem ${hygieneData.staleCount} negócios estagnados (sem atualização há mais de ${hygieneData.slaDays} dias). Estas são as "ervas daninhas" do CRM.

DIRETRIZES:
1. Comece resumindo o cenário com base nesses 3 indicadores.
2. Seja provocativo: Mostre as mensagens conflitantes, ex: "Win Rate está alto, mas a Conversão de Coorte diz que estamos criando pouco pipeline." ou "CRM está virando um saco de oportunidades perdidas".
3. Aja como consultor: Sugira uma ação imediata (ex: forçar a equipe a classificar os ${hygieneData.staleCount} deals antigos como LOST).

RETORNO:
Devolva apenas o briefing em formato Markdown (sem blocos de código extra).
    `.trim();

    const sessionId = `revops-${tenantId}-${Date.now()}`;
    try {
      return await revopsAgent.session({ sessionId }).run(async (s) => {
        s.trackUserMessage('Gerar briefing estratégico de RevOps do mês atual', {
          context: { tenantId, winRateData, cohortData, hygieneData },
        });

        const start = performance.now();
        try {
          const { text, response, usage } = await generateTextWithFallback({
            system: "Você é um Agente RevOps altamente analítico. Conheça seus números, compreenda seus números.",
            prompt: prompt,
            maxOutputTokens: 800,
            temperature: 0.4
          });
          const latencyMs = performance.now() - start;
          const modelName = response?.modelId ?? 'unknown';
          // generateTextWithFallback tenta Gemini primeiro e cai para xAI
          // (modelos 'grok-*') — o modelId é o único jeito de saber quem respondeu.
          const provider = modelName.includes('grok') ? 'xai' : 'google';

          s.trackAiMessage(text, modelName, provider, latencyMs, {
            inputTokens: usage?.inputTokens ?? undefined,
            outputTokens: usage?.outputTokens ?? undefined,
            totalTokens: usage?.totalTokens ?? undefined,
          });

          return {
            metrics: {
              winRateData,
              cohortData,
              hygieneData
            },
            aiBriefing: text
          };
        } catch (error: any) {
          console.error('[RevOpsAgent Error]:', error);

          // Fallback heurístico em caso de falha de cota/rate limit
          const fallbackText = `### Resumo Estratégico (Fallback Heurístico)
Devido a uma instabilidade temporária na API de IA, geramos este resumo baseado em regras heurísticas:

- **Win Rate:** ${winRateData.winRate}. ${parseFloat(winRateData.winRate) < 15 ? 'Baixo. Precisamos revisar a qualificação.' : 'Saudável. Focar em volume.'}
- **Coorte (3 meses atrás):** ${cohortData.cohortSize} negócios criados, ${cohortData.wonFromCohort} convertidos (${cohortData.conversionRate}).
- **Higiene do Funil:** Temos ${hygieneData.staleCount} negócios estagnados há mais de 30 dias. Recomendação: Faça uma limpa no funil.`;

          s.trackAiMessage(fallbackText, 'heuristic-fallback', 'internal', performance.now() - start, {
            isError: true,
            errorMessage: error.message,
          });

          return {
            metrics: {
              winRateData,
              cohortData,
              hygieneData
            },
            aiBriefing: fallbackText
          };
        }
      });
    } finally {
      await amplitudeAI.flush();
    }
  }
}
