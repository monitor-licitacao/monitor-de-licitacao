import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIDADES_MEDIDA, listUnidades } from './server/lib/contratos/unidades.js';

test('unidades — catálogo Licinexus dump', () => {
  assert.ok(UNIDADES_MEDIDA.length >= 60);
  const siglas = new Set(UNIDADES_MEDIDA.map((u) => u.sigla));
  assert.ok(siglas.has('UN'));
  assert.ok(siglas.has('PC'));
  assert.ok(siglas.has('SERV'));
  assert.ok(siglas.has('KG'));
});

test('unidades — listUnidades retorna cópia estável', () => {
  const list = listUnidades();
  assert.equal(list.length, UNIDADES_MEDIDA.length);
  assert.equal(list[0].sigla, 'UN');
});
