/**
 * CatalogoCollector.ts
 *
 * Worker para coleta de itens padronizados do catálogo gov.br/pncp
 *
 * Fluxo:
 *   1. Parser de HTML do portal gov.br/pncp/catalogo
 *   2. Extrair itens_padronizados (CATMAT, CATSER)
 *   3. Download de documentos de padronização (PDFs, etc)
 *   4. Upsert no banco
 *   5. Link documentos aos itens
 *
 * Fonte: https://www.gov.br/pncp/pt-br/catalogo
 *
 * @see docs/CATALOGO-PADRONIZACAO.md
 * @see https://github.com/monitor-licitacao/monitor-de-licitacao/issues/XXX
 */

import crypto from 'node:crypto';
import { Logger } from 'winston';
import { CheerioAPI, load as cheerioLoad } from 'cheerio';

import { PncpItemPadronizado, PncpDocumentoPadronizacao } from '../lib/connectors/pncp/types';

/**
 * Estatísticas da coleta de catálogo
 */
export interface CatalogoCollectorStats {
  /** Total de itens processados */
  totalProcessados: number;

  /** Itens inseridos */
  totalInseridos: number;

  /** Itens atualizados */
  totalAtualizados: number;

  /** Documentos de padronização baixados */
  documentosBaixados: number;

  /** Erros durante coleta */
  erros: number;

  /** Tempo total em ms */
  tempoExecucaoMs: number;

  /** Data da coleta */
  dataCeleta: string;

  /** Status final */
  status: 'sucesso' | 'erro' | 'parcial';
}

/**
 * Worker para coleta de catálogo padronizado
 */
export class CatalogoCollector {
  private logger: Logger;
  private baseUrl = 'https://www.gov.br/pncp/pt-br/catalogo-eletronico-de-padronizacao';
  private itensUrl = `${this.baseUrl}/itens-padronizados`;

  /**
   * Inicializa collector de catálogo
   *
   * @param logger - Winston logger instance
   *
   * @example
   * const collector = new CatalogoCollector(logger);
   * const stats = await collector.coletarCatalogo();
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Executa coleta completa de itens padronizados
   *
   * Fluxo:
   *   1. Fazer parser HTML do portal
   *   2. Extrair tabelas de itens
   *   3. Normalizar dados (slug, codigos)
   *   4. Upsert no banco
   *   5. Download de documentos
   *   6. Link documentos aos itens
   *
   * @returns Estatísticas da coleta
   */
  async coletarCatalogo(): Promise<CatalogoCollectorStats> {
    const inicioExecucao = Date.now();

    this.logger.info('[CatalogoCollector] Iniciando coleta de catálogo');

    let totalInseridos = 0;
    let totalAtualizados = 0;
    let documentosBaixados = 0;
    let erros = 0;

    try {
      // 1. Fetch página de índice de itens
      const indexHtml = await this.fetchCatalogoHtml();

      // 2. Parse lista de itens
      const itens = await this.parseItensDoHtml(indexHtml);

      this.logger.info(
        `[CatalogoCollector] Encontrados ${itens.length} itens para processar`,
      );

      // 3. Para cada item, coletar detalhe e documentos
      for (const item of itens) {
        try {
          const itemNormalizado = this.normalizarItem(item);
          const itemId = await this.upsertItem(itemNormalizado);

          // Verificar se foi inserido ou atualizado
          if (item.primeiraColetaEm === item.ultimaColetaEm) {
            totalInseridos++;
          } else {
            totalAtualizados++;
          }

          // 4. Download de documentos anexos
          const documentos = await this.extrairDocumentos(item);
          for (const doc of documentos) {
            try {
              await this.downloadDocumento(doc.url, itemId);
              documentosBaixados++;
            } catch (err) {
              this.logger.warn(
                `[CatalogoCollector] Erro ao baixar documento: ${doc.url}`,
                { error: err },
              );
              erros++;
            }
          }
        } catch (err) {
          this.logger.error(
            `[CatalogoCollector] Erro ao processar item ${item.slug}`,
            { error: err },
          );
          erros++;
        }
      }

      const tempoExecucao = Date.now() - inicioExecucao;
      const status =
        erros === 0 ? 'sucesso' : erros < itens.length ? 'parcial' : 'erro';

      const stats: CatalogoCollectorStats = {
        totalProcessados: itens.length,
        totalInseridos,
        totalAtualizados,
        documentosBaixados,
        erros,
        tempoExecucaoMs: tempoExecucao,
        dataCeleta: new Date().toISOString(),
        status,
      };

      this.logger.info(
        `[CatalogoCollector] Coleta finalizada: ${JSON.stringify(stats)}`,
      );

      return stats;
    } catch (error) {
      this.logger.error('[CatalogoCollector] Erro fatal durante coleta', {
        error,
      });

      const stats: CatalogoCollectorStats = {
        totalProcessados: 0,
        totalInseridos: 0,
        totalAtualizados: 0,
        documentosBaixados: 0,
        erros: 1,
        tempoExecucaoMs: Date.now() - inicioExecucao,
        dataCeleta: new Date().toISOString(),
        status: 'erro',
      };

      return stats;
    }
  }

