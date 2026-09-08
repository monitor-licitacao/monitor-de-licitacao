import { CRMEnvironment } from '../environments/crm_environment';
import { SDRAgent } from '../agents/sdr_agent';
import { executeTool } from '../tools/tool_registry';
import { ai as amplitudeAI, sdrAgent } from '../../lib/amplitude-ai';

export class Orchestrator {
  private env: CRMEnvironment;

  constructor() {
    this.env = new CRMEnvironment();
  }

  async runAgenticLoopForNewDeal(tenantId: string, edital: any, analysisText: string) {
    console.log(`[CRM Orchestrator] Starting episode for Edital: ${edital.processNumber}`);

    // 1. Environment Observation (New Deal created)
    const dealId = await this.env.createDeal(
      tenantId,
      edital.id,
      `Licitação ${edital.processNumber} - ${edital.sourceName}`,
      edital.estimatedValue || '0'
    );

    const initialObservation = `
NOVA OPORTUNIDADE NO CRM
========================
Processo: ${edital.processNumber}
Órgão: ${edital.sourceName}
Objeto: ${edital.objectDescription}
Valor Estimado: R$ ${edital.estimatedValue || 'Não informado'}

Resumo da IA sobre o edital:
${analysisText}

Por favor, analise a oportunidade e tome as ações necessárias usando as ferramentas disponíveis.
    `;

    // sessionId estável por deal (não por request) — mantém o episódio inteiro
    // (decisão do agente + execução das ferramentas) sob a mesma sessão/turno
    // no Agent Analytics.
    try {
      await sdrAgent.session({ sessionId: `deal-${dealId}` }).run(async (s) => {
        s.trackUserMessage(initialObservation, {
          context: { tenantId, dealId, processNumber: edital.processNumber },
        });

        // 2. Init Agent
        const agent = new SDRAgent();

        // 3. Agent Thinking & Action
        const toolCalls = await agent.processObservation(initialObservation, s);

        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
            // 4. Environment Feedback (Execute action)
            try {
              const feedback = await executeTool(call, dealId, this.env, 'sdr_agent_gemini', s);
              console.log(`[CRM Orchestrator] Tool ${call.name} executed successfully. Feedback: ${feedback}`);
            } catch (error: any) {
              console.error(`[CRM Orchestrator] Tool ${call.name} failed:`, error.message);
              await this.env.addNote(dealId, 'system', `Erro ao executar ${call.name}: ${error.message}`);
            }
          }
        } else {
          console.log(`[CRM Orchestrator] Agent didn't use any tools. Dropping...`);
          await this.env.addNote(dealId, 'sdr_agent_gemini', 'Analisei mas não tomei nenhuma ação específica.');
        }
      });
    } finally {
      await amplitudeAI.flush();
    }
  }
}
