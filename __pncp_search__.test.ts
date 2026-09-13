import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeComprasGovPersistPool, getContratacaoEnrichmentContext } from './server/lib/compras-gov/persist.js';
import { runDiscoverQuery } from './server/lib/pncp/discover-jobs.js';
import { ingestContratacaoBundle, type IngestClientAdapter } from './server/lib/pncp/ingest.js';
import {
  parseNumeroControlePncp,
  resolveControleFromSearchHit,
} from './server/lib/pncp/resolve-controle.js';
import { PncpSearchClient } from './server/lib/pncp/search-client.js';
import type { PncpCompraDto, PncpItemDto, PncpSearchHit } from './server/lib/pncp/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, 'server/lib/pncp/fixtures/sesc-ce-026-2026');

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8')) as T;
}

const hasDb = Boolean(process.env.DATABASE_URL);
const SESC_CONTROLE = '03612122000127-1-000026/2026';

function sescFixtureAdapter(): IngestClientAdapter {
  const compra = loadJson<{ body: PncpCompraDto }>('compra.json').body;
  const itens = loadJson<{ body: PncpItemDto[] }>('itens.json').body;
  return {
    async fetchCompra() {
      return compra;
    },
    async fetchItens() {
      return itens;
    },
  };
}

test('resolveControle — SESC search hit', () => {
  const hit = loadJson<{ body: PncpSearchHit }>('search-hit.json').body;
  const resolved = resolveControleFromSearchHit(hit);
  assert.ok(resolved);
  assert.equal(resolved!.numeroControlePncp, SESC_CONTROLE);
  assert.equal(resolved!.cnpj, '03612122000127');
  assert.equal(resolved!.ano, 2026);
  assert.equal(resolved!.sequencial, 26);
});

test('parseNumeroControlePncp — Passex golden', () => {
  const parsed = parseNumeroControlePncp('00394452000103-1-019732/2026');
  assert.ok(parsed);
  assert.equal(parsed!.sequencial, 19732);
  assert.equal(parsed!.ano, 2026);
});

test('search client — fixture page com filtro q', async () => {
  const hit = loadJson<{ body: PncpSearchHit; totalRegistros: number }>('search-hit.json');
  const client = new PncpSearchClient({
    fetchFn: async () =>
      new Response(JSON.stringify({ data: [hit.body], totalRegistros: hit.totalRegistros, totalPaginas: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  const page = await client.fetchSearch({
    q: 'musculação',
    uf: 'CE',
    dataInicial: '2026-08-01',
    dataFinal: '2026-09-15',
    modalidade: 6,
    cnpj: '03612122000127',
    situacao: 'todas',
  });

  assert.equal(page.hits.length, 1);
  assert.equal(page.hits[0].numeroControlePNCP, SESC_CONTROLE);
});

test('ingest — SESC fixture 14 itens', { skip: !hasDb }, async () => {
  const result = await ingestContratacaoBundle(SESC_CONTROLE, sescFixtureAdapter());
  assert.equal(result.ok, true);
  assert.equal(result.numeroControlePncp, SESC_CONTROLE);
  assert.equal(result.itemCount, 14);

  const ctx = await getContratacaoEnrichmentContext(SESC_CONTROLE);
  assert.ok(ctx);
  assert.equal(ctx!.pncpItemCount, 14);
  assert.equal(ctx!.urlOrigem?.includes('45102305000062026'), true);
});

test('discover — search hit → ingest → enrich job', { skip: !hasDb }, async () => {
  const hit = loadJson<{ body: PncpSearchHit }>('search-hit.json').body;

  const result = await runDiscoverQuery(
    {
      query: 'musculação',
      uf: 'CE',
      cnpj: '03612122000127',
      dataInicial: '2026-08-01',
      dataFinal: '2026-09-15',
      modalidade: 6,
      maxHits: 1,
      skipEnrich: true,
    },
    {
      async fetchSearch() {
        return { hits: [hit], totalRegistros: 1, totalPaginas: 1, pagina: 1 };
      },
    },
    sescFixtureAdapter(),
  );

  assert.equal(result.ok, true);
  assert.equal(result.hitsFound, 1);
  assert.deepEqual(result.ingested, [SESC_CONTROLE]);
  assert.equal(result.errors.length, 0);
});

test.after(async () => {
  await closeComprasGovPersistPool();
});
