import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHttpResult, probeUrl } from './server/lib/sourceHttpAudit.js';

test('classifyHttpResult: 200 direto é OK', () => {
  const result = classifyHttpResult({
    requestedUrl: 'https://exemplo.gov.br/',
    finalUrl: 'https://exemplo.gov.br/',
    statusCode: 200,
    redirectChain: [],
  });
  assert.equal(result, 'OK');
});

test('classifyHttpResult: 301/302 seguido até 200 é REDIRECT', () => {
  const result = classifyHttpResult({
    requestedUrl: 'https://pncp.gov.br/',
    finalUrl: 'https://www.gov.br/pncp/pt-br',
    statusCode: 200,
    redirectChain: [
      { from: 'https://pncp.gov.br/', status: 301, to: 'https://www.gov.br/pncp/pt-br' },
    ],
  });
  assert.equal(result, 'REDIRECT');
});

test('classifyHttpResult: 403 é BLOCKED', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://www.licitacoes-e.com.br/',
      finalUrl: 'https://www.licitacoes-e.com.br/',
      statusCode: 403,
      redirectChain: [],
    }),
    'BLOCKED',
  );
});

test('classifyHttpResult: 404 é HTTP_ERROR', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://exemplo.gov.br/missing',
      finalUrl: 'https://exemplo.gov.br/missing',
      statusCode: 404,
      redirectChain: [],
    }),
    'HTTP_ERROR',
  );
});

test('classifyHttpResult: 405 no HEAD seguido de GET 200 é OK', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://exemplo.gov.br/',
      finalUrl: 'https://exemplo.gov.br/',
      statusCode: 200,
      redirectChain: [],
      httpMethod: 'GET',
      headStatusCode: 405,
    }),
    'OK',
  );
});

test('classifyHttpResult: timeout é TIMEOUT', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://exemplo.gov.br/',
      timedOut: true,
      error: 'AbortError: timeout',
    }),
    'TIMEOUT',
  );
});

test('classifyHttpResult: ENOTFOUND é DNS_ERROR', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://nao-existe-xyz.invalid/',
      error: 'getaddrinfo ENOTFOUND nao-existe-xyz.invalid',
      errorCode: 'ENOTFOUND',
    }),
    'DNS_ERROR',
  );
});

test('classifyHttpResult: falha TLS é TLS_ERROR', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://expired.badssl.com/',
      error: 'unable to verify the first certificate',
      errorCode: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    }),
    'TLS_ERROR',
  );
});

test('probeUrl: HEAD 404 cai para GET 200', async () => {
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'HEAD') {
      return new Response(null, { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const probe = await probeUrl('https://dadosabertos.compras.gov.br/modulo', { fetchImpl });
  assert.equal(probe.http_method, 'GET');
  assert.equal(probe.status_code, 200);
  assert.equal(probe.head_status_code, 404);
  assert.equal(probe.classification, 'OK');
});

test('classifyHttpResult: redirect múltiplo permanece REDIRECT', () => {
  assert.equal(
    classifyHttpResult({
      requestedUrl: 'https://www.portaldecompras.sc.gov.br/',
      finalUrl: 'https://compras.sc.gov.br/',
      statusCode: 200,
      redirectChain: [
        { from: 'https://www.portaldecompras.sc.gov.br/', status: 301, to: 'https://compras.sc.gov.br/' },
        { from: 'https://compras.sc.gov.br/', status: 302, to: 'https://compras.sc.gov.br/' },
      ],
    }),
    'REDIRECT',
  );
});
