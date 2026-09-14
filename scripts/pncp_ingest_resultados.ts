/**
 * Ingest PNCP resultados homologados para uma contratação.
 *
 * Uso:
 *   npm run pncp:ingest-resultados -- --controle 26963645000113-1-000001/2025
 */
import 'dotenv/config';
import {
  createHttpResultadosAdapter,
  ingestContratacaoResultados,
} from '../server/lib/pncp/ingest-resultados.js';
import { closeComprasGovPersistPool } from '../server/lib/compras-gov/persist.js';

function parseControle(argv: string[]): string | null {
  const idx = argv.indexOf('--controle');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1]!;
  return null;
}

async function main() {
  const controle = parseControle(process.argv.slice(2));
  if (!controle) {
    console.error('Uso: npm run pncp:ingest-resultados -- --controle <numeroControlePNCP>');
    process.exit(1);
  }

  const adapter = createHttpResultadosAdapter();
  const result = await ingestContratacaoResultados(controle, adapter);

  if (!result.ok) {
    console.error('Falha:', result.error);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  await closeComprasGovPersistPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
