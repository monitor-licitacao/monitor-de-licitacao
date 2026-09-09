/**
 * Contrato de chave de storage do Cofre de Editais.
 *
 * `editais.s3_storage_key` continua sendo o ponteiro abstrato (legado s3:// ou gs://).
 * Parsear a URI NÃO implica que o PDF exista no cofre — isso só vale com
 * `edital_documents.status = 'stored'`.
 */

export type StorageProvider = 'gcs' | 's3_legacy';

export type ParsedStorageKey = {
  provider: StorageProvider;
  bucket: string;
  objectKey: string;
  canonicalUri: string;
};

const STORAGE_URI = /^(s3|gs|gcs):\/\/([^/]+)\/(.+)$/i;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;
const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]*\.pdf$/i;

export function parseStorageKey(raw: string | null | undefined): ParsedStorageKey | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(STORAGE_URI);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  const bucket = match[2];
  const objectKey = match[3];

  if (!isSafeBucket(bucket) || !isSafeObjectKey(objectKey)) {
    return null;
  }

  const provider: StorageProvider = scheme === 's3' ? 's3_legacy' : 'gcs';
  return {
    provider,
    bucket,
    objectKey,
    canonicalUri: toCanonicalStorageUri(provider, bucket, objectKey),
  };
}

export function isLegacyS3Pointer(parsed: ParsedStorageKey): boolean {
  return parsed.provider === 's3_legacy';
}

export function isGcsPointer(parsed: ParsedStorageKey): boolean {
  return parsed.provider === 'gcs';
}

/** Ponteiro sozinho nunca prova objeto no cofre (Regra 2: sem falso sucesso). */
export function impliesVaultStored(_parsed: ParsedStorageKey): boolean {
  return false;
}

export function toCanonicalStorageUri(
  provider: StorageProvider,
  bucket: string,
  objectKey: string,
): string {
  const scheme = provider === 's3_legacy' ? 's3' : 'gs';
  return `${scheme}://${bucket}/${objectKey}`;
}

export function buildGcsObjectKey(params: {
  tenantId: number;
  year: number;
  processNumber: string;
  filename: string;
}): string {
  const { tenantId, year, processNumber, filename } = params;
  if (!Number.isInteger(tenantId) || tenantId < 1) {
    throw new Error('tenantId must be a positive integer');
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('year is out of the supported range');
  }

  const processSlug = sanitizeProcessNumber(processNumber);
  const safeName = sanitizePdfFilename(filename);
  return `${tenantId}/${year}/${processSlug}/${safeName}`;
}

export function sanitizeProcessNumber(processNumber: string): string {
  const slug = processNumber
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug || slug.includes('..') || !SAFE_SEGMENT.test(slug)) {
    throw new Error('processNumber cannot be turned into a safe storage segment');
  }
  return slug;
}

function sanitizePdfFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase().replace(/\s+/g, '-');
  if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
    throw new Error('filename must not contain path separators or traversal');
  }
  if (!normalized.endsWith('.pdf')) {
    throw new Error('filename must be a .pdf');
  }
  if (!SAFE_FILENAME.test(normalized)) {
    throw new Error('filename contains unsafe characters');
  }
  return normalized;
}

function isSafeBucket(bucket: string): boolean {
  return SAFE_SEGMENT.test(bucket) && !bucket.includes('..');
}

function isSafeObjectKey(objectKey: string): boolean {
  if (!objectKey || objectKey.startsWith('/') || objectKey.includes('\\') || objectKey.includes('%00')) {
    return false;
  }
  const segments = objectKey.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || !SAFE_SEGMENT.test(segment))) {
    return false;
  }
  return true;
}
