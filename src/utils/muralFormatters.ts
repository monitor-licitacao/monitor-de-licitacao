/**
 * Formatters and helpers for Mural and Status Catalog.
 * Enforces honest representations: never invent fallback data.
 */

export function formatDateToBR(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // If already in DD/MM/YYYY or DD/MM/YYYY HH:mm format
  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    // Return just the date part (DD/MM/YYYY)
    return trimmed.slice(0, 10);
  }

  // If ISO format (e.g. 2026-03-01T09:00:00Z) or YYYY-MM-DD
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

export function formatDateTimeToBR(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // If already in DD/MM/YYYY HH:mm format
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  return trimmed;
}

export function formatCurrencyBRL(val?: number | null): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
}
