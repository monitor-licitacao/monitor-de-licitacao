import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupOrgaoRegistry, upsertOrgaoRegistry } from './server/lib/contratos/orgao-registry.js';
import { closeComprasGovPersistPool } from './server/lib/sourceLayer.js';

const hasDb = Boolean(process.env.DATABASE_URL);

test('orgao_registry — upsert + lookup registry-first', { skip: !hasDb }, async () => {
  const cnpj = '03612122000127';
  await upsertOrgaoRegistry({
    cnpj,
    razao_social: 'SESC Administração Regional no Ceará',
    uf: 'CE',
    municipio: 'Fortaleza',
    fonte: 'contratacao',
  });

  const hit = await lookupOrgaoRegistry(cnpj);
  assert.equal(hit?.fonte, 'registry');
  assert.match(hit?.razao_social ?? '', /SESC/i);
});

test('orgao_registry — CNPJ inválido não consulta', async () => {
  const hit = await lookupOrgaoRegistry('123');
  assert.equal(hit, null);
});

after(async () => {
  await closeComprasGovPersistPool();
});
