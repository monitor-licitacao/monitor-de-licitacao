/**
 * Worker SYNC_PNCP_DOMAINS — Domain Registry PNCP (issue #81).
 *
 * Uso:
 *   npm run worker:pncp-domains
 *   npm run worker:pncp-domains -- --poll
 *   WORKER_CRON=true npm run worker:pncp-domains
 */
import 'dotenv/config';
import cron from 'node-cron';
import { closeComprasGovPersistPool } from '../lib/sourceLayer.js';
import { processNextDomainSyncJob, runSyncPncpDomains } from '../lib/pncp/domains/jobs.js';

async function main() {
  const poll = process.argv.includes('--poll');
  const isCron = process.env.WORKER_CRON === 'true';

  const runOnce = async () => {
    const result = poll ? await processNextDomainSyncJob() : await runSyncPncpDomains();
    console.log(result ? JSON.stringify(result, null, 2) : 'Nenhum job pendente.');
    if (result && !result.ok) process.exitCode = 1;
  };

  if (isCron) {
    console.log('SYNC_PNCP_DOMAINS cron diário 06:00 America/Sao_Paulo');
    cron.schedule('0 6 * * *', () => {
      runSyncPncpDomains().catch((err) => console.error(err));
    }, { timezone: 'America/Sao_Paulo' });
    await runOnce();
    return;
  }

  try {
    await runOnce();
  } finally {
    await closeComprasGovPersistPool();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
