import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayStatus,
  mapDragToUpdate,
  isDragNoOp,
  isActivePipelineRow,
  shortPncpCode,
  maskNumeroControlePncp,
} from './server/lib/pipeline/status.js';

test('status — PERDIDA derivada de HOMOLOGADA sem vencedor', () => {
  assert.equal(displayStatus({ status: 'HOMOLOGADA', vencedor: false }), 'PERDIDA');
  assert.equal(displayStatus({ status: 'HOMOLOGADA', vencedor: true }), 'HOMOLOGADA');
  assert.equal(displayStatus({ status: 'ANALISE', vencedor: false }), 'ANALISE');
});

test('status — drag para Homologada e Perdida', () => {
  assert.deepEqual(mapDragToUpdate('HOMOLOGADA'), { status: 'HOMOLOGADA', vencedor: true });
  assert.deepEqual(mapDragToUpdate('PERDIDA'), { status: 'HOMOLOGADA', vencedor: false });
  assert.deepEqual(mapDragToUpdate('ANALISE'), { status: 'ANALISE', vencedor: false });
});

test('status — no-op na mesma coluna', () => {
  assert.equal(
    isDragNoOp({ status: 'HOMOLOGADA', vencedor: true }, 'HOMOLOGADA'),
    true,
  );
  assert.equal(
    isDragNoOp({ status: 'HOMOLOGADA', vencedor: false }, 'PERDIDA'),
    true,
  );
  assert.equal(
    isDragNoOp({ status: 'ANALISE', vencedor: false }, 'SELECIONADA'),
    false,
  );
});

test('status — ativa exclui terminais', () => {
  assert.equal(isActivePipelineRow({ status: 'SELECIONADA', vencedor: false }), true);
  assert.equal(isActivePipelineRow({ status: 'HOMOLOGADA', vencedor: true }), false);
  assert.equal(isActivePipelineRow({ status: 'HOMOLOGADA', vencedor: false }), false);
  assert.equal(isActivePipelineRow({ status: 'CANCELADA', vencedor: false }), false);
});

test('status — código curto PNCP', () => {
  assert.equal(shortPncpCode('03612122000127-1-000026/2026'), '000026');
});

test('status — máscara PNCP', () => {
  assert.equal(
    maskNumeroControlePncp('0361212200012710000262026'),
    '03612122000127-1-000026/2026',
  );
});
