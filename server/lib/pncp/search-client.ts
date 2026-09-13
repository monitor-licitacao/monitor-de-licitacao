/**
 * PNCP Search — índice de publicação + resolução de controle (Fase D).
 */
import {
  applyClientSideFilters,
  buildPublicationQuery,
  type PncpSearchFilters,
} from '../pncpClient.js';
import type { PncpPublicationPage, PncpSearchHit } from './types.js';

export type PncpSearchClientOptions = {
  fetchFn?: typeof fetch;
  userAgent?: string;
  timeoutMs?: number;
};

export class PncpSearchClient {
  private fetchFn: typeof fetch;
  private userAgent: string;
  private timeoutMs: number;

  constructor(options: PncpSearchClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.userAgent = options.userAgent ?? 'Monitor-Discover/1.0';
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  /** Busca no índice PNCP com filtros client-side (q, uf, valor). */
  async fetchSearch(filters: PncpSearchFilters): Promise<PncpPublicationPage> {
    const { url, clientSideFilters } = buildPublicationQuery(filters);
    const res = await this.fetchFn(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`PNCP search HTTP ${res.status}: ${url.pathname}`);
    }

    const data = (await res.json()) as {
      data?: PncpSearchHit[];
      totalRegistros?: number;
      totalPaginas?: number;
    };

    const rawHits = (data.data ?? []) as PncpSearchHit[];
    const hits = applyClientSideFilters(rawHits, clientSideFilters) as PncpSearchHit[];

    return {
      hits,
      totalRegistros: data.totalRegistros ?? rawHits.length,
      totalPaginas: data.totalPaginas ?? 1,
      pagina: filters.pagina ?? 1,
    };
  }
}
