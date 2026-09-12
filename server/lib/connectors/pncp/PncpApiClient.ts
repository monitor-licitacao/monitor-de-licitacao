/**
 * PncpApiClient.ts
 *
 * Client tipado para integração com API PNCP
 * Endpoints:
 *   - GET /api/search/filters (órgãos e filtros)
 *   - GET /api/detalhe (detalhes de edital)
 *   - GET /api/licitacao (licitações/contratações)
 *   - GET /api/sugestoes (sugestões de termos)
 *
 * Taxa de requisições: ~1000 req/min (verificar documentação PNCP)
 *
 * @see docs/PNCP-API-INTEGRATION.md
 * @see https://github.com/monitor-licitacao/monitor-de-licitacao/issues/XXX
 */

import { Logger } from 'winston';

import {
  PncpApiError,
  PncpEdital,
  PncpFilterOptions,
  PncpOrgao,
  PncpSearchResult,
  RateLimitConfig,
} from './types';

/**
 * Client para integração com API PNCP
 */
export class PncpApiClient {
  private baseUrl = 'https://pncp.gov.br/api';
  private logger: Logger;
  private rateLimitConfig: RateLimitConfig;
  private lastRequestTime = 0;

  /**
   * Inicializa cliente PNCP
   *
   * @param logger - Winston logger instance
   * @param rateLimitConfig - Configuração de rate limiting (opcional)
   *
   * @example
   * const client = new PncpApiClient(logger);
   */
  constructor(
    logger: Logger,
    rateLimitConfig?: Partial<RateLimitConfig>,
  ) {
    this.logger = logger;
    this.rateLimitConfig = {
      requestsPorMinuto: 1000,
      delayEntrerequisicoes: 100,
      maxRetries: 3,
      delayEntreRetries: 1000,
      ...rateLimitConfig,
    };
  }

