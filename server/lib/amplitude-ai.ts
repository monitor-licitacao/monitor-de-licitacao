import { AmplitudeAI, AIConfig } from '@amplitude/ai';

if (!process.env.AMPLITUDE_AI_API_KEY) {
  console.warn('AMPLITUDE_AI_API_KEY missing — Agent Analytics disabled (sessions will no-op)');
}

export const ai = new AmplitudeAI({
  apiKey: process.env.AMPLITUDE_AI_API_KEY ?? '',
  config: new AIConfig({
    contentMode: 'full',
    redactPii: true,
    // Regra de Ouro 6 (privacidade do "observer" hospedado): a maior parte
    // do conteúdo rastreado (processNumber, título/órgão do edital) já é
    // pública (vem de portais governamentais), mas os agentes de CRM também
    // trafegam dados comerciais internos (winRate, pipeline) que podem
    // referenciar CNPJ/valores monetários de fornecedores em notas. Como
    // redactPii não cobre esses formatos específicos, aplicamos um padrão
    // customizado extra antes de enviar à Amplitude.
    customRedactionPatterns: [
      // CNPJ: 99.999.999/9999-99 ou 14 dígitos seguidos
      { pattern: '\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}', replacement: '[CNPJ_REDACTED]' },
      // Valores monetários em R$ (ex.: R$ 1.234.567,89)
      { pattern: 'R\\$\\s?\\d{1,3}(\\.\\d{3})*(,\\d{2})?', replacement: '[VALOR_REDACTED]' },
    ],
  }),
});

// Agentes definidos como singletons no nível do módulo — recriar via ai.agent(...)
// a cada request gera um [Agent] Agent ID diferente por turno e quebra o
// agrupamento de sessão no Agent Analytics.
export const sdrAgent = ai.agent('sdr-agent', {
  description: 'Decide o próximo passo no funil de vendas quando um edital é aprovado (move_stage, set_status, add_note, draft_email).',
});

export const revopsAgent = ai.agent('revops-agent', {
  description: 'Gera briefing estratégico de RevOps a partir de win rate, conversão de coorte e higiene de pipeline.',
});

export const editalAnalyzerAgent = ai.agent('edital-ncm-analyzer', {
  description: 'Analisa texto de edital para classificação NCM 9506.91 e achados de conformidade legal.',
});

export const techSpecAuditorAgent = ai.agent('technical-spec-auditor', {
  description: 'Audita cláusulas de especificação técnica restritivas e gera minuta de impugnação ao edital.',
});
