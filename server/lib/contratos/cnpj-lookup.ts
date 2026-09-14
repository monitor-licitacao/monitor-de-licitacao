import type { CnpjLookupResult } from './types.js';

const cache = new Map<string, { at: number; data: CnpjLookupResult }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export function stripCnpj(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
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

  try {
    const res = await fetchFn(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      cnpj?: string;
      razao_social?: string;
      uf?: string;
      municipio?: string;
    };
    const result: CnpjLookupResult = {
      cnpj,
      razao_social: data.razao_social ?? '',
      uf: data.uf,
      municipio: data.municipio,
    };
    cache.set(cnpj, { at: Date.now(), data: result });
    return result;
  } catch {
    return null;
  }
}

export function clearCnpjCache() {
  cache.clear();
}
