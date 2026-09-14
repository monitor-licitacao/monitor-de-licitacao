import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPriceJoinKey,
  computePriceStats,
  percentile,
  resolvePriceStatsFromObservations,
} from './server/lib/pncp/price-cross.js';
import { canonizeUnidade } from './server/lib/pncp/unidade-canonica.js';

test('canonizeUnidade — normaliza variantes de UN', () => {
  assert.equal(canonizeUnidade('Unidade    '), 'UN');
  assert.equal(canonizeUnidade('UNID.'), 'UN');
  assert.equal(canonizeUnidade('UND'), 'UN');
});

test('percentile — mediana e quartis', () => {
  const sorted = [100, 200, 300, 400, 500];
  assert.equal(percentile(sorted, 0.5), 300);
  assert.equal(percentile(sorted, 0.25), 200);
  assert.equal(percentile(sorted, 0.75), 400);
});

test('computePriceStats — OK com n observações', () => {
  const stats = computePriceStats([3100, 3200, 2900], {
    joinLevel: 'NCM',
    confidence: 'MEDIUM',
    label: 'NCM 90181980',
  });
  assert.equal(stats.status, 'OK');
  assert.equal(stats.n, 3);
  assert.equal(stats.mediana, 3100);
  assert.equal(stats.join_level, 'NCM');
});

test('resolvePriceStatsFromObservations — CATMAT HIGH', () => {
  const stats = resolvePriceStatsFromObservations(
    [{ valorUnitarioHomologado: 3100 }, { valorUnitarioHomologado: 3300 }],
    { codigoCatalogo: 268925, catalogType: 'CATMAT' },
  );
  assert.equal(stats.status, 'OK');
  assert.equal(stats.confidence, 'HIGH');
  assert.equal(stats.join_level, 'CATMAT');
});

test('resolvePriceStatsFromObservations — sem chave → INSUFICIENTE', () => {
  const stats = resolvePriceStatsFromObservations([], {});
  assert.equal(stats.status, 'INSUFICIENTE');
  assert.equal(stats.n, 0);
});

test('buildPriceJoinKey — NCM do raw PNCP', () => {
  const key = buildPriceJoinKey({
    ncmNbs: '90181980',
    unidade: 'UN',
  });
  assert.equal(key.ncmNbs, '90181980');
  assert.equal(key.unidade, 'UN');
});
