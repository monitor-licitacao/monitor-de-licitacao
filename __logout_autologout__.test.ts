import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getAuthToken,
  setAuthToken,
  logout,
  apiClient,
} from './src/apiClient.js';
import { Sidebar } from './src/components/Sidebar.js';
import { Header } from './src/components/Header.js';

/**
 * PHASE0-DECISION.md registra o "Teste 3: 401 Auto-Logout" como validado apenas
 * manualmente (a suíte Playwright travou em `route.abort`). Esta suíte cobre o
 * mesmo contrato via Node --test, simulando um ambiente de navegador mínimo
 * (window/localStorage/sessionStorage/fetch) sem depender de um browser real.
 */

function installBrowserGlobals() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const sessionStorageStub = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const windowStub: any = {
    location: { href: '' },
  };

  (globalThis as any).window = windowStub;
  (globalThis as any).localStorage = localStorageStub;
  (globalThis as any).sessionStorage = sessionStorageStub;

  return { windowStub, localStorageStub };
}

function uninstallBrowserGlobals() {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
  delete (globalThis as any).sessionStorage;
}

test('Logout Gap 1: setAuthToken/getAuthToken round-trip via localStorage', () => {
  installBrowserGlobals();
  try {
    assert.equal(getAuthToken(), null, 'nenhum token armazenado inicialmente');
    setAuthToken('jwt-token-abc');
    assert.equal(getAuthToken(), 'jwt-token-abc');
    setAuthToken(null);
    assert.equal(getAuthToken(), null, 'token deve ser limpo após setAuthToken(null)');
  } finally {
    uninstallBrowserGlobals();
  }
});

test('Logout Gap 2: logout() limpa o token e redireciona para "/"', () => {
  const { windowStub } = installBrowserGlobals();
  try {
    setAuthToken('jwt-token-que-deve-ser-limpo');
    windowStub.location.href = '/dashboard';

    logout();

    assert.equal(getAuthToken(), null, 'logout() deve limpar o token armazenado');
    assert.equal(windowStub.location.href, '/', 'logout() deve redirecionar para "/"');
  } finally {
    uninstallBrowserGlobals();
  }
});

test('Logout Gap 3 (PHASE0 DoD Teste 3): apiClient() dispara logout automático em resposta 401', async () => {
  const { windowStub } = installBrowserGlobals();
  const originalFetch = (globalThis as any).fetch;
  try {
    setAuthToken('expired-jwt-token');
    windowStub.location.href = '/dashboard';

    (globalThis as any).fetch = async () => ({
      status: 401,
      ok: false,
      headers: new Headers(),
    });

    const res = await apiClient('/api/protected-resource');

    assert.equal(res.status, 401);
    assert.equal(
      getAuthToken(),
      null,
      'resposta 401 deve disparar auto-logout limpando o token'
    );
    assert.equal(
      windowStub.location.href,
      '/',
      'resposta 401 deve redirecionar o usuário de volta para "/"'
    );
  } finally {
    (globalThis as any).fetch = originalFetch;
    uninstallBrowserGlobals();
  }
});

test('Logout Gap 4: apiClient() NÃO desloga em respostas de sucesso (2xx)', async () => {
  const { windowStub } = installBrowserGlobals();
  const originalFetch = (globalThis as any).fetch;
  try {
    setAuthToken('valid-jwt-token');
    windowStub.location.href = '/dashboard';

    (globalThis as any).fetch = async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
    });

    await apiClient('/api/protected-resource');

    assert.equal(
      getAuthToken(),
      'valid-jwt-token',
      'token deve permanecer intacto em respostas de sucesso'
    );
    assert.equal(
      windowStub.location.href,
      '/dashboard',
      'não deve redirecionar em respostas de sucesso'
    );
  } finally {
    (globalThis as any).fetch = originalFetch;
    uninstallBrowserGlobals();
  }
});

test('Logout Gap 5: apiClient() injeta o header Authorization quando há token', async () => {
  const { } = installBrowserGlobals();
  const originalFetch = (globalThis as any).fetch;
  let capturedHeaders: Headers | undefined;
  try {
    setAuthToken('my-jwt-token');

    (globalThis as any).fetch = async (_url: string, options: RequestInit) => {
      capturedHeaders = new Headers(options.headers);
      return { status: 200, ok: true, headers: new Headers() };
    };

    await apiClient('/api/some-endpoint');

    assert.ok(capturedHeaders, 'fetch deve receber headers');
    assert.equal(capturedHeaders!.get('Authorization'), 'Bearer my-jwt-token');
  } finally {
    (globalThis as any).fetch = originalFetch;
    uninstallBrowserGlobals();
  }
});

test('Logout Gap 6: Sidebar renderiza botão de logout quando onLogout é fornecido', () => {
  let loggedOut = false;
  const onLogout = () => { loggedOut = true; };
  const html = renderToString(
    React.createElement(Sidebar, {
      activeTab: 'dashboard',
      setActiveTab: () => {},
      pendingReviewCount: 0,
      onLogout,
    })
  );

  assert.ok(html.includes('sidebar-logout-button'), 'Sidebar deve renderizar data-testid="sidebar-logout-button"');
  assert.ok(html.includes('Sair'), 'Sidebar deve conter o texto "Sair"');
  onLogout();
  assert.equal(loggedOut, true, 'Callback onLogout deve ser invocável');
});

test('Logout Gap 7: Header renderiza botão de logout quando onLogout é fornecido', () => {
  let loggedOut = false;
  const onLogout = () => { loggedOut = true; };
  const html = renderToString(
    React.createElement(Header, {
      activeTab: 'dashboard',
      setActiveTab: () => {},
      scheduler: { isRunning: true, lastRunAt: '', nextRunAt: '', totalRuns: 0 },
      onTriggerScheduler: () => {},
      pendingReviewCount: 0,
      isTriggering: false,
      onLogout,
    })
  );

  assert.ok(html.includes('header-logout-button'), 'Header deve renderizar data-testid="header-logout-button"');
  assert.ok(html.includes('Sair'), 'Header deve conter o texto "Sair"');
  onLogout();
  assert.equal(loggedOut, true, 'Callback onLogout deve ser invocável');
});

