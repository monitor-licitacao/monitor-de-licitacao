import { z } from 'zod';

/** Documento gerado por assistência de IA. Revisão humana obrigatória. */
export const HISTORICO_PRECO_EVENT_TYPE = 'historico_preco_importado' as const;

export const HistoricoPrecoImportadoSchema = z.object({
  timestamp: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: 'timestamp must be ISO 8601',
  }),
  source_system: z.literal('compras_rj'),
  collection_batch_id: z.string().uuid(),
  item_count: z.number().int().nonnegative(),
  operation_type: z.enum(['import', 'update', 'verify']),
  processing_time_ms: z.number().int().nonnegative(),
  status: z.enum(['success', 'failure', 'partial']),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  idempotency_key: z.string().min(1),
  retry_attempt: z.number().int().nonnegative().optional(),
  data_quality_score: z.number().int().min(0).max(100).optional(),
  affected_items: z.number().int().nonnegative().optional(),
});

export type HistoricoPrecoImportado = z.infer<typeof HistoricoPrecoImportadoSchema>;

const IDEMPOTENCY_KEY_PATTERN = /^compras_rj_[0-9a-f-]{36}_\d+$/i;

export function buildIdempotencyKey(
  sourceSystem: HistoricoPrecoImportado['source_system'],
  collectionBatchId: string,
  timestampMs: number = Date.now()
): string {
  return `${sourceSystem}_${collectionBatchId}_${timestampMs}`;
}

export function isValidIdempotencyKeyFormat(key: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(key);
}

export function parseHistoricoPrecoImportado(raw: unknown): HistoricoPrecoImportado {
  const parsed = HistoricoPrecoImportadoSchema.parse(raw);
  if (!isValidIdempotencyKeyFormat(parsed.idempotency_key)) {
    throw new Error(
      'idempotency_key must match {source_system}_{collection_batch_id}_{timestamp_ms}'
    );
  }
  return parsed;
}
