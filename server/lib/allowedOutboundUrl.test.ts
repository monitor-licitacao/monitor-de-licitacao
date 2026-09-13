import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hostnameMatchesAllowlist,
  OLLAMA_OUTBOUND_URL_POLICY,
  validateAllowedOutboundUrl,
} from './allowedOutboundUrl.js';
import { checkOllamaHealth } from './ai.js';

const policy = OLLAMA_OUTBOUND_URL_POLICY;

test('validateAllowedOutboundUrl accepts explicitly authorized HTTPS hosts', () => {
  for (const url of [
    'https://ollama.com',
    'https://ollama.com/api/tags',
    'https://api.ollama.com/v1',
  ]) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, true, `expected allow: ${url}`);
  }
});

test('validateAllowedOutboundUrl accepts explicitly authorized HTTP localhost hosts', () => {
  for (const url of [
    'http://127.0.0.1:11434',
    'http://127.0.0.1:11434/api/tags',
    'http://localhost:11434',
  ]) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, true, `expected allow: ${url}`);
  }
});

test('validateAllowedOutboundUrl accepts subdomains only with correct dot boundary', () => {
  assert.equal(hostnameMatchesAllowlist('api.ollama.com', 'ollama.com'), true);
  assert.equal(hostnameMatchesAllowlist('ollama.com', 'ollama.com'), true);
  assert.equal(hostnameMatchesAllowlist('ollama.com.evil-example.net', 'ollama.com'), false);
  assert.equal(hostnameMatchesAllowlist('evil-ollama.com', 'ollama.com'), false);
});

test('validateAllowedOutboundUrl blocks allowed domain only in path or query', () => {
  for (const url of [
    'http://evil-example.net/ollama.com',
    'http://evil-example.net/?x=ollama.com',
    'https://evil-example.net/path/ollama.com/api',
  ]) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, false, `expected block: ${url}`);
  }
});

test('validateAllowedOutboundUrl blocks malicious hostname prefixes and suffixes', () => {
  for (const url of [
    'http://evil-ollama.com',
    'https://ollama.com.evil-example.net',
    'http://notollama.com',
  ]) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, false, `expected block: ${url}`);
  }
});

test('validateAllowedOutboundUrl blocks embedded credentials and unauthorized protocols', () => {
  for (const url of [
    'http://ollama.com@evil-example.net',
    'https://user:pass@ollama.com',
    'file:///etc/passwd',
    'ftp://ollama.com/resource',
    'javascript:alert(1)',
  ]) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, false, `expected block: ${url}`);
  }
});

test('validateAllowedOutboundUrl blocks invalid URLs without throwing', () => {
  for (const url of ['', 'not-a-url', '://missing-scheme']) {
    const result = validateAllowedOutboundUrl(url, policy);
    assert.equal(result.ok, false, `expected block: ${url}`);
  }
});

test('checkOllamaHealth rejects invalid OLLAMA_BASE_URL without network call', async () => {
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  process.env.OLLAMA_BASE_URL = 'http://evil-example.net/ollama.com/v1';
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  }) as typeof fetch;

  try {
    const result = await checkOllamaHealth();
    assert.equal(result.ok, false);
    assert.equal(fetchCalled, false);
    assert.match(result.error ?? '', /Host not allowed|Invalid URL/);
  } finally {
    if (originalBaseUrl === undefined) {
      delete process.env.OLLAMA_BASE_URL;
    } else {
      process.env.OLLAMA_BASE_URL = originalBaseUrl;
    }
    globalThis.fetch = originalFetch;
  }
});
