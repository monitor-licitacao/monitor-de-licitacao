import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearCnpjCache, lookupCnpj } from './server/lib/contratos/cnpj-lookup.js';

test('lookupCnpj — BrasilAPI 200 preenche razão social', async () => {
  clearCnpjCache();
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    assert.match(url, /brasilapi\.com\.br/);
    return new Response(JSON.stringify({
      razao_social: 'SESC CE',
      uf: 'CE',
      municipio: 'Fortaleza',
    }), { status: 200 });
  }) as typeof fetch;

  const result = await lookupCnpj('03.612.122/0001-27', fetchFn);
  assert.equal(result?.cnpj, '03612122000127');
  assert.equal(result?.razao_social, 'SESC CE');
  assert.equal(result?.provider, 'brasilapi');
});

test('lookupCnpj — BrasilAPI 404 cai no ReceitaWS', async () => {
  clearCnpjCache();
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('brasilapi')) {
      return new Response('not found', { status: 404 });
    }
    assert.match(url, /receitaws\.com\.br/);
    return new Response(JSON.stringify({
      nome: 'PASSEX FITNESS',
      uf: 'ES',
      municipio: 'Vitoria',
      status: 'OK',
    }), { status: 200 });
  }) as typeof fetch;

  const result = await lookupCnpj('00394452000103', fetchFn);
  assert.equal(result?.razao_social, 'PASSEX FITNESS');
  assert.equal(result?.provider, 'receitaws');
});

test('lookupCnpj — cache evita segundo fetch', async () => {
  clearCnpjCache();
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ razao_social: 'GABINETE' }), { status: 200 });
  }) as typeof fetch;

  await lookupCnpj('12200267000101', fetchFn);
  await lookupCnpj('12200267000101', fetchFn);
  assert.equal(calls, 1);
});
