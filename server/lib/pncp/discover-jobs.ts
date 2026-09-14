/**
 * Job DISCOVER_QUERY — Search → ingest PNCP → ENRICH_COMPRAS_GOV (Fase D / #79).
 */
import type { PncpSearchFilters } from '../pncpClient.js';
import { enqueueEnrichComprasGovJob } from '../compras-gov/jobs.js';
import { getComprasGovSql } from '../compras-gov/persist.js';
import { ingestContratacaoBundle, type IngestClientAdapter } from './ingest.js';
import { resolveControleFromSearchHit } from './resolve-controle.js';
import { PncpSearchClient } from './search-client.js';
import type { DiscoverQueryResult, PncpPublicationPage } from './types.js';

export const JOB_TYPE_DISCOVER_QUERY = 'DISCOVER_QUERY';

export type DiscoverQueryPayload = {
  query: string;
  uf?: string;
  cnpj?: string;
  dataInicial: string;
  dataFinal: string;
  modalidade?: number;
  /** Limite de hits processados por job (default 5) */
  maxHits?: number;
  /** Não enfileirar ENRICH_COMPRAS_GOV após ingest */
  skipEnrich?: boolean;
};

export type DiscoverSearchAdapter = {
  fetchSearch: (filters: PncpSearchFilters) => Promise<PncpPublicationPage>;
};

export function createSearchAdapter(client?: PncpSearchClient): DiscoverSearchAdapter {
  const searchClient = client ?? new PncpSearchClient();
  return {
    fetchSearch: (filters) => searchClient.fetchSearch(filters),
  };
}

export async function runDiscoverQuery(
  payload: DiscoverQueryPayload,
  searchAdapter: DiscoverSearchAdapter,
  ingestAdapter: IngestClientAdapter,
): Promise<DiscoverQueryResult> {
  const maxHits = payload.maxHits ?? 5;
  const result: DiscoverQueryResult = {
    ok: true,
    hitsFound: 0,
    ingested: [],
    enrichJobIds: [],
    skipped: [],
    errors: [],
  };

  const page = await searchAdapter.fetchSearch({
    q: payload.query,
    uf: payload.uf,
    cnpj: payload.cnpj,
    dataInicial: payload.dataInicial,
    dataFinal: payload.dataFinal,
    modalidade: payload.modalidade,
    pagina: 1,
    tamanhoPagina: 50,
    situacao: 'todas',
  });

  result.hitsFound = page.hits.length;

  for (const hit of page.hits.slice(0, maxHits)) {
    const controle = resolveControleFromSearchHit(hit);
    if (!controle) {
      result.errors.push('Hit sem numeroControlePNCP resolvível');
      continue;
    }

    const ingest = await ingestContratacaoBundle(controle.numeroControlePncp, ingestAdapter);
    if (!ingest.ok) {
      result.errors.push(`${controle.numeroControlePncp}: ${ingest.error ?? 'ingest falhou'}`);
      continue;
    }

    result.ingested.push(controle.numeroControlePncp);

    if (!payload.skipEnrich) {
      const jobId = await enqueueEnrichComprasGovJob({
        kind: 'contratacao',
        numeroControlePncp: controle.numeroControlePncp,
      });
      result.enrichJobIds.push(jobId);
    }
  }

  if (result.errors.length > 0 && result.ingested.length === 0) {
    result.ok = false;
  }

  return result;
}

export async function enqueueDiscoverQueryJob(
  payload: DiscoverQueryPayload,
  priority = 0,
): Promise<string> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO job_queue (job_type, payload, status, priority)
    VALUES (
      ${JOB_TYPE_DISCOVER_QUERY},
      ${sql.json(payload as unknown as import('postgres').JSONValue)},
      'pending',
      ${priority}
    )
    RETURNING id
  `;
  return rows[0].id;
}

export async function processNextDiscoverJob(
  searchAdapter: DiscoverSearchAdapter,
  ingestAdapter: IngestClientAdapter,
  workerId = 'pncp-discover',
): Promise<DiscoverQueryResult | null> {
  const sql = getComprasGovSql();

  const locked = await sql<{ id: string; payload: DiscoverQueryPayload }[]>`
    UPDATE job_queue
    SET status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE job_type = ${JOB_TYPE_DISCOVER_QUERY} AND status = 'pending'
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload
  `;

  const job = locked[0];
  if (!job) return null;

  const result = await runDiscoverQuery(job.payload, searchAdapter, ingestAdapter);

  if (result.ok) {
    await sql`
      UPDATE job_queue
      SET status = 'completed', completed_at = now(), last_error = NULL
      WHERE id = ${job.id}
    `;
  } else {
    await sql`
      UPDATE job_queue
      SET status = 'failed', last_error = ${result.errors.join('; ') || 'discover failed'}
      WHERE id = ${job.id}
    `;
  }

  return result;
}
