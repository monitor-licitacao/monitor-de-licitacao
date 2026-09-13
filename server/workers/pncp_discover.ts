/**
 * Worker DISCOVER_QUERY — Search → ingest PNCP → enrich (Fase D / #79).
 *
 * Uso:
 *   npm run worker:pncp-discover -- --query "musculação" --uf CE --from 20260801 --to 20260915
 *   npm run worker:pncp-discover -- --poll
 */
import 'dotenv/config';
import { ComprasGovOpenDataClient } from '../lib/compras-gov/client.js';
import { createClientAdapter, processNextEnrichJob } from '../lib/compras-gov/jobs.js';
import { closeComprasGovPersistPool } from '../lib/compras-gov/persist.js';
import {
  createSearchAdapter,
  processNextDiscoverJob,
  runDiscoverQuery,
  type DiscoverQueryPayload,
} from '../lib/pncp/discover-jobs.js';
import { createHttpIngestAdapter } from '../lib/pncp/ingest.js';

function parseArgs(argv: string[]): DiscoverQueryPayload | 'poll' | null {
  if (argv.includes('--poll')) return 'poll';

  const queryIdx = argv.indexOf('--query');
  if (queryIdx === -1 || !argv[queryIdx + 1]) return null;

  const fromIdx = argv.indexOf('--from');
  const toIdx = argv.indexOf('--to');
  const ufIdx = argv.indexOf('--uf');
  const cnpjIdx = argv.indexOf('--cnpj');
  const modalIdx = argv.indexOf('--modalidade');

  const dataInicial = fromIdx !== -1 && argv[fromIdx + 1] ? argv[fromIdx + 1] : '20260801';
  const dataFinal = toIdx !== -1 && argv[toIdx + 1] ? argv[toIdx + 1] : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return {
    query: argv[queryIdx + 1],
    uf: ufIdx !== -1 ? argv[ufIdx + 1] : undefined,
    cnpj: cnpjIdx !== -1 ? argv[cnpjIdx + 1] : undefined,
    dataInicial,
    dataFinal,
    modalidade: modalIdx !== -1 ? Number.parseInt(argv[modalIdx + 1], 10) : 6,
    maxHits: 5,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error('Uso: --query "texto" [--uf CE] [--cnpj ...] [--from AAAAMMDD] [--to AAAAMMDD] [--modalidade 6] | --poll');
    process.exit(1);
  }

  const searchAdapter = createSearchAdapter();
  const ingestAdapter = createHttpIngestAdapter();
  const enrichAdapter = createClientAdapter(new ComprasGovOpenDataClient());

  if (parsed === 'poll') {
    console.log('Polling DISCOVER_QUERY + ENRICH_COMPRAS_GOV...');
    for (;;) {
      const discover = await processNextDiscoverJob(searchAdapter, ingestAdapter);
      if (discover) {
        console.log('DISCOVER:', JSON.stringify(discover, null, 2));
      }
      const enrich = await processNextEnrichJob(enrichAdapter);
      if (enrich) {
        console.log('ENRICH:', JSON.stringify(enrich, null, 2));
      }
      if (!discover && !enrich) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  const result = await runDiscoverQuery(parsed, searchAdapter, ingestAdapter);
  console.log(JSON.stringify(result, null, 2));
  await closeComprasGovPersistPool();
  process.exit(result.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await closeComprasGovPersistPool();
  process.exit(1);
});
