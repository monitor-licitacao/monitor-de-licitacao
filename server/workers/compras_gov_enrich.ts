/**
 * Worker ENRICH_COMPRAS_GOV — enriquecimento pós-ingest PNCP (Fase C / #79).
 *
 * Uso:
 *   npm run worker:compras-gov -- --controle 03612122000127-1-000026/2026
 *   npm run worker:compras-gov -- --pgc 12200267000101 2026
 *   npm run worker:compras-gov -- --poll
 */
import 'dotenv/config';
import { ComprasGovOpenDataClient } from '../lib/compras-gov/client.js';
import {
  createClientAdapter,
  processNextEnrichJob,
  runEnrichComprasGovJob,
  type EnrichComprasGovPayload,
} from '../lib/compras-gov/jobs.js';
import { closeComprasGovPersistPool } from '../lib/compras-gov/persist.js';

function parseArgs(argv: string[]): EnrichComprasGovPayload | 'poll' | null {
  const poll = argv.includes('--poll');
  if (poll) return 'poll';

  const controleIdx = argv.indexOf('--controle');
  if (controleIdx !== -1 && argv[controleIdx + 1]) {
    return { kind: 'contratacao', numeroControlePncp: argv[controleIdx + 1] };
  }

  const pgcIdx = argv.indexOf('--pgc');
  if (pgcIdx !== -1 && argv[pgcIdx + 1] && argv[pgcIdx + 2]) {
    return {
      kind: 'pgc',
      orgaoCnpj: argv[pgcIdx + 1],
      ano: Number.parseInt(argv[pgcIdx + 2], 10),
    };
  }

  return null;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error('Uso: --controle <numeroControlePNCP> | --pgc <cnpj> <ano> | --poll');
    process.exit(1);
  }

  const client = new ComprasGovOpenDataClient();
  const adapter = createClientAdapter(client);

  try {
    if (parsed === 'poll') {
      const result = await processNextEnrichJob(adapter);
      console.log(result ? JSON.stringify(result, null, 2) : 'Nenhum job pendente.');
      return;
    }

    const result = await runEnrichComprasGovJob(parsed, adapter);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } finally {
    await closeComprasGovPersistPool();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
