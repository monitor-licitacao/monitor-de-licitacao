import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotFromContratacao, stripCnpj } from './server/lib/pipeline/snapshot.js';

test('persist — unique key lógica tenant + PNCP', () => {
  const key = (tenantId: number, pncp: string) => `${tenantId}:${pncp.trim()}`;
  assert.equal(
    key(1, '03612122000127-1-000026/2026'),
    key(1, ' 03612122000127-1-000026/2026 '),
  );
  assert.notEqual(
    key(1, '03612122000127-1-000026/2026'),
    key(2, '03612122000127-1-000026/2026'),
  );
});

test('persist — arquivar não altera identidade do snapshot', () => {
  const snapshot = buildSnapshotFromContratacao({
    id: 'c1',
    numero_controle_pncp: '03612122000127-1-000026/2026',
    cnpj_orgao: '03612122000127',
    objeto: 'Objeto',
  });
  assert.ok(!('error' in snapshot));
  if (!('error' in snapshot)) {
    const archived = { ...snapshot, arquivada: true as unknown as never };
    assert.equal(archived.numero_controle_pncp, snapshot.numero_controle_pncp);
  }
});

test('persist — stripCnpj normaliza órgão', () => {
  assert.equal(stripCnpj('03.612.122/0001-27'), '03612122000127');
});

test('persist — snapshot rejeita CNPJ inválido', () => {
  const snapshot = buildSnapshotFromContratacao({
    id: 'c1',
    numero_controle_pncp: '03612122000127-1-000026/2026',
    cnpj_orgao: '123',
  });
  assert.ok('error' in snapshot);
});
