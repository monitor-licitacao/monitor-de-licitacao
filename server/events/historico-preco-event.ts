import { z } from 'zod';

/**
 * Documento gerado por assistência de IA. Revisão humana obrigatória.
 * Event schema para telemetria de coleta e importação do histórico de preços (PRD Seção 6.2 / Issue #60)
 */

export const HistoricoPrecoImportadoSchema = z.object({
  timestamp: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: 'timestamp must be a valid ISO 8601 string',
  }),
  source_system: z.literal('compras_rj'),
  collection_batch_id: z.string().uuid({
    message: 'collection_batch_id must be a valid UUID',
  }),
  item_count: z.number().int().nonnegative({
    message: 'item_count must be a non-negative integer',
  }),
  operation_type: z.enum(['import', 'update', 'verify']),
  processing_time_ms: z.number().int().nonnegative({
    message: 'processing_time_ms must be a non-negative integer',
  }),
  status: z.enum(['success', 'failure', 'partial']),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  idempotency_key: z.string().min(1, {
    message: 'idempotency_key is required',
  }),
  retry_attempt: z.number().int().nonnegative().optional(),
  data_quality_score: z.number().int().min(0).max(100).optional(),
  affected_items: z.number().int().nonnegative().optional(),
});

export type HistoricoPrecoImportado = z.infer<typeof HistoricoPrecoImportadoSchema>;

/**
 * Padroniza o gerador de chave de idempotência conforme especificado:
 * {source}_{batch_id}_{timestamp_ms}
 */
export function buildIdempotencyKey(
  sourceSystem: string,
  batchId: string,
  timestampMs: number = Date.now()
): string {
  return `${sourceSystem}_${batchId}_${timestampMs}`;
}

/**
 * Validador do formato canônico de idempotency_key
 */
export function isValidIdempotencyKey(key: string): boolean {
  const parts = key.split('_');
  if (parts.length < 3) return false;
  const timestampPart = parts[parts.length - 1];
  return /^\d+$/.test(timestampPart);
}
