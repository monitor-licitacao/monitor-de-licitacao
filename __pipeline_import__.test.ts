import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContratacaoForPipeline } from './server/lib/pipeline/import-pncp.js';
import { buildSnapshotFromContratacao } from './server/lib/pipeline/snapshot.js';

test('import — número PNCP inválido', async () => {
  const result = await resolveContratacaoForPipeline('invalido', {
    loadByPncp: async () => null,
    ingest: async () => ({ ok: false, error: 'n/a' }),
  });
  assert.equal(result.found, false);
  if (!result.found) {
    assert.match(result.error, /inválido/i);
  }
});

test('import — 404 quando não encontra', async () => {
  const result = await resolveContratacaoForPipeline('03612122000127-1-000026/2026', {
    loadByPncp: async () => null,
    ingest: async () => ({ ok: false, error: 'Processo não encontrado.' }),
  });
  assert.equal(result.found, false);
});

test('import — snapshot SESC golden', () => {
  const snapshot = buildSnapshotFromContratacao({
    id: 'uuid-sesc',
    numero_controle_pncp: '03612122000127-1-000026/2026',
    cnpj_orgao: '03612122000127',
    orgao_razao_social: 'SESC CE',
    objeto: 'Equipamentos fitness',
    modalidade_nome: 'Pregão Eletrônico',
    valor_estimado: '150000.00',
    data_inicio_propostas: '2026-01-10T10:00:00.000Z',
    data_fim_propostas: '2026-02-10T18:00:00.000Z',
    uf: 'CE',
  });
  assert.ok(!('error' in snapshot));
  if (!('error' in snapshot)) {
    assert.equal(snapshot.numero_controle_pncp, '03612122000127-1-000026/2026');
    assert.equal(snapshot.orgao_cnpj, '03612122000127');
    assert.equal(snapshot.portal, 'PNCP');
    assert.equal(snapshot.uf_sigla, 'CE');
    assert.equal(snapshot.valor_total_estimado, 150000);
  }
});

test('import — resolve existente sem ingest', async () => {
  const result = await resolveContratacaoForPipeline('03612122000127-1-000026/2026', {
    loadByPncp: async () => ({ id: 'existing-id' }),
    ingest: async () => {
      throw new Error('ingest não deveria ser chamado');
    },
  });
  assert.equal(result.found, true);
  if (result.found) {
    assert.equal(result.contratacaoId, 'existing-id');
    assert.equal(result.ingested, false);
  }
});
