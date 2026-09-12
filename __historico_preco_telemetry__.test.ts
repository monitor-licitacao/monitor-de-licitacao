import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdempotencyKey,
  HistoricoPrecoImportadoSchema,
  isValidIdempotencyKeyFormat,
  parseHistoricoPrecoImportado,
} from './server/events/historico-preco-event.js';
import { MockAmplitudeHttpPublisher } from './server/lib/amplitude-http.js';
import { InMemoryIdempotencyStore } from './server/lib/idempotency-store.js';
import {
  CircuitBreaker,
  sendHistoricoPrecoImportadoEvent,
} from './server/lib/historico-preco-telemetry.js';

const SAMPLE_BATCH_ID = '550e8400-e29b-41d4-a716-446655440000';

function buildSampleEvent(overrides: Record<string, unknown> = {}) {
  const timestampMs = 1_725_000_000_000;
  return {
    timestamp: new Date(timestampMs).toISOString(),
    source_system: 'compras_rj',
    collection_batch_id: SAMPLE_BATCH_ID,
    item_count: 42,
    operation_type: 'import',
    processing_time_ms: 1200,
    status: 'success',
    idempotency_key: buildIdempotencyKey('compras_rj', SAMPLE_BATCH_ID, timestampMs),
    data_quality_score: 95,
    affected_items: 40,
    ...overrides,
  };
}

test('historico_preco schema rejects invalid payloads', () => {
  const invalid = buildSampleEvent({ data_quality_score: 101 });
  assert.throws(() => parseHistoricoPrecoImportado(invalid), /Too big|<=100/);

  const badKey = buildSampleEvent({ idempotency_key: 'invalid-key' });
  assert.throws(() => parseHistoricoPrecoImportado(badKey), /idempotency_key must match/);
});

test('historico_preco idempotency key format is enforced', () => {
  const key = buildIdempotencyKey('compras_rj', SAMPLE_BATCH_ID, 1234567890);
  assert.equal(key, `compras_rj_${SAMPLE_BATCH_ID}_1234567890`);
  assert.equal(isValidIdempotencyKeyFormat(key), true);
  assert.equal(HistoricoPrecoImportadoSchema.safeParse(buildSampleEvent()).success, true);
});

test('sendHistoricoPrecoImportadoEvent publishes once and deduplicates replays', async () => {
  const store = new InMemoryIdempotencyStore();
  const publisher = new MockAmplitudeHttpPublisher();
  const event = buildSampleEvent();

  const first = await sendHistoricoPrecoImportadoEvent(event, { store, publisher, userId: 'worker-1' });
  assert.equal(first.sent, true);
  assert.equal(first.duplicate, false);
  assert.equal(publisher.events.length, 1);
  assert.equal(publisher.events[0].eventType, 'historico_preco_importado');
  assert.equal(publisher.events[0].insertId, event.idempotency_key);

  const second = await sendHistoricoPrecoImportadoEvent(event, { store, publisher, userId: 'worker-1' });
  assert.equal(second.sent, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.skippedReason, 'duplicate');
  assert.equal(publisher.events.length, 1, 'replay must not publish duplicate event');
});

test('sendHistoricoPrecoImportadoEvent retries transient failures with backoff', async () => {
  const store = new InMemoryIdempotencyStore();
  const publisher = new MockAmplitudeHttpPublisher();
  let attempts = 0;

  publisher.publish = async (...args) => {
    attempts += 1;
    if (attempts < 2) {
      throw new Error('temporary network error');
    }
    return MockAmplitudeHttpPublisher.prototype.publish.apply(publisher, args);
  };

  const result = await sendHistoricoPrecoImportadoEvent(buildSampleEvent(), {
    store,
    publisher,
    maxRetries: 3,
  });

  assert.equal(result.sent, true);
  assert.equal(attempts, 2);
  assert.equal(publisher.events.length, 1);
});

test('sendHistoricoPrecoImportadoEvent respects circuit breaker', async () => {
  const store = new InMemoryIdempotencyStore();
  const publisher = new MockAmplitudeHttpPublisher();
  const breaker = new CircuitBreaker(1, 60_000);

  publisher.publish = async () => {
    throw new Error('upstream down');
  };

  const first = await sendHistoricoPrecoImportadoEvent(buildSampleEvent(), {
    store,
    publisher,
    maxRetries: 0,
    circuitBreaker: breaker,
  });
  assert.equal(first.sent, false);

  const second = await sendHistoricoPrecoImportadoEvent(buildSampleEvent({ collection_batch_id: '660e8400-e29b-41d4-a716-446655440001', idempotency_key: buildIdempotencyKey('compras_rj', '660e8400-e29b-41d4-a716-446655440001', 999) }), {
    store,
    publisher,
    maxRetries: 0,
    circuitBreaker: breaker,
  });
  assert.equal(second.sent, false);
  assert.equal(second.skippedReason, 'circuit_open');
});
