/**
 * Cliente PNCP — arquivos e histórico de manutenção da compra.
 */
import type { PncpArquivoDto, PncpHistoricoLogDto } from './types.js';

const PNCP_BASE = 'https://pncp.gov.br/api/pncp/v1';
const USER_AGENT = 'Monitor-PNCP-Documentos/1.0';

export type PncpDocumentosClientOptions = {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

function buildOrgaoCompraPath(cnpj: string, ano: number, sequencial: number): string {
  return `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
}

export function createPncpDocumentosClient(
  options: PncpDocumentosClientOptions = {},
): {
  fetchArquivosQuantidade: (cnpj: string, ano: number, sequencial: number) => Promise<number>;
  fetchAllArquivos: (cnpj: string, ano: number, sequencial: number) => Promise<PncpArquivoDto[]>;
  fetchAllHistorico: (cnpj: string, ano: number, sequencial: number) => Promise<PncpHistoricoLogDto[]>;
} {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function fetchJson<T>(url: string): Promise<T | null> {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  async function fetchArquivosQuantidade(
    cnpj: string,
    ano: number,
    sequencial: number,
  ): Promise<number> {
    const url = `${buildOrgaoCompraPath(cnpj, ano, sequencial)}/arquivos/quantidade`;
    const res = await fetchFn(url, {
      headers: { Accept: 'text/plain, application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return 0;
    const text = (await res.text()).trim();
    const n = Number.parseInt(text, 10);
    return Number.isFinite(n) ? n : 0;
  }

  async function fetchAllArquivos(
    cnpj: string,
    ano: number,
    sequencial: number,
  ): Promise<PncpArquivoDto[]> {
    const quantidade = await fetchArquivosQuantidade(cnpj, ano, sequencial);
    if (quantidade <= 0) return [];

    const pageSize = 50;
    const all: PncpArquivoDto[] = [];
    let pagina = 1;
    const maxPages = Math.ceil(quantidade / pageSize) + 1;

    while (pagina <= maxPages) {
      const url = `${buildOrgaoCompraPath(cnpj, ano, sequencial)}/arquivos?pagina=${pagina}&tamanhoPagina=${pageSize}`;
      const batch = await fetchJson<PncpArquivoDto[]>(url);
      if (!batch?.length) break;
      all.push(...batch);
      if (batch.length < pageSize) break;
      pagina++;
    }
    return all;
  }

  async function fetchAllHistorico(
    cnpj: string,
    ano: number,
    sequencial: number,
  ): Promise<PncpHistoricoLogDto[]> {
    const all: PncpHistoricoLogDto[] = [];
    let pagina = 1;
    while (pagina <= 20) {
      const url = `${buildOrgaoCompraPath(cnpj, ano, sequencial)}/historico?pagina=${pagina}&tamanhoPagina=50`;
      const batch = await fetchJson<PncpHistoricoLogDto[]>(url);
      if (!batch?.length) break;
      all.push(...batch);
      if (batch.length < 50) break;
      pagina++;
    }
    return all;
  }

  return { fetchArquivosQuantidade, fetchAllArquivos, fetchAllHistorico };
}

export function resolveArquivoDownloadUrl(arquivo: PncpArquivoDto): string | null {
  const raw = arquivo.url ?? arquivo.uri;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;
  return null;
}

export function buildHistoricoEventoLabel(log: PncpHistoricoLogDto): string {
  return `${log.tipoLogManutencaoNome} - ${log.categoriaLogManutencaoNome}`;
}
