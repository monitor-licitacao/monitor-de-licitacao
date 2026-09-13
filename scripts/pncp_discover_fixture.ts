/**
 * DISCOVER_QUERY com fixtures SESC (sem rede).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDiscoverQuery } from '../server/lib/pncp/discover-jobs.js';
import type { IngestClientAdapter } from '../server/lib/pncp/ingest.js';
import { closeComprasGovPersistPool } from '../server/lib/compras-gov/persist.js';
import type { PncpCompraDto, PncpItemDto, PncpSearchHit } from '../server/lib/pncp/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '../server/lib/pncp/fixtures/sesc-ce-026-2026');

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8')) as T;
}

const adapter: IngestClientAdapter = {
  async fetchCompra() {
    return load<{ body: PncpCompraDto }>('compra.json').body;
  },
  async fetchItens() {
    return load<{ body: PncpItemDto[] }>('itens.json').body;
  },
};

async function main() {
  const hit = load<{ body: PncpSearchHit }>('search-hit.json').body;

  const result = await runDiscoverQuery(
    {
      query: 'musculação',
      uf: 'CE',
      cnpj: '03612122000127',
      dataInicial: '2026-08-01',
      dataFinal: '2026-09-15',
      modalidade: 6,
      maxHits: 1,
      skipEnrich: true,
    },
    {
      async fetchSearch() {
        return { hits: [hit], totalRegistros: 1, totalPaginas: 1, pagina: 1 };
      },
    },
    adapter,
  );

  console.log(JSON.stringify(result, null, 2));
  await closeComprasGovPersistPool();
}

main().catch(async (err) => {
  console.error(err);
  await closeComprasGovPersistPool();
  process.exit(1);
});
