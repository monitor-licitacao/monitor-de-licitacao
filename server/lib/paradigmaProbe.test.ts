/**
 * Paradigma Connector HTTP Direct Probe
 * Test: Bootstrap session → PesquisarProcessos → parse golden 76 → validate vs golden data
 * No Playwright. Just HTTP.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

interface ParadigmaSession {
  cookies: string;
  sessionId?: string;
}

interface PesquisarProcessosPayload {
  dtoPaginacao: {
    iNrPagina: number;
    iQtRegistroPagina: number;
  };
  sNrProcesso?: string;
  nCdProcesso?: number;
}

interface ProcessoResponse {
  nCdProcesso: number;
  sNrProcesso: string;
  nCdEdital: number;
  nCdOrigem: number;
  sNmUnidade: string;
  sNmModalidade: string;
  dtInicioPropostas: string; // e.g. "/Date(1723028400000)/"
  dtTerminoPropostas: string;
  sNmFase: string;
  sSituacao: string;
  vValorEstimado: number;
  sLinkCanonico: string;
}

// Sentinel handling: .NET returns -2147483648 for null, /Date(ms)/ for dates
function parseParadigmaDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\/Date\((\d+)\)\//);
  if (!match) return dateStr; // passthrough if already ISO or other format
  const ms = parseInt(match[1], 10);
  return new Date(ms).toISOString().split('T')[0]; // YYYY-MM-DD
}

function parseSentinel(val: any): any {
  if (val === -2147483648) return null;
  if (typeof val === 'number' && Math.abs(val) > 1e28) return null; // magic float sentinel
  return val;
}

async function bootstrapSession(baseUrl: string): Promise<ParadigmaSession> {
  console.log(`[probe] GET ${baseUrl}/Mural.aspx (bootstrap session)...`);

  try {
    const res = await fetch(`${baseUrl}/Mural.aspx`, {
      method: 'GET',
      headers: { 'User-Agent': 'ParadigmaProbe/1.0' },
      redirect: 'follow',
    });

    const cookies = res.headers.get('set-cookie') || '';
    console.log(`[probe] Got cookies: ${cookies.substring(0, 60)}...`);

    return { cookies };
  } catch (err) {
    console.error(`[probe] Bootstrap failed:`, err);
    throw err;
  }
}

async function pesquisarProcessos(
  baseUrl: string,
  session: ParadigmaSession,
  payload: PesquisarProcessosPayload
): Promise<ProcessoResponse[]> {
  console.log(`[probe] POST ${baseUrl}/WebService/Servicos.asmx/PesquisarProcessos...`);
  console.log(`[probe] Payload:`, JSON.stringify(payload));

  try {
    const res = await fetch(`${baseUrl}/WebService/Servicos.asmx/PesquisarProcessos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': session.cookies,
        'User-Agent': 'ParadigmaProbe/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`[probe] Response status: ${res.status}, data keys:`, Object.keys(data));

    // Unwrap if nested in d property (common for ASP.NET AJAX)
    const results = data.d || data;

    if (!Array.isArray(results)) {
      console.warn('[probe] Expected array, got:', typeof results);
      return [];
    }

    return results;
  } catch (err) {
    console.error(`[probe] PesquisarProcessos failed:`, err);
    throw err;
  }
}

function validateGolden76(processo: ProcessoResponse): void {
  console.log(`\n[validate] Golden 76 (000010901-2/2026):`);
  console.log(`  nCdProcesso: ${processo.nCdProcesso} (expect: 76)`);
  console.log(`  sNrProcesso: ${processo.sNrProcesso} (expect: 000010901-2/2026)`);
  console.log(`  sNmUnidade: ${processo.sNmUnidade} (expect: B 077 - SEST - MARABA/PA)`);
  console.log(`  sNmModalidade: ${processo.sNmModalidade} (expect: Pregão Eletrônico)`);
  console.log(`  vValorEstimado: ${processo.vValorEstimado} (expect: 6605.39)`);

  assert.equal(processo.nCdProcesso, 76, 'nCdProcesso mismatch');
  assert.equal(processo.sNrProcesso, '000010901-2/2026', 'sNrProcesso mismatch');
  assert(
    processo.sNmUnidade?.includes('B 077') || processo.sNmUnidade?.includes('MARABA'),
    'sNmUnidade mismatch'
  );
  assert(processo.sNmModalidade?.includes('Pregão'), 'sNmModalidade mismatch');
  assert.ok(
    Math.abs((processo.vValorEstimado || 0) - 6605.39) < 0.01,
    `vValorEstimado ${processo.vValorEstimado} != 6605.39`
  );
}

describe('Paradigma HTTP Direct Probe', () => {
  const SEST_SENAT_URL = 'https://compras.sestsenat.org.br';

  test.skip('bootstrap session from Mural.aspx', async () => {
    // Skipped by default — requires network access
    const session = await bootstrapSession(SEST_SENAT_URL);
    assert.ok(session.cookies, 'No cookies returned');
    console.log('[pass] Session bootstrapped');
  });

  test.skip('pesquisar golden processo 76 (000010901-2/2026)', async () => {
    // Skipped by default — requires network access + session
    const session = await bootstrapSession(SEST_SENAT_URL);
    const resultado = await pesquisarProcessos(SEST_SENAT_URL, session, {
      dtoPaginacao: { iNrPagina: 1, iQtRegistroPagina: 100 },
      nCdProcesso: 76,
    });

    assert.ok(resultado.length > 0, 'No results returned');
    const golden = resultado.find((p) => p.nCdProcesso === 76);
    assert.ok(golden, 'Golden 76 not found in results');

    validateGolden76(golden);
    console.log('[pass] Golden 76 validated');
  });

  test('parse Paradigma date sentinels', () => {
    assert.equal(parseParadigmaDate('/Date(1723028400000)/'), '2024-08-07');
    assert.equal(parseParadigmaDate('/Date(1723115000000)/'), '2024-08-08');
    console.log('[pass] Date parsing OK');
  });

  test('parse Paradigma null sentinels', () => {
    assert.equal(parseSentinel(-2147483648), null);
    assert.equal(parseSentinel(-7.922816251426434e28), null);
    assert.equal(parseSentinel(6605.39), 6605.39);
    console.log('[pass] Sentinel parsing OK');
  });

  test('golden 76 contract check', () => {
    // Local validation without network
    const contract = {
      nCdProcesso: 76,
      sNrProcesso: '000010901-2/2026',
      sNmUnidade: 'B 077 - SEST - MARABA/PA',
      sNmModalidade: 'Pregão Eletrônico',
      vValorEstimado: 6605.39,
      sNmFase: 'Homologação',
      sSituacao: 'Homologado',
    };

    validateGolden76(contract as any);
    console.log('[pass] Golden 76 contract matches expected schema');
  });
});

// Run: npm test -- server/lib/paradigmaProbe.test.ts
// Skip network tests: npm test -- --grep 'bootstrap|pesquisar' --invert
