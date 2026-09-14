import type { CnpjLookupResult } from './types.js';

const cache = new Map<string, { at: number; data: CnpjLookupResult }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export function stripCnpj(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

function logLookup(input: {
  cnpj: string;
  provider: string;
  status: number | 'error';
  latency_ms: number;
}) {
  console.info(JSON.stringify({ msg: 'cnpj_lookup', ...input }));
}

async function fetchBrasilApi(
  cnpj: string,
  fetchFn: typeof fetch,
): Promise<CnpjLookupResult | null> {
  const started = Date.now();
  try {
    const res = await fetchFn(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    logLookup({ cnpj, provider: 'brasilapi', status: res.status, latency_ms: Date.now() - started });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      razao_social?: string;
      uf?: string;
      municipio?: string;
    };
    if (!data.razao_social) return null;
    return {
      cnpj,
      razao_social: data.razao_social,
      uf: data.uf,
      municipio: data.municipio,
      provider: 'brasilapi',
    };
  } catch {
    logLookup({ cnpj, provider: 'brasilapi', status: 'error', latency_ms: Date.now() - started });
    return null;
  }
}

async function fetchReceitaWs(
  cnpj: string,
  fetchFn: typeof fetch,
): Promise<CnpjLookupResult | null> {
  const started = Date.now();
  try {
    const res = await fetchFn(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    logLookup({ cnpj, provider: 'receitaws', status: res.status, latency_ms: Date.now() - started });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      nome?: string;
      uf?: string;
      municipio?: string;
      status?: string;
    };
    if (data.status === 'ERROR' || !data.nome) return null;
    return {
      cnpj,
      razao_social: data.nome,
      uf: data.uf,
      municipio: data.municipio,
      provider: 'receitaws',
    };
  } catch {
    logLookup({ cnpj, provider: 'receitaws', status: 'error', latency_ms: Date.now() - started });
    return null;
  }
}

export async function lookupCnpj(
  cnpjRaw: string,
  fetchFn: typeof fetch = fetch,
): Promise<CnpjLookupResult | null> {
  const cnpj = stripCnpj(cnpjRaw);
  if (cnpj.length !== 14) return null;

  const cached = cache.get(cnpj);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }

  const result = (await fetchBrasilApi(cnpj, fetchFn)) ?? (await fetchReceitaWs(cnpj, fetchFn));
  if (result) cache.set(cnpj, { at: Date.now(), data: result });
  return result;
}

export function clearCnpjCache() {
  cache.clear();
}
