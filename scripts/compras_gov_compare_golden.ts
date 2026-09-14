/**
 * Compara golden record SESC CE 026/2026 entre PNCP (fixture) e Compras.gov Dados Abertos.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ComprasGovOpenDataClient } from '../server/lib/compras-gov/client.js';
import { compareContratacaoPncpVsComprasGov } from '../server/lib/compras-gov/compare-pncp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNCP_FIX = join(__dirname, '../server/lib/pncp/fixtures/sesc-ce-026-2026/compra.json');
const TARGET = '03612122000127-1-000026/2026';

async function main() {
  let pncpCompra: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(readFileSync(PNCP_FIX, 'utf8')) as { body?: Record<string, unknown> };
    pncpCompra = raw.body ?? raw;
  } catch {
    console.warn('Fixture PNCP não encontrada — comparando só Compras.gov');
  }

  const client = new ComprasGovOpenDataClient();
  const cgRes = await client.fetchContratacao14133('numeroControlePNCPCompra', TARGET);
  const cg = cgRes.data.resultado[0] ?? null;

  let cgItems = 0;
  if (cg?.idCompra) {
    const itens = await client.fetchItensContratacao14133('idCompra', cg.idCompra, 1, 20);
    cgItems = itens.data.totalRegistros;
  }

  const pncpItensPath = join(__dirname, '../server/lib/pncp/fixtures/sesc-ce-026-2026/itens.json');
  let pncpItems = 0;
  try {
    const itensRaw = JSON.parse(readFileSync(pncpItensPath, 'utf8')) as { body?: unknown[] } | unknown[];
    const arr = Array.isArray(itensRaw) ? itensRaw : (itensRaw.body ?? []);
    pncpItems = arr.length;
  } catch {
    /* optional */
  }

  const report = compareContratacaoPncpVsComprasGov(
    pncpCompra as Parameters<typeof compareContratacaoPncpVsComprasGov>[0],
    cg,
    {
      pncp: pncpItems,
      comprasGov: cgItems,
      note: cgItems === 0 ? 'Itens vazios no Dados Abertos — compra anulada ou lag de publicação' : undefined,
    },
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
