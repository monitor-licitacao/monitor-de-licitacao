import { createHash } from 'crypto';
import { db, isDatabaseConfigured } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Documento gerado por assistência de IA. Revisão humana obrigatória.
 * Store de persistência e idempotência para telemetria com suporte a banco relacional (Drizzle / Neon)
 * e fallback em memória caso DATABASE_URL não esteja configurado (ex.: testes locais unitários).
 */

export interface TelemetryRecord {
  idempotencyKey: string;
  tenantId?: number | null;
  eventType: string;
  collectionBatchId: string;
  sourceSystem: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  payloadHash: string;
  eventPayload?: Record<string, unknown>;
  amplitudeEventId?: string | null;
  retryAttempt: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  userId?: string | null;
  sentAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// In-memory fallback para testes sem banco de dados configurado
const memoryStore = new Map<string, TelemetryRecord>();

export function calculatePayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function getIdempotencyRecord(key: string): Promise<TelemetryRecord | null> {
  if (!isDatabaseConfigured) {
    return memoryStore.get(key) || null;
  }

  try {
    const records = await db
      .select()
      .from(schema.telemetryEvents)
      .where(eq(schema.telemetryEvents.idempotencyKey, key))
      .limit(1);

    if (records.length === 0) return null;
    const r = records[0];

    return {
      idempotencyKey: r.idempotencyKey,
      tenantId: r.tenantId,
      eventType: r.eventType,
      collectionBatchId: r.collectionBatchId,
      sourceSystem: r.sourceSystem,
      status: r.status as TelemetryRecord['status'],
      payloadHash: r.payloadHash,
      eventPayload: (r.eventPayload as Record<string, unknown>) || undefined,
      amplitudeEventId: r.amplitudeEventId,
      retryAttempt: r.retryAttempt,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      userId: r.userId,
      sentAt: r.sentAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  } catch (err) {
    console.warn(`[TelemetryStore] Erro ao consultar banco, usando fallback em memória: ${(err as Error).message}`);
    return memoryStore.get(key) || null;
  }
}

export async function upsertIdempotencyRecord(
  key: string,
  record: Partial<TelemetryRecord> & {
    collectionBatchId?: string;
    sourceSystem?: string;
    payloadHash?: string;
    status: TelemetryRecord['status'];
  }
): Promise<TelemetryRecord> {
  const existing = await getIdempotencyRecord(key);
  const now = new Date();

  const merged: TelemetryRecord = {
    idempotencyKey: key,
    tenantId: record.tenantId ?? existing?.tenantId ?? null,
    eventType: record.eventType ?? existing?.eventType ?? 'historico_preco_importado',
    collectionBatchId: record.collectionBatchId ?? existing?.collectionBatchId ?? '',
    sourceSystem: record.sourceSystem ?? existing?.sourceSystem ?? 'compras_rj',
    status: record.status,
    payloadHash: record.payloadHash ?? existing?.payloadHash ?? '',
    eventPayload: record.eventPayload ?? existing?.eventPayload,
    amplitudeEventId: record.amplitudeEventId ?? existing?.amplitudeEventId ?? null,
    retryAttempt: record.retryAttempt ?? existing?.retryAttempt ?? 0,
    errorCode: record.errorCode ?? existing?.errorCode ?? null,
    errorMessage: record.errorMessage ?? existing?.errorMessage ?? null,
    userId: record.userId ?? existing?.userId ?? null,
    sentAt: record.sentAt ?? existing?.sentAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  memoryStore.set(key, merged);

  if (isDatabaseConfigured) {
    try {
      await db
        .insert(schema.telemetryEvents)
        .values({
          idempotencyKey: merged.idempotencyKey,
          tenantId: merged.tenantId,
          eventType: merged.eventType,
          collectionBatchId: merged.collectionBatchId,
          sourceSystem: merged.sourceSystem,
          status: merged.status,
          payloadHash: merged.payloadHash,
          eventPayload: merged.eventPayload,
          amplitudeEventId: merged.amplitudeEventId,
          retryAttempt: merged.retryAttempt,
          errorCode: merged.errorCode,
          errorMessage: merged.errorMessage,
          userId: merged.userId,
          sentAt: merged.sentAt,
          updatedAt: merged.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.telemetryEvents.idempotencyKey,
          set: {
            status: merged.status,
            amplitudeEventId: merged.amplitudeEventId,
            retryAttempt: merged.retryAttempt,
            errorCode: merged.errorCode,
            errorMessage: merged.errorMessage,
            sentAt: merged.sentAt,
            updatedAt: merged.updatedAt,
          },
        });
    } catch (err) {
      console.warn(`[TelemetryStore] Erro ao persistir no banco: ${(err as Error).message}`);
    }
  }

  return merged;
}

export function clearMemoryStoreForTesting(): void {
  memoryStore.clear();
}