  /**
   * Fetcha todos os órgãos contratantes do PNCP
   *
   * Retorna lista de ~15.000 órgãos com filtros disponíveis
   *
   * Requisição pode ser paginada; este método trata automaticamente
   *
   * @returns Array de órgãos com informações básicas
   * @throws PncpApiError se request falhar
   *
   * @example
   * const orgaos = await client.fetchOrgaos();
   * console.log(`Total de órgãos: ${orgaos.length}`);
   */
  async fetchOrgaos(): Promise<PncpOrgao[]> {
    const inicio = Date.now();
    this.logger.info('[PncpApiClient] fetchOrgaos - iniciando coleta de órgãos');

    try {
      const response = await this.request<{
        filters?: { orgaos?: PncpOrgao[] };
      }>('/search/filters?tipos_documento=edital');

      const orgaos = response.filters?.orgaos || [];
      const duracao = Date.now() - inicio;

      this.logger.info(
        `[PncpApiClient] fetchOrgaos - sucesso: ${orgaos.length} órgãos, ${duracao}ms`,
      );

      return orgaos;
    } catch (error) {
      const duracao = Date.now() - inicio;
      this.logger.error(
        `[PncpApiClient] fetchOrgaos - erro após ${duracao}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetcha licitações/contratações de um órgão específico
   *
   * @param cnpjOrgao - CNPJ do órgão
   * @param filtros - Filtros adicionais (datas, modalidade, etc.)
   * @returns Array de editais
   * @throws PncpApiError se request falhar
   */
  async fetchEditaisPorOrgao(
    cnpjOrgao: string,
    filtros?: Partial<PncpFilterOptions>,
  ): Promise<PncpEdital[]> {
    const inicio = Date.now();
    this.logger.info(
      `[PncpApiClient] fetchEditaisPorOrgao - CNPJ: ${cnpjOrgao}`,
    );

    try {
      const params = new URLSearchParams({
        cnpj_orgao: cnpjOrgao,
        ...(filtros?.dataInicial && { data_inicial: filtros.dataInicial }),
        ...(filtros?.dataFinal && { data_final: filtros.dataFinal }),
        ...(filtros?.modalidade && { modalidade: filtros.modalidade }),
        ...(filtros?.pagina && { pagina: String(filtros.pagina) }),
        ...(filtros?.itensPorPagina && {
          itens_por_pagina: String(filtros.itensPorPagina),
        }),
      });

      const response = await this.request<{
        data?: PncpEdital[];
      }>(`/licitacao?${params.toString()}`);

      const editais = response.data || [];
      const duracao = Date.now() - inicio;

      this.logger.info(
        `[PncpApiClient] fetchEditaisPorOrgao - sucesso: ${editais.length} editais, ${duracao}ms`,
      );

      return editais;
    } catch (error) {
      const duracao = Date.now() - inicio;
      this.logger.error(
        `[PncpApiClient] fetchEditaisPorOrgao - erro após ${duracao}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetcha detalhes completos de um edital específico
   *
   * @param idEdital - Identificador do edital no PNCP
   * @returns Detalhes do edital com itens e documentos
   * @throws PncpApiError se edital não encontrado
   */
  async fetchDetalheEdital(idEdital: string): Promise<PncpEdital> {
    const inicio = Date.now();
    this.logger.info(`[PncpApiClient] fetchDetalheEdital - ID: ${idEdital}`);

    try {
      const response = await this.request<PncpEdital>(
        `/detalhe?id=${encodeURIComponent(idEdital)}`,
      );

      const duracao = Date.now() - inicio;
      this.logger.info(
        `[PncpApiClient] fetchDetalheEdital - sucesso, ${duracao}ms`,
      );

      return response;
    } catch (error) {
      const duracao = Date.now() - inicio;
      this.logger.error(
        `[PncpApiClient] fetchDetalheEdital - erro após ${duracao}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Busca sugestões de termos na API PNCP
   *
   * Usado para autocompletar e sugestões de busca
   *
   * @param termo - Termo a ser buscado
   * @param limite - Máximo de sugestões (padrão: 10)
   * @returns Array de sugestões
   */
  async fetchSugestoes(termo: string, limite = 10): Promise<string[]> {
    const inicio = Date.now();
    this.logger.debug(
      `[PncpApiClient] fetchSugestoes - termo: "${termo}", limite: ${limite}`,
    );

    try {
      const params = new URLSearchParams({
        q: termo,
        limite: String(limite),
      });

      const response = await this.request<{
        sugestoes?: string[];
      }>(`/sugestoes?${params.toString()}`);

      const sugestoes = response.sugestoes || [];
      const duracao = Date.now() - inicio;

      this.logger.debug(
        `[PncpApiClient] fetchSugestoes - sucesso: ${sugestoes.length} sugestões, ${duracao}ms`,
      );

      return sugestoes;
    } catch (error) {
      const duracao = Date.now() - inicio;
      this.logger.error(
        `[PncpApiClient] fetchSugestoes - erro após ${duracao}ms:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Executa requisição HTTP genérica com retry e rate limiting
   *
   * @param path - Path relativo do endpoint
   * @param options - Opções do fetch
   * @returns Resposta parsed como JSON
   * @throws PncpApiError se request falhar após retries
   */
  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.rateLimitConfig.maxRetries; attempt++) {
      try {
        // Respeitar rate limiting
        await this.enforceRateLimit();

        const headers: Record<string, string> = {
          'User-Agent':
            'Monitor-Licitacao/1.0 (https://github.com/monitor-licitacao/monitor-de-licitacao)',
          'Accept': 'application/json',
        };

        if (
          options?.headers &&
          typeof options.headers === 'object' &&
          !Array.isArray(options.headers)
        ) {
          Object.assign(headers, options.headers);
        }

        // Usar AbortController para implementar timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          });

          // Log rate limit headers se disponível
          const remaining = response.headers.get('x-ratelimit-remaining');
          if (remaining) {
            this.logger.debug(
              `[PncpApiClient] Rate limit remaining: ${remaining}`,
            );
          }

          if (!response.ok) {
            throw new PncpApiError(
              response.status,
              `HTTP ${response.status}: ${response.statusText}`,
              { url, attempt },
            );
          }

          const data = (await response.json()) as T;
          clearTimeout(timeoutId);
          return data;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.rateLimitConfig.maxRetries) {
          const delayMs =
            this.rateLimitConfig.delayEntreRetries *
            Math.pow(2, attempt);
          this.logger.warn(
            `[PncpApiClient] Tentativa ${attempt + 1}/${this.rateLimitConfig.maxRetries} falhou, aguardando ${delayMs}ms`,
            { error: (error as Error).message },
          );
          await this.sleep(delayMs);
        }
      }
    }

    throw new PncpApiError(
      0,
      `Falha após ${this.rateLimitConfig.maxRetries + 1} tentativas`,
      { originalError: lastError?.message, url },
    );
  }

  /**
   * Enforça rate limiting entre requisições
   *
   * @private
   */
  private async enforceRateLimit(): Promise<void> {
    const agora = Date.now();
    const tempoDecorrido = agora - this.lastRequestTime;

    if (tempoDecorrido < this.rateLimitConfig.delayEntrerequisicoes) {
      const delayNecessario =
        this.rateLimitConfig.delayEntrerequisicoes - tempoDecorrido;
      await this.sleep(delayNecessario);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Aguarda respeitar rate limiting
   *
   * @param delayMs - Tempo de espera em millisegundos
   *
   * @private
   */
  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
