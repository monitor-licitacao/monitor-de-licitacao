import type { PncpItemResultadoDto } from './types.js';

const PNCP_PNCP_BASE = 'https://pncp.gov.br/api/pncp/v1';

export type ResultadosClientOptions = {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

export function createResultadosClient(options: ResultadosClientOptions = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    async fetchItemResultados(
      cnpj: string,
      ano: number,
      sequencial: number,
      numeroItem: number,
    ): Promise<PncpItemResultadoDto[]> {
      const url = `${PNCP_PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/${numeroItem}/resultados`;
      const res = await fetchFn(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Monitor-PNCP-Resultados/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 204) return [];
      if (!res.ok) {
        throw new Error(`PNCP resultados HTTP ${res.status}: ${url}`);
      }
      const data = (await res.json()) as PncpItemResultadoDto[];
      return Array.isArray(data) ? data : [];
    },
  };
}

export type PncpResultadosClient = ReturnType<typeof createResultadosClient>;
