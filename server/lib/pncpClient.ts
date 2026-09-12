/**
 * Cliente unificado para a API pública de consulta do PNCP.
 *
 * Modelo de produto (benchmark Todas Licitações):
 * - Nível 1: busca leve de metadados (índice) via /contratacoes/publicacao
 * - Nível 2: itens/documentos hidratados sob demanda (futuro: endpoint de detalhe)
 *
 * Este módulo traduz filtros de domínio do Monitor para parâmetros oficiais do PNCP.
 */

export const PNCP_PUBLICATION_URL =
  'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';

/** Modalidades PNCP mais usadas em compras de equipamentos / serviços. */
export const DEFAULT_PNCP_MODALIDADES = [6, 5, 4, 8] as const;

/** Códigos aceitos pelo filtro de modalidade (compatível com Todas Licitações). */
export const PNCP_MODALIDADE_CODES = [1, 3, 4, 5, 6, 7, 8, 9, 13] as const;

export type PncpSituacao = 'abertas' | 'encerradas' | 'todas';

/**
 * Filtros de busca no vocabulário do produto (similar à API Todas Licitações).
 * Nem todos têm equivalente direto no endpoint de publicação do PNCP — alguns
 * são aplicados client-side após a resposta.
 */
export interface PncpSearchFilters {
  /** Busca textual em objeto, órgão ou município (client-side). */
  q?: string;
  uf?: string;
  municipio?: string;
  modalidade?: number;
  /** CNPJ do órgão emissor (14 dígitos, com ou sem formatação). */
  cnpj?: string;
  situacao?: PncpSituacao;
  valorMin?: number;
  valorMax?: number;
  /** Intervalo de publicação — obrigatório para consulta oficial. */
  dataInicial: string;
  dataFinal: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface PncpPublicationQuery {
  url: URL;
  clientSideFilters: Pick<PncpSearchFilters, 'q' | 'uf' | 'municipio' | 'valorMin' | 'valorMax' | 'situacao'>;
}

export interface PncpRawItem {
  codigoNcm?: string;
  objetoCompra?: string;
  objeto?: string;
  anoContratacao?: number | string;
  numeroContratacao?: number | string;
  processo?: string;
  orgaoEntidade?: {
    cnpj?: string;
    razaoSocial?: string;
    uf?: string;
    municipio?: string;
  };
  arquivos?: Array<{ url?: string; tipoDocumentoNome?: string; titulo?: string }>;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  linkSistemaOrigem?: string;
  valorTotalEstimado?: number | string;
  situacaoCompra?: string;
}

export interface PncpEditalDraft {
  id: string;
  processNumber: string;
  title: string;
  agency: string;
  ncmCode: string;
  objectDescription: string;
  url: string | null;
  rawUrl: string;
  estimatedValue: string | null;
  publishedAt: Date;
  biddingDate: Date;
  uf: string | null;
  municipio: string | null;
}

export interface TenantMatchRule {
  tenantId: number;
  ncms: string[];
  keywords: string[];
}

export type TenantMatchType = 'NCM' | 'KEYWORD';

export interface TenantMatchResult {
  tenantId: number;
  matchType: TenantMatchType;
  matchedTerm: string;
}

/** Formata Date ou ISO string para AAAAMMDD exigido pelo PNCP. */
export function formatPncpDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Remove pontuação do CNPJ. */
export function normalizeCnpjDigits(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Traduz filtros de domínio para query string oficial do PNCP.
 * Filtros sem parâmetro nativo ficam em clientSideFilters.
 */
export function buildPublicationQuery(filters: PncpSearchFilters): PncpPublicationQuery {
  const url = new URL(PNCP_PUBLICATION_URL);
  url.searchParams.set('dataInicial', formatPncpDate(filters.dataInicial));
  url.searchParams.set('dataFinal', formatPncpDate(filters.dataFinal));
  url.searchParams.set('pagina', String(filters.pagina ?? 1));
  url.searchParams.set('tamanhoPagina', String(filters.tamanhoPagina ?? 50));

  if (filters.modalidade != null) {
    url.searchParams.set('codigoModalidadeContratacao', String(filters.modalidade));
  }
  if (filters.cnpj) {
    url.searchParams.set('cnpj', normalizeCnpjDigits(filters.cnpj));
  }

  return {
    url,
    clientSideFilters: {
      q: filters.q,
      uf: filters.uf?.toUpperCase(),
      municipio: filters.municipio?.toLowerCase(),
      valorMin: filters.valorMin,
      valorMax: filters.valorMax,
      situacao: filters.situacao ?? 'abertas',
    },
  };
}

/** Extrai URL do PDF de edital quando disponível na resposta PNCP. */
export function extractPncpPdfUrl(arquivos: PncpRawItem['arquivos']): string | null {
  if (!arquivos?.length) return null;
  const editalDoc = arquivos.find(
    (a) =>
      a.tipoDocumentoNome?.toLowerCase() === 'edital' ||
      a.titulo?.toLowerCase().includes('edital'),
  );
  return editalDoc?.url ?? arquivos[0]?.url ?? null;
}

/** Gera ID estável para deduplicação no banco. */
export function buildPncpEditalId(item: PncpRawItem): string {
  const cnpj = item.orgaoEntidade?.cnpj ?? 'sem-cnpj';
  return `edital-pncp-${item.anoContratacao}-${item.numeroContratacao}-${cnpj}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
}

/** Normaliza registro bruto do PNCP para insert em schema.editais. */
export function normalizePncpItem(item: PncpRawItem, fallbackNcm = 'N/A'): PncpEditalDraft {
  const pdfUrl = extractPncpPdfUrl(item.arquivos);
  const pubDate = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : new Date();
  const bidDate = item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : pubDate;
  const objectDescription = item.objetoCompra || item.objeto || '';

  return {
    id: buildPncpEditalId(item),
    processNumber: item.processo || `${item.numeroContratacao}/${item.anoContratacao}`,
    title: objectDescription.slice(0, 100),
    agency: item.orgaoEntidade?.razaoSocial || 'Órgão Desconhecido',
    ncmCode: item.codigoNcm || fallbackNcm,
    objectDescription,
    url: pdfUrl || item.linkSistemaOrigem || null,
    rawUrl: item.linkSistemaOrigem || PNCP_PUBLICATION_URL,
    estimatedValue:
      item.valorTotalEstimado != null ? String(item.valorTotalEstimado) : null,
    publishedAt: pubDate,
    biddingDate: bidDate,
    uf: item.orgaoEntidade?.uf ?? null,
    municipio: item.orgaoEntidade?.municipio ?? null,
  };
}

function parseEstimatedValue(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAberta(item: PncpRawItem, now = new Date()): boolean {
  if (!item.dataAberturaProposta) return true;
  const abertura = new Date(item.dataAberturaProposta);
  return abertura >= now;
}

/**
 * Aplica filtros que o endpoint de publicação do PNCP não expõe nativamente.
 */
export function applyClientSideFilters(
  items: PncpRawItem[],
  filters: PncpPublicationQuery['clientSideFilters'],
  now = new Date(),
): PncpRawItem[] {
  return items.filter((item) => {
    const texto = [
      item.objetoCompra,
      item.objeto,
      item.orgaoEntidade?.razaoSocial,
      item.orgaoEntidade?.municipio,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (filters.q && !texto.includes(filters.q.toLowerCase())) return false;

    if (filters.uf) {
      const itemUf = item.orgaoEntidade?.uf?.toUpperCase();
      if (itemUf && itemUf !== filters.uf) return false;
    }

    if (filters.municipio) {
      const itemMunicipio = item.orgaoEntidade?.municipio?.toLowerCase();
      if (itemMunicipio && !itemMunicipio.includes(filters.municipio)) return false;
    }

    const draft = normalizePncpItem(item);
    const valor = parseEstimatedValue(draft.estimatedValue);
    if (filters.valorMin != null && valor != null && valor < filters.valorMin) return false;
    if (filters.valorMax != null && valor != null && valor > filters.valorMax) return false;

    if (filters.situacao === 'abertas' && !isAberta(item, now)) return false;
    if (filters.situacao === 'encerradas' && isAberta(item, now)) return false;

    return true;
  });
}

/** Cruza edital normalizado com regras NCM/keyword de um ou mais tenants. */
export function matchTenantsForItem(
  item: PncpRawItem,
  rules: TenantMatchRule[],
): TenantMatchResult[] {
  const itemNcm = (item.codigoNcm || '').toLowerCase().trim();
  const itemDesc = (item.objetoCompra || item.objeto || '').toLowerCase();
  const matches: TenantMatchResult[] = [];

  for (const rule of rules) {
    const ncmHit = rule.ncms.find((ncm) => itemNcm.startsWith(ncm.toLowerCase()));
    if (ncmHit) {
      matches.push({ tenantId: rule.tenantId, matchType: 'NCM', matchedTerm: ncmHit });
      continue;
    }
    const kwHit = rule.keywords.find((kw) => itemDesc.includes(kw.toLowerCase()));
    if (kwHit) {
      matches.push({ tenantId: rule.tenantId, matchType: 'KEYWORD', matchedTerm: kwHit });
    }
  }

  return matches;
}