  /**
   * Faz parser do HTML da página de catálogo
   *
   * @returns HTML do portal como string
   * @throws Error se não conseguir acessar portal
   *
   * @private
   */
  private async fetchCatalogoHtml(): Promise<string> {
    this.logger.debug('[CatalogoCollector] fetchCatalogoHtml');

    const html = await this.fetchWithRetry(this.itensUrl);
    return html;
  }

  /**
   * Faz parser do HTML para extrair itens padronizados
   *
   * @param html - HTML da página
   * @returns Array de itens padronizados
   *
   * @private
   */
  private async parseItensDoHtml(html: string): Promise<PncpItemPadronizado[]> {
    this.logger.debug('[CatalogoCollector] parseItensDoHtml');

    const $ = cheerioLoad(html);
    const itens: PncpItemPadronizado[] = [];

    // Procura por links de itens (padrão: .../itens-padronizados/{slug})
    $('a[href*="/itens-padronizados/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || !href.includes('/itens-padronizados/')) return;

      const slug = this.extractSlug(href);
      if (!slug) return;

      const nome = $(el).text().trim();
      if (!nome) return;

      const item: PncpItemPadronizado = {
        id: crypto.randomUUID(),
        slug,
        nome,
        codigosCatmat: [],
        codigosCatser: [],
        primeiraColetaEm: new Date().toISOString(),
        ultimaColetaEm: new Date().toISOString(),
      };

      itens.push(item);
    });

