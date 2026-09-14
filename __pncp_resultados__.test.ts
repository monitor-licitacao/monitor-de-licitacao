import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fixture from './server/lib/pncp/fixtures/jr-vidros-2025-1/resultados-item-1.json' with { type: 'json' };
import { createResultadosClient } from './server/lib/pncp/resultados-client.js';
import {
  ingestResultadosFromFixture,
} from './server/lib/pncp/ingest-resultados.js';
import { closeComprasGovPersistPool } from './server/lib/compras-gov/persist.js';
import { queryPriceStatsForItem } from './server/lib/pncp/query-price-stats.js';
import type { PncpItemDto, PncpItemResultadoDto } from './server/lib/pncp/types.js';

const hasDb = Boolean(process.env.DATABASE_URL);
const CONTROLE = '26963645000113-1-000001/2025';

test('resultados-client — parse fixture jr-vidros', () => {
  const body = fixture.body as PncpItemResultadoDto[];
  assert.equal(body.length, 1);
  assert.equal(body[0]!.valorUnitarioHomologado, 3100);
  assert.equal(body[0]!.niFornecedor, '12500834000145');
});

test('resultados-client — fetch live (smoke)', { skip: !process.env.PNCP_LIVE_TESTS }, async () => {
  const client = createResultadosClient();
  const rows = await client.fetchItemResultados('26963645000113', 2025, 1, 1);
  assert.ok(rows.length >= 1);
  assert.ok(rows[0]!.valorUnitarioHomologado! > 0);
});

test('ingest-resultados — persiste price_observation idempotente', { skip: !hasDb }, async () => {
  const item: PncpItemDto = {
    numeroItem: 1,
    descricao: 'Item teste vidros',
    unidadeMedida: 'Unidade',
    ncmNbsCodigo: '70071900',
    temResultado: true,
  };
  const resultados = fixture.body as PncpItemResultadoDto[];
  const map = new Map<number, PncpItemResultadoDto[]>([[1, resultados]]);

  const first = await ingestResultadosFromFixture({
    numeroControlePncp: CONTROLE,
    itens: [item],
    resultadosByItem: map,
    uf: 'SP',
  });
  assert.equal(first.ok, true);
  assert.equal(first.resultadosIngeridos, 1);
  assert.equal(first.priceObservations, 1);

  const second = await ingestResultadosFromFixture({
    numeroControlePncp: CONTROLE,
    itens: [item],
    resultadosByItem: map,
    uf: 'SP',
  });
  assert.equal(second.ok, true);
  assert.equal(second.resultadosIngeridos, 1);

  const stats = await queryPriceStatsForItem({
    ncmNbs: '70071900',
    unidade: 'Unidade',
  });
  assert.equal(stats.status, 'OK');
  assert.ok(stats.n >= 1);
  assert.equal(stats.mediana, 3100);
});

test.after(async () => {
  await closeComprasGovPersistPool();
});
