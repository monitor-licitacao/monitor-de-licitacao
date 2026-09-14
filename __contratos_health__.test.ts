import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContractHealth,
  buildRecommendedActions,
  classificarScore,
  computeHealthScore,
  diasAteVigenciaFim,
  needsAction,
  scoreTempoRestante,
  scoreValorVsMercado,
} from './server/lib/contratos/health.js';
import type { TenantContractRow } from './server/lib/contratos/types.js';

const ref = new Date('2026-09-13T12:00:00');

test('health — limiares de status 80/50', () => {
  assert.equal(classificarScore(80), 'saudavel');
  assert.equal(classificarScore(79), 'atencao');
  assert.equal(classificarScore(50), 'atencao');
  assert.equal(classificarScore(49), 'critico');
});

test('health — tempo restante por faixa', () => {
  assert.equal(scoreTempoRestante(200), 100);
  assert.equal(scoreTempoRestante(120), 80);
  assert.equal(scoreTempoRestante(60), 50);
  assert.equal(scoreTempoRestante(15), 25);
  assert.equal(scoreTempoRestante(0), 10);
  assert.equal(scoreTempoRestante(-5), 0);
});

test('health — dias até vigência null sem data fim', () => {
  assert.equal(diasAteVigenciaFim(null, ref), null);
  assert.equal(scoreTempoRestante(null), 50);
});

test('health — vigência pendente não usa 9999 dias', () => {
  const health = buildContractHealth({
    dataVigenciaFim: null,
    orgaoCnpj: '03612122000127',
    orgaoContractCount: 1,
    hasOficioRenovacaoOuEncerramento: false,
    desvioPercentual: null,
    vigenciaExpectativa: 'aguardando_contrato',
    refDate: ref,
  });
  assert.equal(health.fatores.tempo_restante.dias_restantes, null);
  assert.equal(health.vigencia_expectativa, 'aguardando_contrato');
});

test('health — needsAction inclui atencao', () => {
  assert.equal(
    needsAction({
      contrato: { id: 'x' } as never,
      health: { status: 'atencao' } as never,
      alertas: [],
      acoes_recomendadas: [],
    }),
    true,
  );
});

test('health — dias até vigência com data', () => {
  assert.equal(diasAteVigenciaFim('2026-09-20', ref), 7);
  assert.equal(diasAteVigenciaFim('2026-09-13', ref), 0);
  assert.equal(diasAteVigenciaFim('2026-09-01', ref), -12);
});

test('health — pesos compõem score', () => {
  const score = computeHealthScore({
    tempoRestante: 100,
    riscoInstitucional: 70,
    valorVsMercado: 50,
  });
  assert.equal(score, Math.round(0.5 * 100 + 0.25 * 70 + 0.25 * 50));
});

test('health — valor vs mercado neutro sem desvio', () => {
  assert.equal(scoreValorVsMercado(null), 50);
  assert.equal(scoreValorVsMercado(3), 100);
  assert.equal(scoreValorVsMercado(-20), 30);
});

test('health — contrato vencido gera ação encerramento', () => {
  const row = {
    id: 'c1',
    tipo: 'contrato',
    numero_contrato_empenho: '045/2026',
    numero_controle_pncp: null,
    objeto: 'Objeto teste',
    orgao_cnpj: '03612122000127',
  } as TenantContractRow;

  const health = buildContractHealth({
    dataVigenciaFim: '2026-08-01',
    orgaoCnpj: row.orgao_cnpj,
    orgaoContractCount: 1,
    hasOficioRenovacaoOuEncerramento: false,
    desvioPercentual: null,
    refDate: ref,
  });

  const actions = buildRecommendedActions({ row, health, hasOficio: false });
  assert.ok(actions.some((a) => a.tipo === 'encerramento'));
  assert.equal(health.fatores.tempo_restante.dias_restantes < 0, true);
});
