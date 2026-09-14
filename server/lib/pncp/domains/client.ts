import { PncpDomainHttpError } from './validate.js';

export const PNCP_DOMAIN_ENDPOINTS = {
  modalidade: 'https://pncp.gov.br/api/pncp/v1/modalidades',
  instrumento: 'https://pncp.gov.br/api/pncp/v1/tipos-instrumentos-convocatorios',
  amparo: 'https://pncp.gov.br/api/pncp/v1/amparos-legais',
} as const;

export type PncpDomainFetchResult = {
  payload: unknown;
  statusCode: number;
  endpoint: string;
  durationMs: number;
};

export type PncpDomainClientOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetchFn?: typeof fetch;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  const message = err instanceof Error ? err.message : String(err);
  return name === 'AbortError' || /timeout|aborted/i.test(message);
}

export class PncpDomainClient {
  private timeoutMs: number;
  private maxRetries: number;
  private userAgent: string;
  private fetchFn: typeof fetch;

  constructor(opts: PncpDomainClientOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.userAgent = opts.userAgent ?? 'Monitor-PNCP-Domains/1.0';
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  private async request(endpoint: string): Promise<PncpDomainFetchResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const started = Date.now();
      try {
        const res = await this.fetchFn(endpoint, {
          headers: { Accept: 'application/json', 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const durationMs = Date.now() - started;
        const text = await res.text();
        if (!res.ok) {
          throw new PncpDomainHttpError(`HTTP ${res.status} for ${endpoint}: ${text.slice(0, 200)}`, res.status);
        }
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new PncpDomainHttpError(`Resposta não-JSON de ${endpoint}`, res.status);
        }
        return { payload, statusCode: res.status, endpoint, durationMs };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isAbortError(err) || attempt >= this.maxRetries - 1) {
          throw lastError;
        }
        if (err instanceof PncpDomainHttpError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
          throw err;
        }
        await sleep(300 * (attempt + 1));
      }
    }

    throw lastError ?? new Error(`Falha ao consultar ${endpoint}`);
  }

  fetchModalidades() {
    return this.request(PNCP_DOMAIN_ENDPOINTS.modalidade);
  }

  fetchInstrumentos() {
    return this.request(PNCP_DOMAIN_ENDPOINTS.instrumento);
  }

  fetchAmparos() {
    return this.request(PNCP_DOMAIN_ENDPOINTS.amparo);
  }
}

export type PncpDomainFetchAdapter = {
  fetchModalidades(): Promise<PncpDomainFetchResult>;
  fetchInstrumentos(): Promise<PncpDomainFetchResult>;
  fetchAmparos(): Promise<PncpDomainFetchResult>;
};

export function createDomainFetchAdapter(client?: PncpDomainClient): PncpDomainFetchAdapter {
  const impl = client ?? new PncpDomainClient();
  return {
    fetchModalidades: () => impl.fetchModalidades(),
    fetchInstrumentos: () => impl.fetchInstrumentos(),
    fetchAmparos: () => impl.fetchAmparos(),
  };
}
