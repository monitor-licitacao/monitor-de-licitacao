import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterKeywordsBeforeAI } from './server/lib/tokenEfficiency.js';
import { resilientFetch, ResilientFetchError } from './server/lib/resilientFetch.js';
import { consumeRateLimit, resetMemoryRateLimitCountersForTests } from './server/lib/rateLimiter.js';

if (!process.env.CERT_ENCRYPTION_KEY || process.env.CERT_ENCRYPTION_KEY === 'CHANGE_ME_IN_PRODUCTION') {
  process.env.CERT_ENCRYPTION_KEY = 'test-cert-encryption-key-min-32-chars-long';
}

test('Regra 7.2: filterKeywordsBeforeAI truncates single-line text without newlines', () => {
  const singleLine = 'A'.repeat(500);
  const result = filterKeywordsBeforeAI(singleLine, [], 120);
  assert.equal(result.length, 120);
  assert.ok(!result.includes('\n'));
});

test('Regra 7.2: filterKeywordsBeforeAI keeps keyword-matching segments', () => {
  const text = 'intro\nNCM 9506.91.00 equipamentos\nfooter irrelevante';
  const result = filterKeywordsBeforeAI(text, ['ncm'], 500);
  assert.match(result.toLowerCase(), /ncm/);
  assert.ok(!result.toLowerCase().includes('footer irrelevante'));
});

test('Regra 3: crypto.ts must not contain monitor-dev-key fallback', () => {
  const source = readFileSync('./server/lib/crypto.ts', 'utf8');
  assert.ok(!source.includes('monitor-dev-key'));
  assert.match(source, /throw new Error\(/);
});

test('ResilientFetch: maps AbortError to TIMEOUT code', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))) as typeof fetch;

  try {
    await assert.rejects(
      () => resilientFetch('https://example.test/timeout', { timeoutMs: 50 }),
      (error: unknown) => {
        assert.ok(error instanceof ResilientFetchError);
        assert.equal(error.code, 'TIMEOUT');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ResilientFetch: maps ENOTFOUND to DNS code', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(Object.assign(new Error('getaddrinfo ENOTFOUND example.test'), { code: 'ENOTFOUND' }))) as typeof fetch;

  try {
    await assert.rejects(
      () => resilientFetch('https://example.test/dns'),
      (error: unknown) => {
        assert.ok(error instanceof ResilientFetchError);
        assert.equal(error.code, 'DNS');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RateLimiter: in-memory fallback enforces limit in development', async () => {
  resetMemoryRateLimitCountersForTests();
  const params = { tenantId: 1, bucket: 'test-ai', limit: 2, windowMs: 60_000, identifier: '127.0.0.1' };

  const first = await consumeRateLimit(params);
  const second = await consumeRateLimit(params);
  const third = await consumeRateLimit(params);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});
