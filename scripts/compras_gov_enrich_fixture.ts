/**
 * Roda ENRICH_COMPRAS_GOV com fixtures (sem rede) para goldens SESC + Gabinete PGC.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  runEnrichComprasGovJob,
  type EnrichClientAdapter,
} from '../server/lib/compras-gov/jobs.js';
import type {
  ComprasGovCatmatItemDto,
  ComprasGovContratacao14133Dto,
  ComprasGovPgcDetalheDto,
} from '../server/lib/compras-gov/types.js';
import { closeComprasGovPersistPool } from '../server/lib/compras-gov/persist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '../server/lib/compras-gov/fixtures');

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(join(FIX, rel), 'utf8')) as T;
}

function fixtureAdapter(): EnrichClientAdapter {
  return {
    async fetchContratacaoByPncp(numeroControlePncp) {
      if (numeroControlePncp.includes('000026')) {
        return load<{ resultado: ComprasGovContratacao14133Dto[] }>('sesc-ce-026-contratacao.json')
          .resultado[0];
      }
      if (numeroControlePncp.includes('019732')) {
        return load<{ body: { resultado: ComprasGovContratacao14133Dto[] } }>(
          'passex-19732/dados-abertos-contratacao.json',
        ).body.resultado[0];
      }
      return null;
    },
    async fetchCatmat(codigoItem) {
      if (codigoItem === 261521) {
        return load<{ resultado: ComprasGovCatmatItemDto[] }>('catmat-261521-switch.json').resultado[0];
      }
      return null;
    },
    async fetchPgcPage(orgaoCnpj, ano, pagina) {
      const all = load<{ resultado: ComprasGovPgcDetalheDto[] }>('gabinete-pgc-2026-sample.json').resultado;
      const pageSize = 50;
      const start = (pagina - 1) * pageSize;
      const dfds = all.slice(start, start + pageSize);
      return { dfds, totalPaginas: Math.ceil(all.length / pageSize) || 1 };
    },
  };
}

async function main() {
  const adapter = fixtureAdapter();
  const target = process.argv[2] ?? 'sesc';

  if (target === 'sesc' || target === 'all') {
    const r = await runEnrichComprasGovJob(
      { kind: 'contratacao', numeroControlePncp: '03612122000127-1-000026/2026' },
      adapter,
    );
    console.log('SESC:', JSON.stringify(r, null, 2));
  }

  if (target === 'pgc' || target === 'all') {
    const r = await runEnrichComprasGovJob(
      { kind: 'pgc', orgaoCnpj: '12200267000101', ano: 2026, maxPages: 1 },
      adapter,
    );
    console.log('PGC:', JSON.stringify(r, null, 2));
  }

  await closeComprasGovPersistPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