    return [...new Map(itens.map((item) => [item.slug, item])).values()];
  }

  /**
   * Normaliza dados de item padronizado
   *
   * @param item - Item bruto extraído do HTML
   * @returns Item normalizado
   *
   * @private
   */
  private normalizarItem(item: PncpItemPadronizado): PncpItemPadronizado {
    // Trim e normalização
    const nome = item.nome.trim();
    const slug = item.slug.toLowerCase().replace(/\s+/g, '-');

    // Gerar hash do conteúdo
    const conteudoRelevante = `${nome}|${item.codigosCatmat.join(',')}|${item.codigosCatser.join(',')}|${item.descricao || ''}`;
    const hashConteudo = crypto
      .createHash('sha256')
      .update(conteudoRelevante)
      .digest('hex');

    return {
      ...item,
      nome,
      slug,
      codigosCatmat: item.codigosCatmat.map((c) => c.toUpperCase()),
      codigosCatser: item.codigosCatser.map((c) => c.toUpperCase()),
      hashConteudo,
    };
  }

  /**
   * Upsert de item padronizado no banco
   *
   * @param item - Item a inserir/atualizar
   * @returns ID do item
   *
   * @private
   */
  private async upsertItem(item: PncpItemPadronizado): Promise<string> {
    this.logger.debug(
      `[CatalogoCollector] upsertItem - slug: ${item.slug}`,
    );

    // TODO: Implementar com Drizzle ORM
    // INSERT INTO itens_padronizados (slug, nome, codigos_catmat_catser, ...)
    // ON CONFLICT (slug) DO UPDATE SET ultima_coleta_em = NOW(), hash_conteudo = ...
    // RETURNING id

    // Por enquanto, retornar UUID do item
    return item.id;
  }

  /**
   * Extrai documentos de padronização de um item
   *
   * @param item - Item com documentos
   * @returns Array de documentos
   *
   * @private
   */
  private async extrairDocumentos(
    item: PncpItemPadronizado,
  ): Promise<PncpDocumentoPadronizacao[]> {
    const documentos: PncpDocumentoPadronizacao[] = [];

    // Fetchar página do item para extrair documentos
    const itemUrl = `${this.itensUrl}/${item.slug}`;
    try {
      const html = await this.fetchWithRetry(itemUrl);
      const $ = cheerioLoad(html);

      // Procura por links de documentos (PDFs, pages SEI, etc)
      $('a[href*="/"]').each((_, el) => {
        const titulo = $(el).text().trim();
        const url = $(el).attr('href');

        if (!titulo || !url) return;

        // Detectar tipo de etapa por keyword no título
        let tipoArquivo: string | undefined;
        if (url.endsWith('.pdf')) tipoArquivo = 'pdf';
        else if (url.endsWith('.doc')) tipoArquivo = 'doc';
        else if (url.endsWith('.docx')) tipoArquivo = 'docx';

        const doc: PncpDocumentoPadronizacao = {
          id: crypto.randomUUID(),
          idItemPadronizado: item.id,
          titulo,
          url,
          tipoArquivo,
          dataPublicacao: new Date().toISOString().split('T')[0],
        };

        documentos.push(doc);
      });
    } catch (err) {
      this.logger.warn(
        `[CatalogoCollector] Erro ao extrair documentos de ${item.slug}`,
        { error: err },
      );
    }

    return documentos;
  }

  /**
   * Download de documento de padronização
   *
   * @param urlDocumento - URL do documento
   * @param idItem - ID do item a linkado
   * @returns ID do documento salvo
   *
   * @private
   */
  private async downloadDocumento(
    urlDocumento: string,
    idItem: string,
  ): Promise<string> {
    this.logger.debug(
      `[CatalogoCollector] downloadDocumento - URL: ${urlDocumento}`,
    );

    // TODO: Implementar download real
    // - Fazer fetch do documento
    // - Salvar em storage (S3 ou local)
    // - Gerar hash para deduplicação
    // - Registrar no banco (tabela: documentos_padronizacao)
    // - Implementar retry em caso de falha

    return crypto.randomUUID();
  }

  /**
   * Fetch com retry e backoff exponencial
   *
   * @param url - URL a fazer fetch
   * @param maxRetries - Número máximo de tentativas
   * @returns HTML da página
   * @private
   */
  private async fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
          headers: {
            'User-Agent': 'Monitor-Licitacoes/1.0 (+https://github.com/monitor-licitacao)',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.text();
      } catch (err) {
        if (i === maxRetries - 1) {
          throw err;
        }

        const backoff = Math.pow(2, i) * 1000;
        this.logger.warn(
          `[CatalogoCollector] Retry ${i + 1}/${maxRetries} após ${backoff}ms`,
          { url, error: err },
        );

        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Extrai slug de uma URL
   *
   * @param href - URL
   * @returns Slug extraído
   * @private
   */
  private extractSlug(href: string): string {
    const match = href.match(/\/itens-padronizados\/([^/]+)/);
    return match?.[1] || '';
  }
}
