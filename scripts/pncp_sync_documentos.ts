/**
 * Backfill PNCP arquivos + histórico para contratação já ingerida.
 *
 * Uso:
 *   npm run pncp:sync-documentos -- --controle 00394452000103-1-019732/2026
 */
import 'dotenv/config';
import { getContratacaoEnrichmentContext, closeComprasGovPersistPool } from '../server/lib/compras-gov/persist.js';
import { parseNumeroControlePncp } from '../server/lib/pncp/resolve-controle.js';
import { syncPncpDocumentos } from '../server/lib/pncp/sync-documentos.js';

function parseControle(argv: string[]): string | null {
  const idx = argv.indexOf('--controle');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1]!;
  return null;
}

async function main() {
  const controle = parseControle(process.argv.slice(2));
  if (!controle) {
    console.error('Uso: npm run pncp:sync-documentos -- --controle <numeroControlePNCP>');
    process.exit(1);
  }

  const parsed = parseNumeroControlePncp(controle);
  if (!parsed) {
    console.error('numeroControlePNCP inválido:', controle);
    process.exit(1);
  }

  const ctx = await getContratacaoEnrichmentContext(parsed.numeroControlePncp);
  if (!ctx) {
    console.error('Contratação não encontrada no DB. Ingest primeiro:', parsed.numeroControlePncp);
    process.exit(1);
  }

  const result = await syncPncpDocumentos({
    contratacaoId: ctx.contratacaoId,
    cnpj: parsed.cnpj,
    ano: parsed.ano,
    sequencial: parsed.sequencial,
    source: 'pncp_sync',
  });

  if (!result.ok) {
    console.error('Falha:', result.error);
    process.exit(1);
  }

  console.log(JSON.stringify({ controle: parsed.numeroControlePncp, ...result }, null, 2));
  await closeComprasGovPersistPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
