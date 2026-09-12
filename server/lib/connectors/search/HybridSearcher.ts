/**
 * HybridSearcher.ts
 *
 * Implementação de busca híbrida combinando:
 *   - BM25 (full-text search no PostgreSQL)
 *   - Cosine Similarity (embeddings + pgvector)
 *   - RRF (Reciprocal Rank Fusion)
 *
 * RRF Formula: score = Σ (1 / (k + rank_i))
 * Onde k=60 é típico para PostgreSQL
 *
 * @see docs/SEMANTIC-SEARCH-DESIGN.md
 * @see https://en.wikipedia.org/wiki/Reciprocal_rank_fusion
 */

import { Logger } from 'winston';

/**
 * Resultado individual de busca (BM25 ou Semantic)
 */
interface RankingResult {
  /** ID do item */
  id: string;

  /** Score da busca (0-1 para semantic, maior para BM25) */
  score: number;

  /** Rank (posição na lista ordenada) */
  rank: number;

  /** Tipo de busca que originou o resultado */
  fonte: 'bm25' | 'semantic';
}

/**
 * Resultado combinado com score RRF
 */
export interface HybridSearchResult {
  /** ID do item */
  id: string;

  /** Score RRF combinado */
  scoreRrf: number;

  /** Scores individuais */
  scores: {
    bm25?: number;
    semantic?: number;
  };

  /** Rank BM25 */
  rankBm25?: number;

  /** Rank Semantic */
  rankSemantic?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuração de HybridSearcher
 */
export interface HybridSearcherConfig {
  /** Peso para BM25 (0-1, padrão 0.5) */
  pesoBm25?: number;

  /** Peso para Semantic Search (0-1, padrão 0.5) */
  pesoSemantic?: number;

  /** K para RRF (padrão 60) */
  kRrf?: number;

  /** Número máximo de resultados */
  limite?: number;
}

/**
 * Hybrid searcher com RRF (Reciprocal Rank Fusion)
 */
export class HybridSearcher {
  private logger: Logger;
  private config: Required<HybridSearcherConfig>;

  /**
   * Inicializa hybrid searcher
   *
   * @param logger - Winston logger instance
   * @param config - Configuração (opcional)
   *
   * @example
   * const searcher = new HybridSearcher(logger, {
   *   pesoBm25: 0.4,
   *   pesoSemantic: 0.6,
   *   kRrf: 60,
   *   limite: 20,
   * });
   */
  constructor(logger: Logger, config?: HybridSearcherConfig) {
    this.logger = logger;
    this.config = {
      pesoBm25: config?.pesoBm25 ?? 0.5,
      pesoSemantic: config?.pesoSemantic ?? 0.5,
      kRrf: config?.kRrf ?? 60,
      limite: config?.limite ?? 20,
    };
  }

  /**
   * Combina resultados de BM25 e Semantic Search usando RRF
   *
   * Fórmula RRF: scoreRrf_i = peso_bm25 * (1 / (k + rank_bm25_i))
   *                            + peso_semantic * (1 / (k + rank_semantic_i))
   *
   * Itens que aparecem em ambas as listas têm scores combinados
   * Itens em apenas uma lista ainda aparecem mas com score reduzido
   *
   * @param bm25Results - Resultados da busca BM25 (já ordenados)
   * @param semanticResults - Resultados da busca semântica (já ordenados)
   * @returns Resultados combinados ordenados por scoreRrf decrescente
   *
   * @example
   * const bm25Results = [
   *   { id: 'item-1', score: 15.4 },
   *   { id: 'item-2', score: 12.1 },
   * ];
   * const semanticResults = [
   *   { id: 'item-2', score: 0.95 },
   *   { id: 'item-3', score: 0.87 },
   * ];
   * const combined = searcher.combineWithRrf(bm25Results, semanticResults);
   * // [
   * //   { id: 'item-2', scoreRrf: 0.85, scores: { bm25: 12.1, semantic: 0.95 } },
   * //   { id: 'item-1', scoreRrf: 0.42, scores: { bm25: 15.4 } },
   * //   { id: 'item-3', scoreRrf: 0.24, scores: { semantic: 0.87 } },
   * // ]
   *
   * TODO: Implementar em Commit 4
   * @see Notion Task: SEARCH-004-RRF
   */
  combineWithRrf(
    bm25Results: Array<{ id: string; score: number }>,
    semanticResults: Array<{ id: string; score: number }>,
  ): HybridSearchResult[] {
    this.logger.info(
      `[HybridSearcher] combineWithRrf - BM25: ${bm25Results.length}, Semantic: ${semanticResults.length}`,
    );

    // TODO: Criar map de id -> RankingResult para cada fonte
    // TODO: Implementar RRF formula
    // TODO: Combinar scores com pesos
    // TODO: Ordenar por scoreRrf descrescente
    // TODO: Limitar a top-K resultados
    // TODO: Adicionar metadata (ranks individuais, scores)

    throw new Error('Not implemented');
  }

  /**
   * Calcula score RRF para um par de ranks
   *
   * Se um resultado não aparece em uma das listas, use rank = infinito
   *
   * @param rankBm25 - Rank no BM25 (1-indexed, ou Infinity se não encontrado)
   * @param rankSemantic - Rank no Semantic (1-indexed, ou Infinity se não encontrado)
   * @returns Score RRF normalizado
   *
   * @private
   *
   * TODO: Implementar em Commit 4
   */
  private calculateRrfScore(
    rankBm25: number | null,
    rankSemantic: number | null,
  ): number {
    // TODO: Aplicar fórmula:
    // scoreRrf = peso_bm25 * (1 / (k + rank_bm25))
    //          + peso_semantic * (1 / (k + rank_semantic))
    // Onde rank = Infinity se null

    throw new Error('Not implemented');
  }

  /**
   * Normaliza scores para escala 0-1
   *
   * Necessário pois BM25 pode ter scores muito altos (>100)
   * enquanto semantic scores já estão em 0-1
   *
   * @param score - Score bruto
   * @param fonte - Tipo de busca
   * @returns Score normalizado (0-1)
   *
   * @private
   *
   * TODO: Implementar em Commit 4
   */
  private normalizeScore(score: number, fonte: 'bm25' | 'semantic'): number {
    // TODO: Para BM25: usar função softmax ou sigmoid
    // TODO: Para Semantic: já está normalizado, retornar como está

    throw new Error('Not implemented');
  }
}
