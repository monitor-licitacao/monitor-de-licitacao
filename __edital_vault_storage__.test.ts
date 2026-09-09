import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns, getTableName } from 'drizzle-orm';
import {
  parseStorageKey,
  buildGcsObjectKey,
  toCanonicalStorageUri,
  isLegacyS3Pointer,
  isGcsPointer,
  impliesVaultStored,
} from './server/lib/storageKey.js';
import { editalDocuments } from './server/db/schema.js';

test('parseStorageKey: reads fixture-style s3:// URI as legacy pointer', () => {
  const parsed = parseStorageKey('s3://editais-vault/pncp/2026/PE-1234-2026.pdf');
  assert.ok(parsed);
  assert.equal(parsed.provider, 's3_legacy');
  assert.equal(parsed.bucket, 'editais-vault');
  assert.equal(parsed.objectKey, 'pncp/2026/PE-1234-2026.pdf');
  assert.equal(parsed.canonicalUri, 's3://editais-vault/pncp/2026/PE-1234-2026.pdf');
  assert.equal(isLegacyS3Pointer(parsed), true);
  assert.equal(isGcsPointer(parsed), false);
  assert.equal(impliesVaultStored(parsed), false);
});

test('parseStorageKey: accepts gs:// and gcs:// as GCS pointers', () => {
  const gs = parseStorageKey('gs://monitor-editais-vault/1/2026/PE-1234-2026/original.pdf');
  assert.ok(gs);
  assert.equal(gs.provider, 'gcs');
  assert.equal(gs.bucket, 'monitor-editais-vault');
  assert.equal(gs.objectKey, '1/2026/PE-1234-2026/original.pdf');
  assert.equal(gs.canonicalUri, 'gs://monitor-editais-vault/1/2026/PE-1234-2026/original.pdf');
  assert.equal(isGcsPointer(gs), true);
  assert.equal(impliesVaultStored(gs), false);

  const gcs = parseStorageKey('gcs://monitor-editais-vault/1/2026/PE-1234-2026/original.pdf');
  assert.ok(gcs);
  assert.equal(gcs.provider, 'gcs');
  assert.equal(gcs.canonicalUri, 'gs://monitor-editais-vault/1/2026/PE-1234-2026/original.pdf');
});

test('parseStorageKey: empty or non-storage values are absent, not stored', () => {
  assert.equal(parseStorageKey(null), null);
  assert.equal(parseStorageKey(undefined), null);
  assert.equal(parseStorageKey(''), null);
  assert.equal(parseStorageKey('   '), null);
  assert.equal(parseStorageKey('https://pncp.gov.br/app/editais/1234'), null);
});

test('parseStorageKey: rejects path traversal and unsafe segments', () => {
  assert.equal(parseStorageKey('s3://editais-vault/../../etc/passwd'), null);
  assert.equal(parseStorageKey('gs://bucket/1/../2/secret.pdf'), null);
  assert.equal(parseStorageKey('s3://editais-vault/pncp/2026/edital.pdf%00.exe'), null);
});

test('buildGcsObjectKey: namespaces by tenant and sanitizes process number', () => {
  const key = buildGcsObjectKey({
    tenantId: 1,
    year: 2026,
    processNumber: 'PE 1234/2026',
    filename: 'Edital Original.PDF',
  });
  assert.equal(key, '1/2026/PE-1234-2026/edital-original.pdf');
});

test('buildGcsObjectKey: blocks traversal, non-pdf names and invalid tenant', () => {
  assert.throws(
    () => buildGcsObjectKey({ tenantId: 1, year: 2026, processNumber: 'PE-1', filename: '../x.pdf' }),
    /filename/
  );
  assert.throws(
    () => buildGcsObjectKey({ tenantId: 1, year: 2026, processNumber: 'PE-1', filename: 'notes.txt' }),
    /pdf/i
  );
  assert.throws(
    () => buildGcsObjectKey({ tenantId: 0, year: 2026, processNumber: 'PE-1', filename: 'a.pdf' }),
    /tenant/i
  );
  assert.throws(
    () => buildGcsObjectKey({ tenantId: 1, year: 1999, processNumber: 'PE-1', filename: 'a.pdf' }),
    /year/i
  );
});

test('editalDocuments keeps tenant + hash columns without replacing s3_storage_key', () => {
  assert.equal(getTableName(editalDocuments), 'edital_documents');
  const cols = getTableColumns(editalDocuments);
  assert.ok(cols.tenantId);
  assert.ok(cols.editalId);
  assert.ok(cols.storageProvider);
  assert.ok(cols.storageKey);
  assert.ok(cols.sha256Hash);
  assert.ok(cols.status);
  assert.ok(cols.uploadedBy);
});

test('toCanonicalStorageUri: GCS uses gs:// even when input used gcs://', () => {
  assert.equal(
    toCanonicalStorageUri('gcs', 'monitor-editais-vault', '1/2026/PE-1/original.pdf'),
    'gs://monitor-editais-vault/1/2026/PE-1/original.pdf'
  );
  assert.equal(
    toCanonicalStorageUri('s3_legacy', 'editais-vault', 'pncp/2026/PE-1234-2026.pdf'),
    's3://editais-vault/pncp/2026/PE-1234-2026.pdf'
  );
});
