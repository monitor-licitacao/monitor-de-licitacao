import { HistoricoPrecoImportadoSchema, type HistoricoPrecoImportado } from './historico-preco-event.js';
import {
  getIdempotencyRecord,
  upsertIdempotencyRecord,
  calculatePayloadHash,
  type TelemetryRecord,
} from './idempotency-store.js';

/**
 * Documento gerado por assistência de IA. Revisão humana obrigatória.
 * Módulo de envio de telemetria para Amplitude HTTP API v2 com:
 * 1. Validação de schema em runtime com Zod
 * 2. Idempotência por chave com deduplicação
 * 3. Sanitização contra vazamento de PII / dados de fornecedores (Golden Rule 6)
 * 4. Circuit breaker e retry com backoff exponencial
 */

export interface AmplitudeSendOptions {
  userId?: string;
  tenantId?: number;
  apiKey?: string;
  apiUrl?: string;
  maxRetries?: number;
  backoffInitialMs?: number;
  skipCircuitBreaker?: boolean;
}

export interface SendEventResult {
  ok: boolean;
  skipped?: boolean;
  reason?: 'already_sent' | 'circuit_open';
  amplitudeEventId?: string | null;
  error?: string;
}

// Circuit Breaker state
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(failureThreshold = 5, resetTimeoutMs = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  public canExecute(): boolean {
    if (this.state === 'CLOSED') return true;

    const now = Date.now();
    if (now - this.lastFailureTime > this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      return true;
    }

    return false;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  public reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

export const amplitudeCircuitBreaker = new CircuitBreaker();

/**
 * Redige dados potencialmente sensíveis antes do envio a provedores externos (Golden Rule 6)
 */
export function sanitizeEventProperties(properties: HistoricoPrecoImportado): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...properties };

  if (typeof sanitized.error_message === 'string') {
    let msg: string = sanitized.error_message;
    // Redige CNPJ
    msg = msg.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '[CNPJ_REDACTED]');
    // Redige valores monetários
    msg = msg.replace(/R\$\s?\d{1,3}(\.\d{3})*(,\d{2})?/g, '[VALOR_REDACTED]');
    sanitized.error_message = msg;
  }

  return sanitized;
}

export async function sendHistoricoEvent(
  rawPayload: unknown,
  options: AmplitudeSendOptions = {}
): Promise<SendEventResult> {
  const parseResult = HistoricoPrecoImportadoSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    throw new Error(`Invalid event payload: ${JSON.stringify(parseResult.error.format())}`);
  }

  const event = parseResult.data;
  const payloadHash = calculatePayloadHash(event);

  // 1. Verificação de idempotência prévia
  const existing = await getIdempotencyRecord(event.idempotency_key);
  if (existing?.status === 'sent') {
    return {
      ok: true,
      skipped: true,
      reason: 'already_sent',
      amplitudeEventId: existing.amplitudeEventId,
    };
  }

  // 2. Verificação de Circuit Breaker
  if (!options.skipCircuitBreaker && !amplitudeCircuitBreaker.canExecute()) {
    console.warn(`[Telemetry] Amplitude circuit breaker OPEN, postergando evento ${event.idempotency_key}`);
    return {
      ok: false,
      skipped: true,
      reason: 'circuit_open',
      error: 'Amplitude service temporarily unavailable (circuit breaker open)',
    };
  }

  // 3. Marca status como sending
  await upsertIdempotencyRecord(event.idempotency_key, {
    status: 'sending',
    collectionBatchId: event.collection_batch_id,
    sourceSystem: event.source_system,
    payloadHash,
    tenantId: options.tenantId,
    userId: options.userId,
    eventPayload: event as unknown as Record<string, unknown>,
    retryAttempt: event.retry_attempt ?? 0,
  });

  const apiUrl = options.apiUrl || 'https://api.amplitude.com/2/httpapi';
  const apiKey = options.apiKey || process.env.AMPLITUDE_API_KEY || '[DADO AUSENTE]';
  const maxRetries = options.maxRetries ?? 2;
  const backoffInitialMs = options.backoffInitialMs ?? 300;

  const sanitizedProperties = sanitizeEventProperties(event);

  const body = {
    api_key: apiKey,
    events: [
      {
        user_id: options.userId || event.collection_batch_id,
        event_type: 'historico_preco_importado',
        event_properties: sanitizedProperties,
        time: Math.floor(new Date(event.timestamp).getTime()),
        insert_id: event.idempotency_key,
      },
    ],
  };

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Amplitude HTTP ${response.status}: ${errorText}`);
      }

      const result = (await response.json().catch(() => ({}))) as {
        code?: number;
        events_ingested?: number;
        server_upload_time?: number;
        event_id?: string;
      };

      amplitudeCircuitBreaker.recordSuccess();

      const amplitudeEventId =
        result.event_id || (result.events_ingested ? `amp-${Date.now()}` : null);

      await upsertIdempotencyRecord(event.idempotency_key, {
        status: 'sent',
        amplitudeEventId,
        sentAt: new Date(),
        retryAttempt: attempt,
      });

      return {
        ok: true,
        amplitudeEventId,
      };
    } catch (err: any) {
      lastError = err;
      attempt++;

      if (attempt <= maxRetries) {
        const delay = backoffInitialMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  amplitudeCircuitBreaker.recordFailure();

  await upsertIdempotencyRecord(event.idempotency_key, {
    status: 'failed',
    errorCode: 'AMPLITUDE_DISPATCH_FAILED',
    errorMessage: lastError?.message || 'Unknown dispatch error',
    retryAttempt: attempt,
  });

  return {
    ok: false,
    error: lastError?.message || 'Dispatch failed',
  };
}
