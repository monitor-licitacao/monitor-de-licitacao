import type { Session } from '@amplitude/ai';
import { CRMEnvironment } from '../environments/crm_environment';

export const crmTools = [
  {
    name: "move_stage",
    description: "Move o negócio para um novo estágio no funil de vendas.",
    parameters: {
      type: "object",
      properties: {
        newStage: {
          type: "string",
          description: "O ID do novo estágio. Pode ser: 'qualification', 'proposal'.",
        },
        reason: {
          type: "string",
          description: "O motivo para mover de estágio.",
        }
      },
      required: ["newStage", "reason"]
    }
  },
  {
    name: "set_status",
    description: "Altera o status final do negócio (Ganho ou Perdido).",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "O status final: 'WON' (Ganho) ou 'LOST' (Perdido).",
        },
        reason: {
          type: "string",
          description: "O motivo detalhado para declarar o negócio como ganho ou perdido.",
        }
      },
      required: ["status", "reason"]
    }
  },
  {
    name: "add_note",
    description: "Adiciona uma nota ou comentário ao histórico do negócio sem alterar seu estágio.",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "O conteúdo da nota a ser salva.",
        }
      },
      required: ["note"]
    }
  },
  {
    name: "draft_email",
    description: "Rascunha um e-mail destinado ao órgão público para tirar dúvidas ou fazer solicitações.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Assunto do e-mail.",
        },
        body: {
          type: "string",
          description: "Corpo do e-mail.",
        }
      },
      required: ["subject", "body"]
    }
  }
];

export async function executeTool(toolCall: any, dealId: string, env: CRMEnvironment, actor: string = 'sdr_agent', session?: Session) {
  const { name, args } = toolCall;
  console.log(`[Tools] Agent called ${name} with args`, args);

  const start = performance.now();
  try {
    let result: string;
    switch (name) {
      case 'move_stage':
        await env.moveStage(dealId, actor, args.newStage, args.reason);
        result = `Card movido com sucesso para ${args.newStage}. Motivo: ${args.reason}`;
        break;
      case 'set_status':
        // Human in the loop rule
        if (args.status === 'LOST') {
          await env.moveStage(dealId, actor, 'lost', 'IA sugeriu desqualificar: ' + args.reason + '. Aguardando aprovação humana.');
          result = 'Status alterado para perdido. O usuário será notificado.';
        } else {
          await env.setStatus(dealId, actor, args.status, args.reason);
          result = `Status atualizado para ${args.status}.`;
        }
        break;
      case 'add_note':
        await env.addNote(dealId, actor, args.note);
        result = 'Nota adicionada com sucesso ao histórico do CRM.';
        break;
      case 'draft_email':
        await env.addNote(dealId, actor, `E-mail Rascunhado:\n\nAssunto: ${args.subject}\n\n${args.body}`);
        result = 'E-mail rascunhado e salvo nas anotações do negócio para revisão.';
        break;
      default:
        throw new Error(`Tool ${name} not found`);
    }
    session?.trackToolCall(name, performance.now() - start, true, { input: args, output: result });
    return result;
  } catch (error: any) {
    session?.trackToolCall(name, performance.now() - start, false, { input: args, errorMessage: error.message });
    throw error;
  }
}
