import 'dotenv/config';
import { ensureStatusCatalogSeeded, statusCatalogRepository } from '../server/lib/statusCatalog.js';

async function main() {
  await ensureStatusCatalogSeeded();
  const counts = await statusCatalogRepository.getFamilyCounts();
  const total = Object.values(counts).reduce((acc, c) => acc + c.total, 0);
  console.log(`Status catalog seed OK — ${total} entradas`);
  for (const [fam, c] of Object.entries(counts)) {
    console.log(`  ${fam}: ${c.total}/${c.expected}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
