import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCatmatItem } from './server/lib/compras-gov/normalize-catalog.js';
import { normalizePgcDfd } from './server/lib/compras-gov/normalize-pgc.js';
import {
  CG_SOURCE,
  closeComprasGovPersistPool,
  getCatalogItemByCodigo,
  persistCatalogItem,
  persistContratacaoIdCompra,
  persistPgcDfdBatch,
  recordSourceHealth,
  upsertSourceRecord,
} from './server/lib/compras-gov/persist.js';
import type {
  ComprasGovCatmatItemDto,
  ComprasGovContratacao14133Dto,
  ComprasGovPgcDetalheDto,
} from './server/lib/compras-gov/types.js';
import { PASSEX_GOLDEN } from './server/lib/compras-gov/compare-passex.js';
import {
  isPncpSufficient,
  planEnrichment,
} from './server/lib/compras-gov/enrichment-policy.js';
import {
  runEnrichComprasGovJob,
  type EnrichClientAdapter,
} from './server/lib/compras-gov/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'server/lib/compras-gov/fixtures');

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, rel), 'utf8')) as T;
}

const hasDb = Boolean(process.env.DATABASE_URL);

test('normalize — CATMAT 261521 SWITCH', () => {
  const dto = loadJson<{ resultado: ComprasGovCatmatItemDto[] }>('catmat-261521-switch.json').resultado[0];
  const row = normalizeCatmatItem(dto);
  assert.equal(row.catalogType, 'CATMAT');
  assert.equal(row.codigoItem, 261521);
  assert.equal(row.nomePdm, 'SWITCH');
  assert.equal(row.codigoPdm, 5522);
});

test('normalize — PGC DFD Gabinete', () => {
  const dto = loadJson<{ resultado: ComprasGovPgcDetalheDto[] }>('gabinete-pgc-2026-sample.json').resultado[0];
  const row = normalizePgcDfd(dto);
  assert.equal(row.orgaoCnpj, '12200267000101');
  assert.equal(row.ano, 2026);
  assert.equal(row.catalogType, 'CATMAT');
});

test('persist — id_compra Passex golden (SESC contratação existente)', { skip: !hasDb }, async () => {
  const passexCg = loadJson<{ body: { resultado: ComprasGovContratacao14133Dto[] } }>(
    'passex-19732/dados-abertos-contratacao.json',
  ).body.resultado[0];

  const sescCg = loadJson<{ resultado: ComprasGovContratacao14133Dto[] }>(
    'sesc-ce-026-contratacao.json',
  ).resultado[0];

  const sourceId = await upsertSourceRecord({
    source: CG_SOURCE,
    entityType: 'contratacao_14133',
    identifier: sescCg.numeroControlePNCP,
    sourceUrl: 'fixture://sesc-ce-026',
    rawPayload: sescCg,
  });

  const { updated, idCompra } = await persistContratacaoIdCompra(
    '03612122000127-1-000026/2026',
    sescCg,
    sourceId,
  );

  assert.equal(updated, true);
  assert.ok(idCompra);

  // Passex id_compra value from golden fixture
  assert.equal(passexCg.idCompra, PASSEX_GOLDEN.idCompra);
});

test('persist — CATMAT 261521 idempotente', { skip: !hasDb }, async () => {
  const dto = loadJson<{ resultado: ComprasGovCatmatItemDto[] }>('catmat-261521-switch.json').resultado[0];
  const sourceId = await upsertSourceRecord({
    source: CG_SOURCE,
    entityType: 'catmat_item',
    identifier: String(dto.codigoItem),
    rawPayload: dto,
  });

  const first = await persistCatalogItem(dto, sourceId);
  const second = await persistCatalogItem(dto, sourceId);
  assert.equal(first.codigoItem, 261521);
  assert.equal(second.id, first.id);

  const loaded = await getCatalogItemByCodigo('CATMAT', 261521);
  assert.ok(loaded);
  assert.equal(loaded?.nomePdm, 'SWITCH');
});

