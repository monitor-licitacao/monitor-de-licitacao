import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HistoricoPrecoImportadoSchema,
  buildIdempotencyKey,
  isValidIdempotencyKey,
} from './server/events/historico-preco-event.js';
import {
  sendHistoricoEvent,
  amplitudeCircuitBreaker,
  sanitizeEventProperties,
} from './server/events/send-historico-event.js';
import {
  clearMemoryStoreForTesting,
  getIdempotencyRecord,
} from './server/events/idempotency-store.js';
import { MockAmplitudeHttpApi } from './tests/__amplitude_mock__.js';

const mockApi = new MockAmplitudeHttpApi();

test('Amplitude Compras RJ Telemetry - 1) Event Schema Validation (Zod)', () => {
  const validPayload = {
    timestamp: '2026-09-12T15:30:00.000Z',
    source_system: 'compras_rj',
    collection_batch_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    item_count: 42,
    operation_type: 'import',
    processing_time_ms: 1250,
    status: 'success',
    idempotency_key: 'compras_rj_a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d_1726155000000',
    data_quality_score: 95,
    affected_items: 40,
  };

  const parsed = HistoricoPrecoImportadoSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);

  // Invalid timestamp
  const invalidDate = { ...validPayload, timestamp: 'data-invalida' };
  assert.equal(HistoricoPrecoImportadoSchema.safeParse(invalidDate).success, false);

  // Invalid source system
  const invalidSource = { ...validPayload, source_system: 'pncp_outro' };
  assert.equal(HistoricoPrecoImportadoSchema.safeParse(invalidSource).success, false);

  // Invalid UUID
  const invalidUuid = { ...validPayload, collection_batch_id: 'nao-e-uuid' };
  assert.equal(HistoricoPrecoImportadoSchema.safeParse(invalidUuid).success, false);

  // Score fora do range 0-100
  const invalidScore = { ...validPayload, data_quality_score: 150 };
  assert.equal(HistoricoPrecoImportadoSchema.safeParse(invalidScore).success, false);
});

test('Amplitude Compras RJ Telemetry - 2) Idempotency Key Generator & Validator', () => {
  const batchId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const key = buildIdempotencyKey('compras_rj', batchId, 1726155000000);
  assert.equal(key, `compras_rj_${batchId}_1726155000000`);
  assert.equal(isValidIdempotencyKey(key), true);
  assert.equal(isValidIdempotencyKey('invalido'), false);
  assert.equal(isValidIdempotencyKey('compras_rj_batch_naonumerico'), false);
});

test('Amplitude Compras RJ Telemetry - 3) Sanitization & Redaction (Golden Rule 6)', () => {
  const payloadWithPii = {
    timestamp: '2026-09-12T15:30:00.000Z',
    source_system: 'compras_rj' as const,
    collection_batch_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    item_count: 10,
    operation_type: 'import' as const,
    processing_time_ms: 500,
    status: 'failure' as const,
    error_code: 'PRICE_EXTRACT_ERROR',
    error_message: 'Falha no fornecedor CNPJ 12.345.678/0001-90 valor R$ 450.000,00',
    idempotency_key: 'compras_rj_a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d_1726155000000',
  };

  const sanitized = sanitizeEventProperties(payloadWithPii);
  const errMsg = sanitized.error_message as string;
  assert.equal(errMsg?.includes('12.345.678/0001-90'), false);
  assert.equal(errMsg?.includes('[CNPJ_REDACTED]'), true);
  assert.equal(errMsg?.includes('[VALOR_REDACTED]'), true);
});

test('Amplitude Compras RJ Telemetry - 4) Integration: Send Event & Deduplication', async (t) => {
  mockApi.install();
  mockApi.reset();
  clearMemoryStoreForTesting();
  amplitudeCircuitBreaker.reset();

  t.after(() => {
    mockApi.restore();
  });

  const eventPayload = {
    timestamp: new Date().toISOString(),
    source_system: 'compras_rj',
    collection_batch_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    item_count: 25,
    operation_type: 'import',
    processing_time_ms: 850,
    status: 'success',
    idempotency_key: 'compras_rj_a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d_1726155000000',
    data_quality_score: 98,
  };

  // 1. Primeiro envio
  const res1 = await sendHistoricoEvent(eventPayload, {
    apiKey: 'test-api-key',
    tenantId: 1,
    skipCircuitBreaker: true,
  });

  assert.equal(res1.ok, true);
  assert.equal(mockApi.capturedRequests.length, 1);
  assert.equal(mockApi.capturedRequests[0].body.api_key, 'test-api-key');
  assert.equal(mockApi.capturedRequests[0].body.events?.[0].event_type, 'historico_preco_importado');

  const record = await getIdempotencyRecord(eventPayload.idempotency_key);
  assert.equal(record?.status, 'sent');
  assert.ok(record?.amplitudeEventId);

  // 2. Reenvio duplicado (deve ser skipped pela idempotência)
  const res2 = await sendHistoricoEvent(eventPayload, {
    apiKey: 'test-api-key',
    tenantId: 1,
    skipCircuitBreaker: true,
  });

  assert.equal(res2.ok, true);
  assert.equal(res2.skipped, true);
  assert.equal(res2.reason, 'already_sent');
  assert.equal(mockApi.capturedRequests.length, 1, 'Não deve fazer nova chamada HTTP no reenvio');
});

test('Amplitude Compras RJ Telemetry - 5) Retry & Circuit Breaker', async (t) => {
  mockApi.install();
  mockApi.reset();
  clearMemoryStoreForTesting();
  amplitudeCircuitBreaker.reset();

  t.after(() => {
    mockApi.restore();
    amplitudeCircuitBreaker.reset();
  });

  const failedPayload = {
    timestamp: new Date().toISOString(),
    source_system: 'compras_rj',
    collection_batch_id: 'c1c2c3c4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    item_count: 5,
    operation_type: 'import',
    processing_time_ms: 100,
    status: 'failure',
    idempotency_key: 'compras_rj_c1c2c3c4-e5f6-7a8b-9c0d-1e2f3a4b5c6d_1726155000000',
  };

  // Simula 2 falhas antes de sucesso
  mockApi.failNextCount = 2;
  const res = await sendHistoricoEvent(failedPayload, {
    apiKey: 'test-api-key',
    tenantId: 1,
    maxRetries: 3,
    backoffInitialMs: 10,
    skipCircuitBreaker: true,
  });

  assert.equal(res.ok, true);
  assert.equal(mockApi.capturedRequests.length, 3, 'Deve tentar 3 vezes (2 falhas + 1 sucesso)');
});
