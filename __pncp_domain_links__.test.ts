import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeComprasGovPersistPool, getComprasGovSql } from './server/lib/sourceLayer.js';
import { ingestContratacaoBundle, type IngestClientAdapter } from './server/lib/pncp/ingest.js';
import { extractDomainKeys } from './server/lib/pncp/resolve-domains.js';
import { runSyncPncpDomains, type PncpDomainFetchAdapter } from './server/lib/pncp/domains/jobs.js';
import { PNCP_DOMAIN_ENDPOINTS } from './server/lib/pncp/domains/client.js';
import type { PncpCompraDto, PncpItemDto } from './server/lib/pncp/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESC = join(__dirname, 'server/lib/pncp/fixtures/sesc-ce-026-2026');
const DOMAINS = join(__dirname, 'server/lib/pncp/fixtures/domains');

function loadJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
}

const hasDb = Boolean(process.env.DATABASE_URL);
const SESC_CONTROLE = '03612122000127-1-000026/2026';

after(async () => {
  await closeComprasGovPersistPool();
});

test('extractDomainKeys — SESC CE 026 só IDs explícitos', () => {
  const compra = loadJson<{ body: PncpCompraDto }>(SESC, 'compra.json').body;
  const keys = extractDomainKeys(compra);
  assert.deepEqual(keys, {
    modalidadePncpId: 6,
    instrumentoPncpId: 1,
    amparoPncpId: 1,
  });
});

test('extractDomainKeys — sem amparo não inventa código', () => {
  const keys = extractDomainKeys({
    modalidadeId: 6,
    tipoInstrumentoConvocatorioCodigo: 1,
    amparoLegal: { nome: 'Lei 14.133/2021, Art. 28, I' },
  });
  assert.equal(keys.amparoPncpId, null);
  assert.equal(keys.modalidadePncpId, 6);
});

test('ingest — SESC resolve FKs via pncp_id do registry', { skip: !hasDb }, async () => {
  const modalidades = loadJson<unknown[]>(DOMAINS, 'modalidades.json');
  const instrumentos = loadJson<unknown[]>(DOMAINS, 'instrumentos.json');
  const amparos = loadJson<unknown[]>(DOMAINS, 'amparos-legais.json');
  const adapter: PncpDomainFetchAdapter = {
    async fetchModalidades() {
      return { payload: modalidades, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.modalidade, durationMs: 1 };
    },
    async fetchInstrumentos() {
      return { payload: instrumentos, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.instrumento, durationMs: 1 };
    },
    async fetchAmparos() {
      return { payload: amparos, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.amparo, durationMs: 1 };
    },
  };
  await runSyncPncpDomains(adapter);

  const compra = loadJson<{ body: PncpCompraDto }>(SESC, 'compra.json').body;
  const itens = loadJson<{ body: PncpItemDto[] }>(SESC, 'itens.json').body;
  const ingestAdapter: IngestClientAdapter = {
    async fetchCompra() {
      return compra;
    },
    async fetchItens() {
      return itens;
    },
  };

  const result = await ingestContratacaoBundle(SESC_CONTROLE, ingestAdapter);
  assert.equal(result.ok, true);

  const sql = getComprasGovSql();
  const rows = await sql<{
    instrumento_convocatorio_codigo: number | null;
    amparo_legal_codigo: number | null;
    pncp_modalidade_id: string | null;
    pncp_instrumento_convocatorio_id: string | null;
    pncp_amparo_legal_id: string | null;
  }[]>`
    SELECT instrumento_convocatorio_codigo, amparo_legal_codigo,
           pncp_modalidade_id, pncp_instrumento_convocatorio_id, pncp_amparo_legal_id
    FROM contratacao
    WHERE numero_controle_pncp = ${SESC_CONTROLE}
    LIMIT 1
  `;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].instrumento_convocatorio_codigo, 1);
  assert.equal(rows[0].amparo_legal_codigo, 1);
  assert.ok(rows[0].pncp_modalidade_id, 'FK modalidade deve resolver pncp_id=6');
  assert.ok(rows[0].pncp_instrumento_convocatorio_id, 'FK instrumento deve resolver pncp_id=1');
  assert.ok(rows[0].pncp_amparo_legal_id, 'FK amparo deve resolver pncp_id=1');
});
