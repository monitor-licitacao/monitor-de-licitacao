/**
 * Worker — sync PNCP contratos/atas do tenant.
 *
 * Uso:
 *   npm run worker:pncp-contratos
 *   npm run worker:pncp-contratos -- --tenant 1
 */
import 'dotenv/config';
import { syncPncpContractsForTenant } from '../lib/contratos/pncp-sync.js';
import { closeComprasGovPersistPool } from '../lib/sourceLayer.js';

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
  try {
    const result = await syncPncpContractsForTenant({ tenantId });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0 && result.persisted === 0) {
      process.exitCode = 1;
    }
  } finally {
    await closeComprasGovPersistPool();
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    await closeComprasGovPersistPool();
  } catch {
    // ignore teardown error on fatal
  }
  process.exit(1);
});
