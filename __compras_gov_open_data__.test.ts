import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compareContratacaoPncpVsComprasGov, extractIdCompraFromLink } from './server/lib/compras-gov/compare-pncp.js';
import type {
  ComprasGovContratacao14133Dto,
  ComprasGovPagedResponse,
  ComprasGovPgcDetalheDto,
  ComprasGovCatmatItemDto,
} from './server/lib/compras-gov/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, 'server/lib/compras-gov/fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8')) as T;
}

test('Compras.gov — SESC CE contratação por numeroControlePNCP', () => {
  const res = loadFixture<ComprasGovPagedResponse<ComprasGovContratacao14133Dto>>('sesc-ce-026-contratacao.json');
  assert.equal(res.totalRegistros, 1);
  const c = res.resultado[0];
  assert.equal(c.idCompra, '45102305000062026');
  assert.equal(c.numeroControlePNCP, '03612122000127-1-000026/2026');
  assert.equal(c.srp, true);
  assert.equal(c.numeroCompra, '6');
});

test('Compras.gov — idCompra derivável do link PNCP', () => {
  const link =
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=45102305000062026';
  assert.equal(extractIdCompraFromLink(link), '45102305000062026');
});

test('Compras.gov vs PNCP — campos core alinhados (SESC CE)', () => {
  const cg = loadFixture<ComprasGovPagedResponse<ComprasGovContratacao14133Dto>>('sesc-ce-026-contratacao.json').resultado[0];
  const pncpPath = join(__dirname, 'server/lib/pncp/fixtures/sesc-ce-026-2026/compra.json');
  let pncp: Record<string, unknown> = {
    numeroControlePNCP: '03612122000127-1-000026/2026',
    orgaoEntidade: { cnpj: '03612122000127' },
    numeroCompra: '6',
    srp: true,
    processo: '119308',
  };
  try {
    const raw = JSON.parse(readFileSync(pncpPath, 'utf8')) as { body?: Record<string, unknown> };
    pncp = raw.body ?? raw;
  } catch {
    /* fixture opcional */
  }

  const report = compareContratacaoPncpVsComprasGov(pncp as never, cg, { pncp: 14, comprasGov: 0, note: 'anulada' });
  const matches = report.comparisons.filter((c) => c.status === 'match').map((c) => c.field);
  assert.ok(matches.includes('numeroControlePNCP'));
  assert.ok(matches.includes('cnpjOrgao'));
  assert.ok(matches.includes('numeroCompra'));
  assert.ok(report.comprasGovExtras.includes('idCompra'));
});

test('Compras.gov — PGC Gabinete Civil retorna DFD com CATMAT', () => {
  const res = loadFixture<ComprasGovPagedResponse<ComprasGovPgcDetalheDto>>('gabinete-pgc-2026-sample.json');
  assert.ok(res.totalRegistros >= 1);
  const row = res.resultado[0];
  assert.equal(row.orgao, '12200267000101');
  assert.ok(row.ordemDfd >= 1);
  assert.ok(row.descricaoObjetoDfd);
  assert.ok(row.codigoItemCatalogo || row.codigoPdmMaterial);
});

test('Compras.gov — CATMAT enriquece codigoItem 261521 (SWITCH)', () => {
  const res = loadFixture<ComprasGovPagedResponse<ComprasGovCatmatItemDto>>('catmat-261521-switch.json');
  assert.equal(res.totalRegistros, 1);
  const item = res.resultado[0];
  assert.equal(item.codigoItem, 261521);
  assert.equal(item.codigoPdm, 5522);
  assert.match(item.nomePdm, /SWITCH/i);
  assert.ok(item.codigo_ncm);
});
