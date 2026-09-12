/**
 * SemanticSearchService.ts
 *
 * Serviço de busca semântica usando embeddings + pgvector
 *
 * Estratégia:
 *   1. Embeddings via Gemini API
 *   2. Cosine similarity via pgvector (PostgreSQL)
 *   3. Pré-filtros por órgão + NCM/CATMAT
 *   4. Ranking com RRF (Reciprocal Rank Fusion)
 *
 * @see docs/SEMANTIC-SEARCH-DESIGN.md
 * @see https://github.com/monitor-licitacao/monitor-de-licitacao/issues/XXX
 */

import { Logger } from 'winston';

/**
 * Resultado de busca semântica
 */
export interface SemanticSearchResult {
  /** ID do item encontrado */
  id: string;

  /** Tipo de item (orgao, edital, item_padronizado) */
  tipo: 'orgao' | 'edital' | 'item_padronizado';

  /** Texto do item */
  texto: string;

  /** Score de relevância (0-1) */
  score: number;

  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

/**
 * Filtros para busca semântica
 */
export interface SemanticSearchFilters {
  /** Limitar por órgão (CNPJ) */
  cnpjOrgao?: string;

  /** Limitar por códigos NCM */
  codigosNcm?: string[];

  /** Limitar por códigos CATMAT */
  codigosCatmat?: string[];

  /** Limitar por códigos CATSER */
  codigosCatser?: string[];

  /** Tipos de itens a buscar */
  tipos?: ('orgao' | 'edital' | 'item_padronizado')[];

  /** Número máximo de resultados */
  limite?: number;

  /** Score mínimo (0-1) */
  scoreMinimo?: number;
}

/**
 * Serviço de busca semântica
 */
export class SemanticSearchService {
  private logger: Logger;

  /**
   * Inicializa serviço de busca semântica
   *
   * @param logger - Winston logger instance
   *
   * @example
   * const searchService = new SemanticSearchService(logger);
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Busca semântica por termo com filtros opcionais
   *
   * Fluxo:
   *   1. Gerar embedding do termo via Gemini
   *   2. Buscar no pgvector por similaridade cosine
   *   3. Aplicar pré-filtros (órgão, NCM, etc.)
   *   4. Ranking por score
   *
   * @param termo - Termo de busca
   * @param filtros - Filtros adicionais (órgão, NCM, etc.)
   * @returns Array de resultados ordenados por relevância
   *
   * TODO: Implementar em Commit 3
   * @see Notion Task: SEARCH-001-SemanticSearch
   */
  async search(
    termo: string,
    filtros?: SemanticSearchFilters,
  ): Promise<SemanticSearchResult[]> {
    this.logger.info(
      `[SemanticSearchService] search - termo: "${termo}", filtros: ${JSON.stringify(filtros)}`,
    );

    // TODO: Gerar embedding do termo
    // TODO: Executar query no pgvector
    // TODO: Aplicar filtros
    // TODO: Fazer ranking
    // TODO: Limpar resultados

    throw new Error('Not implemented');
  }

  /**
   * Busca por similaridade de embeddings (cosine similarity)
   *
   * @param embedding - Vector de embedding (1536-dim para Gemini)
   * @param filtros - Filtros adicionais
   * @returns Resultados ordenados por score
   *
   * TODO: Implementar em Commit 3
   * @see Notion Task: SEARCH-002-CosineSimilarity
   */
  async searchByEmbedding(
    embedding: number[],
    filtros?: SemanticSearchFilters,
  ): Promise<SemanticSearchResult[]> {
    this.logger.debug(
      `[SemanticSearchService] searchByEmbedding - embedding dim: ${embedding.length}`,
    );

    // TODO: Validar dimensão do embedding
    // TODO: Executar query cosine similarity no pgvector
    // TODO: Aplicar filtros
    // TODO: Retornar top-K resultados

    throw new Error('Not implemented');
  }

  /**
   * Busca híbrida (BM25 + Cosine Similarity)
   *
   * Combina busca full-text (BM25) com busca semântica usando RRF
   *
   * @param termo - Termo de busca
   * @param filtros - Filtros adicionais
   * @returns Resultados combinados com score RRF
   *
   * @see HybridSearcher para implementação
   *
   * TODO: Implementar em Commit 4
   * @see Notion Task: SEARCH-003-HybridSearch
   */
  async hybridSearch(
    termo: string,
    filtros?: SemanticSearchFilters,
  ): Promise<SemanticSearchResult[]> {
    this.logger.info(
      `[SemanticSearchService] hybridSearch - termo: "${termo}"`,
    );

    // TODO: Chamar BM25 search
    // TODO: Chamar semantic search
    // TODO: Combinar com RRF
    // TODO: Retornar resultados merged

    throw new Error('Not implemented');
  }

  /**
   * Pre-filtra por órgão (CNPJ)
   *
   * @param cnpjOrgao - CNPJ do órgão
   * @returns Lista de IDs de itens do órgão
   *
   * @private
   *
   * TODO: Implementar em Commit 3
   */
  private async getIdsByOrgao(cnpjOrgao: string): Promise<string[]> {
    this.logger.debug(
      `[SemanticSearchService] getIdsByOrgao - CNPJ: ${cnpjOrgao}`,
    );

    // TODO: Query no banco: SELECT id FROM editais WHERE cnpj_orgao = ?

    throw new Error('Not implemented');
  }

  /**
   * Pre-filtra por códigos NCM/CATMAT/CATSER
   *
   * @param codigos - Array de códigos
   * @returns Lista de IDs de itens com esses códigos
   *
   * @private
   *
   * TODO: Implementar em Commit 3
   */
  private async getIdsByCodigos(codigos: string[]): Promise<string[]> {
    this.logger.debug(
      `[SemanticSearchService] getIdsByCodigos - codigos: ${codigos.length}`,
    );

    // TODO: Query no banco com IN clause
    // TODO: Buscar em itens_padronizados.codigos_catmat_catser

    throw new Error('Not implemented');
  }
}
