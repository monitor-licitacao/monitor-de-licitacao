import { fetch as undiciFetch } from 'undici';
import type {
  ComprasGovCatmatItemDto,
  ComprasGovContratacao14133Dto,
  ComprasGovItemContratacao14133Dto,
  ComprasGovLookupTipo,
  ComprasGovPagedResponse,
  ComprasGovPgcDetalheDto,
} from './types.js';

export const COMPRAS_GOV_OPEN_DATA_BASE = 'https://dadosabertos.compras.gov.br';

export type ComprasGovClientOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetchImpl?: typeof undiciFetch;
};

export type ComprasGovFetchResult<T> = {
  data: T;
  url: string;
  statusCode: number;
  latencyMs: number;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export class ComprasGovOpenDataClient {
  private timeoutMs: number;
  private maxRetries: number;
  private userAgent: string;
  private fetchImpl: typeof undiciFetch;

  constructor(opts: ComprasGovClientOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 20000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.userAgent = opts.userAgent ?? 'Monitor-Licitacao-ComprasGov-OpenData/1.0';
    this.fetchImpl = opts.fetchImpl ?? undiciFetch;
  }

  private async requestJson<T>(path: string, query: Record<string, string | number | undefined>): Promise<ComprasGovFetchResult<T>> {
    const url = new URL(path, COMPRAS_GOV_OPEN_DATA_BASE);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const started = Date.now();
      try {
        const res = await this.fetchImpl(url, {
          headers: { Accept: 'application/json', 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const latencyMs = Date.now() - started;
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 200)}`);
        }
        let data: T;
        try {
          data = JSON.parse(text) as T;
        } catch {
          throw new Error(`Resposta não-JSON de ${url}: ${text.slice(0, 200)}`);
        }
        return { data, url: url.toString(), statusCode: res.status, latencyMs };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries - 1) await sleep(300 * (attempt + 1));
      }
    }
    throw lastError ?? new Error(`Falha ao consultar ${url}`);
  }

  /** Contratação 14.133 por idCompra ou numeroControlePNCPCompra */
  fetchContratacao14133(tipo: ComprasGovLookupTipo, codigo: string) {
    return this.requestJson<ComprasGovPagedResponse<ComprasGovContratacao14133Dto>>(
      '/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id',
      { tipo, codigo },
    );
  }

  /** Itens de contratação 14.133 por compra */
  fetchItensContratacao14133(
    tipo: ComprasGovLookupTipo,
    codigo: string,
    pagina = 1,
    tamanhoPagina = 50,
  ) {
    return this.requestJson<ComprasGovPagedResponse<ComprasGovItemContratacao14133Dto>>(
      '/modulo-contratacoes/2.1_consultarItensContratacoes_PNCP_14133_Id',
      { tipo, codigo, pagina, tamanhoPagina },
    );
  }

  /** Resultados homologados por período (obrigatório data inicial/final) */
  fetchResultadosItens14133(params: {
    pagina?: number;
    tamanhoPagina?: number;
    dataResultadoPncpInicial: string;
    dataResultadoPncpFinal: string;
    orgaoEntidadeCnpj?: string;
  }) {
    return this.requestJson<ComprasGovPagedResponse<ComprasGovItemContratacao14133Dto>>(
      '/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133',
      params,
    );
  }

  /** PGC — itens do plano de contratação (DFD) por órgão/ano */
  fetchPgcDetalhe(orgao: string, anoPcaProjetoCompra: number, opts?: { codigoUasg?: string; pagina?: number; tamanhoPagina?: number }) {
    return this.requestJson<ComprasGovPagedResponse<ComprasGovPgcDetalheDto>>(
      '/modulo-pgc/1_consultarPgcDetalhe',
      {
        orgao,
        anoPcaProjetoCompra,
        codigoUasg: opts?.codigoUasg,
        pagina: opts?.pagina ?? 1,
        tamanhoPagina: opts?.tamanhoPagina ?? 50,
      },
    );
  }

  /** CATMAT — item por código */
  fetchCatmatItem(codigoItem: number, pagina = 1, tamanhoPagina = 10) {
    return this.requestJson<ComprasGovPagedResponse<ComprasGovCatmatItemDto>>(
      '/modulo-material/4_consultarItemMaterial',
      { codigoItem, pagina, tamanhoPagina },
    );
  }
}