test('persist — PGC DFD batch (sample fixture)', { skip: !hasDb }, async () => {
  const dfds = loadJson<{ resultado: ComprasGovPgcDetalheDto[] }>('gabinete-pgc-2026-sample.json').resultado;
  const sourceId = await upsertSourceRecord({
    source: CG_SOURCE,
    entityType: 'pgc_detalhe',
    identifier: '12200267000101:2026:sample',
    rawPayload: dfds,
  });

  const count = await persistPgcDfdBatch(dfds, sourceId);
  assert.equal(count, dfds.length);
});

test('persist — source_health success', { skip: !hasDb }, async () => {
  await recordSourceHealth(CG_SOURCE, true);
});

test('policy — Passex PNCP_SUFFICIENT (17 itens com valores)', () => {
  const itens = loadJson<{ body: Array<{ valorTotal: number; orcamentoSigiloso: boolean }> }>(
    'passex-19732/pncp-itens.json',
  ).body;
  const plan = planEnrichment({
    mode: 'contratacao',
    pncpItemCount: itens.length,
    items: itens.map((i) => ({
      valorTotalEstimado: i.valorTotal,
      orcamentoSigiloso: i.orcamentoSigiloso,
    })),
    orcamentoSigilosoCodigo: 1,
  });
  assert.ok(plan.decisions.includes('PNCP_SUFFICIENT'));
  assert.equal(plan.fetchCgItems, false);
  assert.equal(isPncpSufficient({
    mode: 'contratacao',
    pncpItemCount: 17,
    items: itens.map((i) => ({ valorTotalEstimado: i.valorTotal, orcamentoSigiloso: false })),
    orcamentoSigilosoCodigo: 1,
  }), true);
});

test('policy — SESC sigilo parcial (valores zerados)', () => {
  const plan = planEnrichment({
    mode: 'contratacao',
    pncpItemCount: 14,
    items: Array.from({ length: 14 }, () => ({
      valorUnitarioEstimado: 0,
      valorTotalEstimado: 0,
      orcamentoSigiloso: false,
    })),
    orcamentoSigilosoCodigo: 1,
    linkSistemaOrigem: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=45102305000062026',
  });
  assert.ok(!plan.decisions.includes('PNCP_SUFFICIENT'));
  assert.ok(plan.decisions.includes('CG_METADATA_ONLY'));
  assert.ok(plan.decisions.includes('LINK_COMPRASNET_ONLY'));
  assert.equal(plan.enrichmentPartial, true);
  assert.equal(plan.fetchCgItems, false);
});

test('policy — PGC planejamento', () => {
  const plan = planEnrichment({ mode: 'pgc', pncpItemCount: 0, items: [] });
  assert.deepEqual(plan.decisions, ['CG_PGC_PLANEJAMENTO']);
});

test('job — enrich SESC fixture adapter', { skip: !hasDb }, async () => {
  const sescCg = loadJson<{ resultado: ComprasGovContratacao14133Dto[] }>(
    'sesc-ce-026-contratacao.json',
  ).resultado[0];

  const adapter: EnrichClientAdapter = {
    fetchContratacaoByPncp: async () => sescCg,
    fetchCatmat: async () => null,
    fetchPgcPage: async () => ({ dfds: [], totalPaginas: 1 }),
  };

  const result = await runEnrichComprasGovJob(
    { kind: 'contratacao', numeroControlePncp: '03612122000127-1-000026/2026' },
    adapter,
  );

  assert.equal(result.ok, true);
  assert.equal(result.idCompra, '45102305000062026');
  assert.ok(result.plan?.decisions.includes('CG_METADATA_ONLY'));
  assert.equal(result.plan?.fetchCgItems, false);
});

test.after(async () => {
  await closeComprasGovPersistPool();
});
