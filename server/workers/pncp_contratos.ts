/**
 * Worker — sync PNCP contratos/atas do tenant.
 *
 * Uso:
 *   npm run worker:pncp-contratos
 *   npm run worker:pncp-contratos -- --tenant 1
 */
import 'dotenv/config';
import { syncPncpContractsForTenant } from '../lib/contratos/pncp-sync.js';

async function main() {
  const tenantIdx = process.argv.indexOf('--tenant');
  const tenantId =
    tenantIdx !== -1 && process.argv[tenantIdx + 1]
      ? Number.parseInt(process.argv[tenantIdx + 1], 10)
      : 1;

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não configurada.');
    process.exit(1);
  }

  console.log(`Sync contratos PNCP — tenant ${tenantId}`);
  const result = await syncPncpContractsForTenant({ tenantId });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length > 0 && result.persisted === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
