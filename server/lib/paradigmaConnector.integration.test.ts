/**
 * Paradigma Connector Integration Test
 * Mock: bootstrap + pesquisar golden 76, validate contract
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ParadigmaSession } from './paradigmaConnector.js';

describe('Paradigma Connector Integration', () => {
  let session: ParadigmaSession;

  beforeEach(() => {
    session = new ParadigmaSession({
      baseUrl: 'https://compras.sestsenat.org.br',
    });
  });

  test('session initialization', () => {
    assert.ok(session, 'Session created');
    assert.equal(session.baseUrl, 'https://compras.sestsenat.org.br');
  });

  test('mock: pesquisar golden 76 (offline)', async () => {
    // Mock fetch to avoid actual network calls
    const originalFetch = global.fetch;
    const mockGolden76Response = {
      d: [
        {
          nCdProcesso: 76,
          sNrProcesso: '000010901-2/2026',
          nCdEdital: 100,
          nCdOrigem: 2,
          sNmUnidade: 'B 077 - SEST - MARABA/PA',
          sNmModalidade: 'Pregão Eletrônico',
          dtInicioPropostas: '/Date(1723028400000)/',
          dtTerminoPropostas: '/Date(1723115000000)/',
          sNmFase: 'Homologação',
          sSituacao: 'Homologado',
          vValorEstimado: 6605.39,
          sLinkCanonico: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
        },
      ],
    };

    // Mock fetch for bootstrap
    let fetchCallCount = 0;
    (global as any).fetch = async (url: string, opts?: any) => {
      fetchCallCount++;

      if (url.includes('Mural.aspx')) {
        // Bootstrap
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'set-cookie': 'ASP.NET_SessionId=abc123xyz789; Path=/',
          }),
          json: async () => ({}),
          text: async () => '<html></html>',
        } as any;
      }

      if (url.includes('PesquisarProcessos')) {
        // Pesquisar
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockGolden76Response,
        } as any;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
      // Bootstrap
      await session.bootstrap();
      assert.ok(session.sessionId, 'Session ID set');
      assert.equal(session.sessionId, 'abc123xyz789');

      // Pesquisar
      const resultados = await session.pesquisarProcessos({
        dtoPaginacao: { iNrPagina: 1, iQtRegistroPagina: 100 },
        nCdProcesso: 76,
      });

      assert.ok(resultados.length > 0, 'Results returned');

      const golden = resultados.find((p) => p.nCdProcesso === 76);
      assert.ok(golden, 'Golden 76 found');

      // Validate contract
      assert.equal(golden.nCdProcesso, 76);
      assert.equal(golden.sNrProcesso, '000010901-2/2026');
      assert.equal(golden.sNmUnidade, 'B 077 - SEST - MARABA/PA');
      assert.equal(golden.sNmModalidade, 'Pregão Eletrônico');
      assert.equal(golden.sNmFase, 'Homologação');
      assert.equal(golden.sSituacao, 'Homologado');
      assert.ok(Math.abs(golden.vValorEstimado - 6605.39) < 0.01);

      // Validate dates parsed correctly
      assert.equal(golden.dtInicioPropostas, '2024-08-07');
      assert.equal(golden.dtTerminoPropostas, '2024-08-08');

      console.log('[integration] Golden 76 contract validated');
    } finally {
      // Restore fetch
      (global as any).fetch = originalFetch;
    }
  });

  test('handle .NET sentinels gracefully', async () => {
    const originalFetch = global.fetch;
    const mockResponseWithSentinels = {
      d: [
        {
          nCdProcesso: 76,
          sNrProcesso: '000010901-2/2026',
          nCdEdital: -2147483648, // int.MinValue sentinel
          nCdOrigem: 2,
          sNmUnidade: 'B 077',
          sNmModalidade: 'Pregão',
          dtInicioPropostas: null, // null sentinel
          dtTerminoPropostas: '/Date(1723115000000)/',
          sNmFase: 'Homologação',
          sSituacao: 'Homologado',
          vValorEstimado: 6605.39,
          sLinkCanonico: 'https://test.com',
        },
      ],
    };

    (global as any).fetch = async (url: string) => {
      if (url.includes('Mural.aspx')) {
        return {
          ok: true,
          headers: new Headers({ 'set-cookie': 'ASP.NET_SessionId=test' }),
          json: async () => ({}),
        } as any;
      }

      return {
        ok: true,
        headers: new Headers(),
        json: async () => mockResponseWithSentinels,
      } as any;
    };

    try {
      await session.bootstrap();
      const resultados = await session.pesquisarProcessos({
        dtoPaginacao: { iNrPagina: 1, iQtRegistroPagina: 100 },
      });

      const processo = resultados[0];

      // Sentinels should be converted to null
      assert.equal(processo.nCdEdital, null, 'int.MinValue sentinel → null');
      assert.equal(processo.dtInicioPropostas, null, 'null date → null');

      // Real values preserved
      assert.equal(processo.nCdProcesso, 76);
      assert.equal(processo.vValorEstimado, 6605.39);

      console.log('[integration] Sentinel handling OK');
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  afterEach(() => {
    // cleanup
  });
});

// Run: npm test -- server/lib/paradigmaConnector.integration.test.ts
