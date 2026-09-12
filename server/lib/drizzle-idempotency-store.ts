import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
import { IdempotencyRecord, IdempotencyStore } from './idempotency-store.js';

type AppDb = PostgresJsDatabase<typeof schema>;

function rowToRecord(row: typeof schema.telemetryEventIdempotency.$inferSelect): IdempotencyRecord {
  return {
    tenantId: row.tenantId,
    idempotencyKey: row.idempotencyKey,
    collectionBatchId: row.collectionBatchId,
    payloadHash: row.payloadHash,
    status: row.status as IdempotencyRecord['status'],
    amplitudeEventId: row.amplitudeEventId,
    retryAttempt: row.retryAttempt,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}

export class DrizzleIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: AppDb) {}

  async get(tenantId: number, key: string): Promise<IdempotencyRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.telemetryEventIdempotency)
      .where(
        and(
          eq(schema.telemetryEventIdempotency.tenantId, tenantId),
          eq(schema.telemetryEventIdempotency.idempotencyKey, key)
        )
      )
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async upsert(record: IdempotencyRecord): Promise<void> {
    await this.db
      .insert(schema.telemetryEventIdempotency)
      .values({
        tenantId: record.tenantId,
        idempotencyKey: record.idempotencyKey,
        collectionBatchId: record.collectionBatchId,
        payloadHash: record.payloadHash,
        status: record.status,
        amplitudeEventId: record.amplitudeEventId,
        retryAttempt: record.retryAttempt,
        actorUserId: record.actorUserId,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        sentAt: record.sentAt ? new Date(record.sentAt) : null,
      })
      .onConflictDoUpdate({
        target: [
          schema.telemetryEventIdempotency.tenantId,
          schema.telemetryEventIdempotency.idempotencyKey,
        ],
        set: {
          collectionBatchId: record.collectionBatchId,
          payloadHash: record.payloadHash,
          status: record.status,
          amplitudeEventId: record.amplitudeEventId,
          retryAttempt: record.retryAttempt,
          actorUserId: record.actorUserId,
          updatedAt: new Date(record.updatedAt),
          sentAt: record.sentAt ? new Date(record.sentAt) : null,
        },
      });
  }
}
