/**
 * Camada raw compartilhada: source_record + entity_snapshot + source_health.
 * Extraída para o Domain Registry PNCP (#81) reutilizar o padrão sem puxar o módulo Compras.gov.
 */
import crypto from 'crypto';
import postgres from 'postgres';

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getComprasGovSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada');
  }
  if (!sqlClient) {
    sqlClient = postgres(url, { max: 3 });
  }
  return sqlClient;
}

export function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function upsertSourceRecord(input: {
  source: string;
  entityType: string;
  identifier: string;
  sourceUrl?: string | null;
  rawPayload: unknown;
}): Promise<string> {
  const sql = getComprasGovSql();
  const payloadHash = hashPayload(input.rawPayload);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO source_record (
      source, source_entity_type, source_identifier, source_url,
      raw_payload, payload_hash, last_seen_at
    )
    VALUES (
      ${input.source},
      ${input.entityType},
      ${input.identifier},
      ${input.sourceUrl ?? null},
      ${sql.json(input.rawPayload as postgres.JSONValue)},
      ${payloadHash},
      now()
    )
    ON CONFLICT (source, source_entity_type, source_identifier) DO UPDATE SET
      source_url = COALESCE(EXCLUDED.source_url, source_record.source_url),
      raw_payload = EXCLUDED.raw_payload,
      payload_hash = EXCLUDED.payload_hash,
      last_seen_at = now(),
      active = true
    RETURNING id
  `;
  return rows[0].id;
}

export async function recordSourceHealth(
  source: string,
  ok: boolean,
  _errorMessage?: string,
  endpoint = 'dados_abertos',
): Promise<void> {
  const sql = getComprasGovSql();

  if (ok) {
    await sql`
      INSERT INTO source_health (source, endpoint, last_success, status, updated_at)
      VALUES (${source}, ${endpoint}, now(), 'HEALTHY', now())
      ON CONFLICT (source, endpoint) DO UPDATE SET
        last_success = now(),
        status = 'HEALTHY',
        updated_at = now()
    `;
    return;
  }

  await sql`
    INSERT INTO source_health (source, endpoint, last_failure, status, updated_at)
    VALUES (${source}, ${endpoint}, now(), 'DEGRADED', now())
    ON CONFLICT (source, endpoint) DO UPDATE SET
      last_failure = now(),
      status = 'DEGRADED',
      updated_at = now()
  `;
}

export async function upsertEntitySnapshot(input: {
  entityType: string;
  entityId: string;
  source: string;
  payload: unknown;
}): Promise<void> {
  const sql = getComprasGovSql();
  const payloadHash = hashPayload(input.payload);
  await sql`
    INSERT INTO entity_snapshot (entity_type, entity_id, source, payload, payload_hash)
    VALUES (
      ${input.entityType},
      ${input.entityId},
      ${input.source},
      ${sql.json(input.payload as postgres.JSONValue)},
      ${payloadHash}
    )
  `;
}

export async function closeComprasGovPersistPool(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
  }
}
