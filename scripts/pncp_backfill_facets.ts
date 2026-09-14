/**
 * Backfill parsed_facets para contratações já ingeridas.
 *
 * Uso:
 *   npm run pncp:backfill-facets -- --controle 03612122000127-1-000026/2026
 *   npm run pncp:backfill-facets -- --all
 */
import 'dotenv/config';
import {
  backfillParsedFacetsByControle,
  backfillParsedFacetsForContratacao,
} from '../server/lib/pncp/backfill-facets.js';
import { getComprasGovSql, closeComprasGovPersistPool } from '../server/lib/compras-gov/persist.js';

async function backfillAll(): Promise<number> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`SELECT id FROM contratacao ORDER BY updated_at DESC`;
  let total = 0;
  for (const row of rows) {
    const { updated } = await backfillParsedFacetsForContratacao(row.id);
    total += updated;
  }
  return total;
}

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const controleIdx = argv.indexOf('--controle');

  if (all) {
    const total = await backfillAll();
    console.log(JSON.stringify({ ok: true, itemsUpdated: total }));
    await closeComprasGovPersistPool();
    return;
  }

  if (controleIdx === -1 || !argv[controleIdx + 1]) {
    console.error('Uso: npm run pncp:backfill-facets -- --controle <PNCP> | --all');
    process.exit(1);
  }

  const result = await backfillParsedFacetsByControle(argv[controleIdx + 1]!);
  if ('error' in result) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...result }));
  await closeComprasGovPersistPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
