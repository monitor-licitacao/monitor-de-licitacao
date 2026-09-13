import { hashPayload, getComprasGovSql, recordSourceHealth } from '../../sourceLayer.js';
import { createDomainFetchAdapter, type PncpDomainFetchAdapter } from './client.js';
import { normalizeAmparo, normalizeInstrumento, normalizeModalidade } from './normalize.js';
import { upsertAmparo, upsertInstrumento, upsertModalidade } from './persist.js';
import { PNCP_DOMAIN_SOURCE, type DomainSyncSlice, type SyncPncpDomainsResult } from './types.js';
import { PncpDomainSchemaError, validateAmparoList, validateInstrumentoList, validateModalidadeList } from './validate.js';

export const JOB_TYPE_SYNC_PNCP_DOMAINS = 'SYNC_PNCP_DOMAINS';

export type { PncpDomainFetchAdapter };

function logSync(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ msg: 'pncp_domain_sync', ...entry }));
}

async function syncModalidades(adapter: PncpDomainFetchAdapter): Promise<DomainSyncSlice> {
  const fetched = await adapter.fetchModalidades();
  const dtos = validateModalidadeList(fetched.payload);
  let changedRecords = 0;
  let inactiveCount = 0;
  for (const dto of dtos) {
    const row = normalizeModalidade(dto);
    if (!row.statusAtivo) inactiveCount += 1;
    const result = await upsertModalidade(row);
    if (result.changed) changedRecords += 1;
  }
  const slice: DomainSyncSlice = {
    ok: true,
    recordCount: dtos.length,
    changedRecords,
    inactiveCount,
    statusCode: fetched.statusCode,
    durationMs: fetched.durationMs,
    payloadHash: hashPayload(fetched.payload),
  };
  logSync({
    domain: 'modalidade',
    endpoint: fetched.endpoint,
    status_code: fetched.statusCode,
    record_count: dtos.length,
    payload_hash: slice.payloadHash,
    duration_ms: fetched.durationMs,
    changed_records: changedRecords,
  });
  return slice;
}

async function syncInstrumentos(adapter: PncpDomainFetchAdapter): Promise<DomainSyncSlice> {
  const fetched = await adapter.fetchInstrumentos();
  const dtos = validateInstrumentoList(fetched.payload);
  let changedRecords = 0;
  let inactiveCount = 0;
  for (const dto of dtos) {
    const row = normalizeInstrumento(dto);
    if (!row.statusAtivo) inactiveCount += 1;
    const result = await upsertInstrumento(row);
    if (result.changed) changedRecords += 1;
  }
  const slice: DomainSyncSlice = {
    ok: true,
    recordCount: dtos.length,
    changedRecords,
    inactiveCount,
    statusCode: fetched.statusCode,
    durationMs: fetched.durationMs,
    payloadHash: hashPayload(fetched.payload),
  };
  logSync({
    domain: 'instrumento',
    endpoint: fetched.endpoint,
    status_code: fetched.statusCode,
    record_count: dtos.length,
    payload_hash: slice.payloadHash,
    duration_ms: fetched.durationMs,
    changed_records: changedRecords,
  });
  return slice;
}

async function syncAmparos(adapter: PncpDomainFetchAdapter): Promise<DomainSyncSlice> {
  const fetched = await adapter.fetchAmparos();
  const dtos = validateAmparoList(fetched.payload);
  let changedRecords = 0;
  let inactiveCount = 0;
  for (const dto of dtos) {
    const row = normalizeAmparo(dto);
    if (!row.statusAtivo) inactiveCount += 1;
    const result = await upsertAmparo(row);
    if (result.changed) changedRecords += 1;
  }
  const slice: DomainSyncSlice = {
    ok: true,
    recordCount: dtos.length,
    changedRecords,
    inactiveCount,
    statusCode: fetched.statusCode,
    durationMs: fetched.durationMs,
    payloadHash: hashPayload(fetched.payload),
  };
  logSync({
    domain: 'amparo',
    endpoint: fetched.endpoint,
    status_code: fetched.statusCode,
    record_count: dtos.length,
    payload_hash: slice.payloadHash,
    duration_ms: fetched.durationMs,
    changed_records: changedRecords,
  });
  return slice;
}

async function isolate(
  domain: keyof SyncPncpDomainsResult['domains'],
  run: () => Promise<DomainSyncSlice>,
): Promise<DomainSyncSlice> {
  try {
    const slice = await run();
    await recordSourceHealth(PNCP_DOMAIN_SOURCE, true, undefined, `domains/${domain}`).catch(() => {});
    return slice;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const prefix = err instanceof PncpDomainSchemaError ? `schema drift: ${message}` : message;
    logSync({ domain, error: prefix });
    await recordSourceHealth(PNCP_DOMAIN_SOURCE, false, prefix, `domains/${domain}`).catch(() => {});
    return { ok: false, error: prefix };
  }
}

export async function runSyncPncpDomains(
  adapter: PncpDomainFetchAdapter = createDomainFetchAdapter(),
): Promise<SyncPncpDomainsResult> {
  const modalidade = await isolate('modalidade', () => syncModalidades(adapter));
  const instrumento = await isolate('instrumento', () => syncInstrumentos(adapter));
  const amparo = await isolate('amparo', () => syncAmparos(adapter));

  return {
    ok: modalidade.ok && instrumento.ok && amparo.ok,
    domains: { modalidade, instrumento, amparo },
  };
}

export async function enqueueSyncPncpDomainsJob(priority = 0): Promise<string> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO job_queue (job_type, payload, status, priority)
    VALUES (${JOB_TYPE_SYNC_PNCP_DOMAINS}, ${sql.json({})}, 'pending', ${priority})
    RETURNING id
  `;
  return rows[0].id;
}

export async function processNextDomainSyncJob(
  adapter: PncpDomainFetchAdapter = createDomainFetchAdapter(),
  workerId = 'pncp-domains',
): Promise<SyncPncpDomainsResult | null> {
  const sql = getComprasGovSql();
  const locked = await sql<{ id: string }[]>`
    UPDATE job_queue
    SET status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE job_type = ${JOB_TYPE_SYNC_PNCP_DOMAINS} AND status = 'pending'
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;
  const job = locked[0];
  if (!job) return null;

  const result = await runSyncPncpDomains(adapter);
  if (result.ok) {
    await sql`
      UPDATE job_queue
      SET status = 'completed', completed_at = now(), last_error = NULL
      WHERE id = ${job.id}
    `;
  } else {
    const error = [
      result.domains.modalidade.error,
      result.domains.instrumento.error,
      result.domains.amparo.error,
    ]
      .filter(Boolean)
      .join('; ');
    await sql`
      UPDATE job_queue
      SET status = 'failed', last_error = ${error || 'sync failed'}
      WHERE id = ${job.id}
    `;
  }
  return result;
}
