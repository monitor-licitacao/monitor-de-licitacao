import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIConfig } from '@amplitude/ai';
import { MockAmplitudeAI } from '@amplitude/ai/testing';
import {
  PROP_SESSION_ID, PROP_MODEL_NAME, PROP_PROVIDER, PROP_LATENCY_MS,
  PROP_INPUT_TOKENS, PROP_OUTPUT_TOKENS,
} from '@amplitude/ai';

// Verifica o contrato de instrumentação dos 4 agentes reais do projeto
// (sdr-agent, revops-agent, edital-ncm-analyzer, technical-spec-auditor)
// sem chamar Gemini/xAI de verdade — reproduz a mesma sequência de
// trackUserMessage/trackAiMessage/trackToolCall que o código de produção
// emite (orchestrator.ts, revops_agent.ts, gemini.ts).

test('sdr-agent: sessão de deal com decisão + tool call', async () => {
  const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full' }));
  const agent = mock.agent('sdr-agent', { userId: 'tenant-1' });

  await agent.session({ sessionId: 'deal-123' }).run(async (s) => {
    s.trackUserMessage('NOVA OPORTUNIDADE NO CRM...', { context: { dealId: '123' } });
    s.trackAiMessage('[Ação decidida via ferramenta CRM]', 'gemini-2.5-flash', 'google', 850, {
      inputTokens: 512,
      outputTokens: 40,
      totalTokens: 552,
      toolCalls: [{ name: 'move_stage', arguments: { newStage: 'proposal', reason: 'Objeto viável' } }],
    });
    s.trackToolCall('move_stage', 45, true, { input: { newStage: 'proposal' }, output: 'Card movido com sucesso' });
  });

  mock.assertEventTracked('[Agent] User Message', { userId: 'tenant-1' });
  mock.assertEventTracked('[Agent] AI Response', { userId: 'tenant-1' });
  mock.assertEventTracked('[Agent] Tool Call', { userId: 'tenant-1' });
  mock.assertSessionClosed('deal-123');

  const sessionEvents = mock.eventsForSession('deal-123');
  assert.ok(sessionEvents.length >= 3, 'esperava User Message + AI Response + Tool Call na mesma sessão');
});

test('revops-agent: sessão de briefing single-turn', async () => {
  const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full' }));
  const agent = mock.agent('revops-agent', { userId: 'tenant-1' });

  await agent.session({ sessionId: 'revops-1-123456' }).run(async (s) => {
    s.trackUserMessage('Gerar briefing estratégico de RevOps do mês atual');
    s.trackAiMessage('### Resumo Estratégico\n...', 'gemini-2.5-flash', 'google', 900, {
      inputTokens: 300,
      outputTokens: 220,
      totalTokens: 520,
    });
  });

  mock.assertEventTracked('[Agent] AI Response', { userId: 'tenant-1' });
  mock.assertSessionClosed('revops-1-123456');
});

test('edital-ncm-analyzer + technical-spec-auditor: wrapper direto (sem tool calls)', async () => {
  const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full' }));
  const editalAgent = mock.agent('edital-ncm-analyzer', { userId: 'system' });
  const techAgent = mock.agent('technical-spec-auditor', { userId: 'system' });

  await editalAgent.session({ sessionId: 'edital-analyze-ed-1' }).run(async (s) => {
    s.trackUserMessage('Analisar edital para classificação NCM 9506.91: Pregão 001/2026');
    s.trackAiMessage('{"ncmDetected":"9506.91.00"}', 'gemini-3.7-flash', 'gemini', 1200, {
      inputTokens: 4000,
      outputTokens: 300,
      totalTokens: 4300,
    });
  });

  await techAgent.session({ sessionId: 'tech-spec-PE-001-2026' }).run(async (s) => {
    s.trackUserMessage('Auditar especificação técnica restritiva');
    s.trackAiMessage('{"restrictionLevel":"ALTO_RESTRITIVO"}', 'gemini-3.7-flash', 'gemini', 1100, {
      inputTokens: 2500,
      outputTokens: 400,
      totalTokens: 2900,
    });
  });

  mock.assertSessionClosed('edital-analyze-ed-1');
  mock.assertSessionClosed('tech-spec-PE-001-2026');

  // Data quality gate — todo [Agent] AI Response precisa dos campos que o
  // Agent Analytics usa pra montar dashboards de custo/latência/token.
  const aiEvents = mock.getEvents('[Agent] AI Response');
  assert.ok(aiEvents.length >= 2);
  for (const e of aiEvents) {
    const p = e.event_properties ?? {};
    assert.ok(e.user_id || e.device_id, 'identity (userId/deviceId) ausente');
    assert.ok(p[PROP_SESSION_ID], 'sessionId ausente');
    assert.ok(p[PROP_MODEL_NAME], 'model ausente');
    assert.ok(p[PROP_PROVIDER], 'provider ausente');
    assert.ok((p[PROP_LATENCY_MS] as number) > 0, 'latency ausente');
    assert.ok((p[PROP_INPUT_TOKENS] as number) > 0, 'inputTokens ausente');
    assert.ok((p[PROP_OUTPUT_TOKENS] as number) > 0, 'outputTokens ausente');
  }
});
