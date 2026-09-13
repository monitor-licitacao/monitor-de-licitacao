import { HistoricoPrecoImportado } from '../events/historico-preco-event.js';

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, replacement: '[CNPJ_REDACTED]' },
  { pattern: /R\$\s?\d{1,3}(\.\d{3})*(,\d{2})?/g, replacement: '[VALOR_REDACTED]' },
];

export function redactTelemetryString(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/** Golden Rule 6: strip supplier-identifying detail before third-party analytics. */
export function sanitizeHistoricoPrecoForAmplitude(
  event: HistoricoPrecoImportado
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...event };
  if (typeof sanitized.error_message === 'string') {
    sanitized.error_message = redactTelemetryString(sanitized.error_message).slice(0, 500);
  }
  if (typeof sanitized.error_code === 'string') {
    sanitized.error_code = redactTelemetryString(sanitized.error_code).slice(0, 120);
  }
  return sanitized;
}
