/**
 * types.ts
 *
 * Definições de tipos e interfaces para integração com API PNCP
 * Documentação oficial: https://pncp.gov.br/
 *
 * @see docs/PNCP-API-INTEGRATION.md
 */

/**
 * Representação de um órgão contratante no PNCP
 */
export interface PncpOrgao {
  /** Identificador único do órgão */
  id: string;

  /** CNPJ do órgão (14 dígitos) */
  cnpj: string;

  /** Nome completo do órgão */
  nome: string;

  /** Quantidade total de licitações/contratações */
  total: number;

  /** UF (Unidade Federativa) do órgão */
  uf?: string;

  /** Tipo de órgão (Ministério, Secretaria, etc.) */
  tipoOrgao?: string;
}

/**
 * Representação de um edital de licitação/contratação
 */
export interface PncpEdital {
  /** Identificador único do edital */
  id: string;

  /** Título/descrição do edital */
  titulo: string;

  /** Número do edital */
  numero: string;

  /** Data de publicação */
  dataPublicacao: string;

  /** Data de encerramento/resultado */
  dataEncerramento?: string;

  /** Modalidade (Convite, Tomada de Preço, Concorrência, etc.) */
  modalidade: string;

  /** Tipo de documento (Edital, Resultado, etc.) */
  tipoDocumento: string;

  /** Órgão responsável (CNPJ) */
  cnpjOrgao: string;

  /** Identificador do órgão */
  idOrgao: string;

  /** Status do edital */
  status?: string;

  /** URL do edital no portal PNCP */
  url?: string;
}

/**
 * Representação de um item padronizado de catálogo
 */
export interface PncpItemPadronizado {
  /** Identificador único */
  id: string;

  /** Slug único para referência */
  slug: string;

  /** Nome/descrição do item */
  nome: string;

  /** Códigos CATMAT (Catálogo de Materiais) */
  codigosCatmat: string[];

  /** Códigos CATSER (Catálogo de Serviços) */
  codigosCatser: string[];

  /** Descrição detalhada */
  descricao?: string;

  /** Unidade de medida padrão */
  unidadeMedida?: string;

  /** Data da primeira coleta */
  primeiraColetaEm?: string;

  /** Data da última atualização */
  ultimaColetaEm?: string;

  /** Hash do conteúdo para detectar mudanças */
  hashConteudo?: string;
}

/**
 * Documento de padronização linkado a um item
 */
export interface PncpDocumentoPadronizacao {
  /** Identificador único */
  id: string;

  /** ID do item padronizado */
  idItemPadronizado: string;

  /** Título do documento */
  titulo: string;

  /** URL do documento no gov.br */
  url: string;

  /** Tipo de arquivo (PDF, DOC, etc.) */
  tipoArquivo?: string;

  /** Data de publicação */
  dataPublicacao?: string;

  /** Hash do conteúdo para rastreamento */
  hashConteudo?: string;
}

/**
 * Resultado de busca na API PNCP
 */
export interface PncpSearchResult<T> {
  /** Itens retornados */
  data: T[];

  /** Total de itens encontrados */
  total: number;

  /** Página atual */
  pagina?: number;

  /** Quantidade de itens por página */
  itensPorPagina?: number;

  /** Total de páginas */
  totalPaginas?: number;
}

/**
 * Filtros disponíveis na API PNCP
 */
export interface PncpFilterOptions {
  /** Filtrar por tipo de documento */
  tiposDocumento?: string[];

  /** Filtrar por órgão (CNPJ) */
  cnpjOrgao?: string;

  /** Filtrar por data inicial (YYYY-MM-DD) */
  dataInicial?: string;

  /** Filtrar por data final (YYYY-MM-DD) */
  dataFinal?: string;

  /** Filtrar por modalidade */
  modalidade?: string;

  /** Termo de busca */
  termo?: string;

  /** Página (começando em 1) */
  pagina?: number;

  /** Itens por página (máximo 100) */
  itensPorPagina?: number;
}

/**
 * Configuração de rate limiting
 */
export interface RateLimitConfig {
  /** Requisições por minuto */
  requestsPorMinuto: number;

  /** Timeout entre requisições em ms */
  delayEntrerequisicoes: number;

  /** Número máximo de tentativas (retry) */
  maxRetries: number;

  /** Tempo de espera entre tentativas em ms */
  delayEntreRetries: number;
}

/**
 * Erro customizado da API PNCP
 */
export class PncpApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PncpApiError';
  }
}
