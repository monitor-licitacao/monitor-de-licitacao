import { createHash } from 'crypto';
import {
  HISTORICO_PRECO_EVENT_TYPE,
  HistoricoPrecoImportado,
  parseHistoricoPrecoImportado,
} from '../events/historico-preco-event.js';
import { AmplitudeHttpPublisher } from './amplitude-http.js';
import { IdempotencyRecord, IdempotencyStore } from './idempotency-store.js';

export interface SendHistoricoPrecoResult {
  sent: boolean;
  duplicate: boolean;
  event: HistoricoPrecoImportado;
  amplitudeEventId?: string;
  skippedReason?: 'duplicate' | 'circuit_open' | 'validation_error';
  error?: string;
}

export interface HistoricoPrecoTelemetryDeps {
  store: IdempotencyStore;
  publisher: AmplitudeHttpPublisher;
  userId?: string;
  maxRetries?: number;
  circuitBreaker?: CircuitBreaker;
}

export class CircuitBreaker {
  private failures = 0;
  private openUntilMs = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetMs = 60_000
  ) {}

  isOpen(): boolean {
    return Date.now() < this.openUntilMs;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntilMs = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openUntilMs = Date.now() + this.resetMs;
    }
  }
}

function hashPayload(event: HistoricoPrecoImportado): string {
  return createHash('sha256').update(JSON.stringify(event)).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendHistoricoPrecoImportadoEvent(
  raw: unknown,
  deps: HistoricoPrecoTelemetryDeps
): Promise<SendHistoricoPrecoResult> {
  let event: HistoricoPrecoImportado;
  try {
    event = parseHistoricoPrecoImportado(raw);
  } catch (err: any) {
    return {
      sent: false,
      duplicate: false,
      event: raw as HistoricoPrecoImportado,
      skippedReason: 'validation_error',
      error: err?.message ?? 'Invalid event payload',
    };
  }

  const breaker = deps.circuitBreaker;
  if (breaker?.isOpen()) {
    return {
      sent: false,
      duplicate: false,
      event,
      skippedReason: 'circuit_open',
      error: 'Amplitude circuit breaker open',
    };
  }

  const existing = await deps.store.get(event.idempotency_key);
  if (existing?.status === 'sent') {
    return {
      sent: false,
      duplicate: true,
      event,
      amplitudeEventId: existing.amplitudeEventId ?? undefined,
      skippedReason: 'duplicate',
    };
  }

  const payloadHash = hashPayload(event);
  const retryAttempt = event.retry_attempt ?? existing?.retryAttempt ?? 0;
  const maxRetries = deps.maxRetries ?? 3;
  const baseRecord: IdempotencyRecord = {
    idempotencyKey: event.idempotency_key,
    collectionBatchId: event.collection_batch_id,
    payloadHash,
    status: 'sending',
    amplitudeEventId: existing?.amplitudeEventId ?? null,
    retryAttempt,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    sentAt: existing?.sentAt ?? null,
  };
  await deps.store.upsert(baseRecord);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const publishResult = await deps.publisher.publish(
        HISTORICO_PRECO_EVENT_TYPE,
        event,
        {
          userId: deps.userId ?? 'system',
          insertId: event.idempotency_key,
          timeMs: Date.parse(event.timestamp),
        }
      );

      breaker?.recordSuccess();
      const sentRecord: IdempotencyRecord = {
        ...baseRecord,
        status: 'sent',
        amplitudeEventId: publishResult.eventId ?? event.idempotency_key,
        retryAttempt: attempt,
        updatedAt: nowIso(),
        sentAt: nowIso(),
      };
      await deps.store.upsert(sentRecord);

      return {
        sent: true,
        duplicate: false,
        event,
        amplitudeEventId: sentRecord.amplitudeEventId ?? undefined,
      };
    } catch (err: any) {
      breaker?.recordFailure();
      const isLastAttempt = attempt >= maxRetries;
      await deps.store.upsert({
        ...baseRecord,
        status: isLastAttempt ? 'failed' : 'sending',
        retryAttempt: attempt + 1,
        updatedAt: nowIso(),
      });

      if (isLastAttempt) {
        return {
          sent: false,
          duplicate: false,
          event,
          error: err?.message ?? 'Failed to publish event',
        };
      }

      const backoffMs = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(backoffMs);
    }
  }

  return {
    sent: false,
    duplicate: false,
    event,
    error: 'Unexpected publish loop exit',
  };
}
