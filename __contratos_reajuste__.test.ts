import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReajuste,
  computeReajusteFactor,
  FIXTURE_IPCA,
} from './server/lib/contratos/reajuste.js';

test('reajuste — fator IPCA fixture', () => {
  const factor = computeReajusteFactor(FIXTURE_IPCA);
  assert.ok(factor > 1);
  const reajustado = applyReajuste(100000, factor);
  assert.ok(reajustado > 100000);
  assert.equal(typeof reajustado, 'number');
});

test('reajuste — fator 1 com série curta', () => {
  assert.equal(computeReajusteFactor([{ data: '2026-01-01', valor: 0.5 }]), 1);
});
