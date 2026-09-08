/**
 * Centralized Unified Connector Executor (Fase 1 - Dados Honestos)
 * Unifica a execução manual (Testar Conector) e agendada (Scheduler)
 * garantindo que a mesma configuração persistida seja validada,
 * normalizada e aplicada de ponta a ponta.
 */
import * as cheerio from 'cheerio';
import { isRejectedSistemaSUrl } from './sistemaSUrls.js';

export type ApiConnectorConfig = {
  type: 'api';
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
};

export type ScraperConnectorConfig = {
  type: 'scraper';
  listSelector: string;
  titleSelector: string;
  descriptionSelector?: string;
  dateSelector?: string;
  waitFor?: string;
};

export type NormalizedConnectorConfig = ApiConnectorConfig | ScraperConnectorConfig;

export interface ExecuteConnectorOptions {
  sourceId?: string;
  sourceName?: string;
  tenantId?: number;
  type: 'API' | 'SCRAPER' | string;
  endpointOrUrl: string;
  selectorOrParams?: string | null;
  customFetch?: typeof fetch;
}

export interface ExtractedItemPreview {
  title?: string;
  description?: string;
  date?: string;
  processNumber?: string;
  ncmCode?: string;
  raw?: any;
}

export interface ConnectorExecutionResult {
  success: boolean;
  sourceId?: string;
  sourceName?: string;
  type: 'API' | 'SCRAPER';
  urlTested: string;
  normalizedConfig: NormalizedConnectorConfig;
  latencyMs: number;
  httpStatusCode?: number;
  statusText?: string;
  itemsFound: number;
  error?: string;
  canonicalSuggestion?: string;
  payloadPreview: {
    httpStatus?: number;
    detectedItems: number;
    sampleTitle?: string;
    items?: ExtractedItemPreview[];
    htmlElementsMatched?: number;
    botProtectionDetected?: boolean;
    rawPreview?: string;
    parsedJson?: any;
    parseError?: string;
  };
  testedAt: string;
}

/**
 * SSRF Validation Helper (Regra 12: Prevenção de SSRF)
 */
export function isValidSourceUrl(urlStr: string): { valid: boolean; reason?: string } {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;

    // Bloqueio de IPs privados (RFC 1918, 169.254.x.x, localhost, 127.x.x.x)
    const privateRanges = [
      /^127\./,                     // 127.0.0.0/8 (loopback)
      /^169\.254\./,                // 169.254.0.0/16 (link-local)
      /^10\./,                      // 10.0.0.0/8 (private)
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 (private)
      /^192\.168\./,                // 192.168.0.0/16 (private)
      /^localhost$/i,               // localhost
      /^\[::\]/,                    // IPv6 loopback
    ];

    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return { valid: false, reason: `Blocked private IP range: ${hostname}` };
      }
    }

    // Apenas HTTP e HTTPS permitidos
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, reason: `Invalid protocol: ${url.protocol}` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `Invalid URL: ${(e as Error).message}` };
  }
}

/**
 * Normaliza e valida a configuração do conector de forma estrita.
 * Configuração inválida gera erro explícito; não usa fallback silencioso.
 */
export function normalizeConnectorConfig(
  type: 'API' | 'SCRAPER' | string,
  rawConfig: string | null | undefined
): NormalizedConnectorConfig {
  const normalizedType = (type || '').toUpperCase();

  if (normalizedType === 'API') {
    if (!rawConfig || !rawConfig.trim()) {
      return {
        type: 'api',
        query: {},
        headers: {},
      };
    }

    const trimmed = rawConfig.trim();

    // Se começa com '{', deve ser um JSON válido
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('JSON de configuração deve ser um objeto.');
        }

        if (parsed.query !== undefined || parsed.headers !== undefined) {
          const query = parsed.query && typeof parsed.query === 'object' && !Array.isArray(parsed.query)
            ? parsed.query
            : {};
          const headers = parsed.headers && typeof parsed.headers === 'object' && !Array.isArray(parsed.headers)
            ? parsed.headers
            : {};
          return {
            type: 'api',
            query,
            headers,
          };
        }

        // Caso plano: { "ncm": "9506.91", "status": "aberta" }
        return {
          type: 'api',
          query: parsed,
          headers: {},
        };
      } catch (err: any) {
        throw new Error(`Configuração JSON de API inválida: ${err.message}`);
      }
    }

    // Caso Query string: ?ncm=9506.91&status=aberta ou ncm=9506.91&status=aberta
    const searchPart = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
    try {
      const params = new URLSearchParams(searchPart);
      const query: Record<string, string> = {};
      params.forEach((value, key) => {
        if (key.trim()) {
          query[key.trim()] = value;
        }
      });
      return {
        type: 'api',
        query,
        headers: {},
      };
    } catch (err: any) {
      throw new Error(`Formato de Query Params inválido para API: ${err.message}`);
    }
  }

  if (normalizedType === 'SCRAPER') {
    if (!rawConfig || !rawConfig.trim()) {
      throw new Error("Configuração de Scraper inválida: 'listSelector' é obrigatório.");
    }

    const trimmed = rawConfig.trim();

    // Se começa com '{', deve ser um JSON com listSelector
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Configuração JSON do Scraper deve ser um objeto.');
        }

        if (!parsed.listSelector || typeof parsed.listSelector !== 'string' || !parsed.listSelector.trim()) {
          throw new Error("Configuração de Scraper inválida: 'listSelector' é obrigatório no JSON.");
        }

        return {
          type: 'scraper',
          listSelector: parsed.listSelector.trim(),
          titleSelector: (parsed.titleSelector && typeof parsed.titleSelector === 'string')
            ? parsed.titleSelector.trim()
            : 'a, h3, h2, .title, td:nth-child(2)',
          descriptionSelector: typeof parsed.descriptionSelector === 'string' ? parsed.descriptionSelector.trim() : undefined,
          dateSelector: typeof parsed.dateSelector === 'string' ? parsed.dateSelector.trim() : undefined,
          waitFor: typeof parsed.waitFor === 'string' ? parsed.waitFor.trim() : undefined,
        };
      } catch (err: any) {
        throw new Error(`Configuração JSON de Scraper inválida: ${err.message}`);
      }
    }

    // Se é texto puro, trata como listSelector CSS
    return {
      type: 'scraper',
      listSelector: trimmed,
      titleSelector: 'a, h3, h2, .title, td:nth-child(2)',
    };
  }

  throw new Error(`Tipo de conector desconhecido: '${type}'. Esperado 'API' ou 'SCRAPER'.`);
}

/**
 * Constrói a URL final da API anexando os query parameters configurados.
 */
export function buildApiUrl(
  baseUrl: string,
  query?: Record<string, string | number | boolean>
): string {
  const url = new URL(baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Função central de execução de conectores.
 * Usada tanto pelo teste manual (/api/sources/:id/test e /api/sources/test)
 * quanto pelo scheduler de background e /api/scheduler/run-now.
 */
export async function executeConnector(
  options: ExecuteConnectorOptions
): Promise<ConnectorExecutionResult> {
  const {
    sourceId,
    sourceName,
    type,
    endpointOrUrl,
    selectorOrParams,
    customFetch = fetch,
  } = options;

  const testedAt = new Date().toISOString();
  const normalizedType = (type || 'SCRAPER').toUpperCase() === 'API' ? 'API' : 'SCRAPER';

  // 1. Validação Desmock Sistema S
  const rejection = isRejectedSistemaSUrl(endpointOrUrl);
  if (rejection.rejected) {
    return {
      success: false,
      sourceId,
      sourceName,
      type: normalizedType,
      urlTested: endpointOrUrl,
      normalizedConfig: normalizedType === 'API'
        ? { type: 'api', query: {}, headers: {} }
        : { type: 'scraper', listSelector: selectorOrParams || '', titleSelector: '' },
      latencyMs: 0,
      httpStatusCode: 400,
      statusText: rejection.reason,
      itemsFound: 0,
      error: rejection.reason,
      canonicalSuggestion: rejection.canonicalSuggestion,
      payloadPreview: {
        httpStatus: 400,
        detectedItems: 0,
        rawPreview: rejection.reason,
      },
      testedAt,
    };
  }

  // 2. Normalização e validação estrita da configuração
  let normalizedConfig: NormalizedConnectorConfig;
  try {
    normalizedConfig = normalizeConnectorConfig(normalizedType, selectorOrParams);
  } catch (configErr: any) {
    return {
      success: false,
      sourceId,
      sourceName,
      type: normalizedType,
      urlTested: endpointOrUrl,
      normalizedConfig: normalizedType === 'API'
        ? { type: 'api', query: {}, headers: {} }
        : { type: 'scraper', listSelector: '', titleSelector: '' },
      latencyMs: 0,
      httpStatusCode: 400,
      statusText: 'Configuração inválida',
      itemsFound: 0,
      error: configErr.message,
      payloadPreview: {
        httpStatus: 400,
        detectedItems: 0,
        parseError: configErr.message,
      },
      testedAt,
    };
  }

  // 3. Montagem da URL final
  let finalUrl = endpointOrUrl;
  const requestHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; Monitor-Licitacoes/1.0)',
  };

  if (normalizedConfig.type === 'api') {
    try {
      finalUrl = buildApiUrl(endpointOrUrl, normalizedConfig.query);
    } catch (urlErr: any) {
      return {
        success: false,
        sourceId,
        sourceName,
        type: 'API',
        urlTested: endpointOrUrl,
        normalizedConfig,
        latencyMs: 0,
        httpStatusCode: 400,
        itemsFound: 0,
        error: `URL base inválida: ${urlErr.message}`,
        payloadPreview: { httpStatus: 400, detectedItems: 0 },
        testedAt,
      };
    }

    if (normalizedConfig.headers) {
      Object.assign(requestHeaders, normalizedConfig.headers);
    }
  }

  // 4. Validação SSRF sobre a URL final gerada
  const urlValidation = isValidSourceUrl(finalUrl);
  if (!urlValidation.valid) {
    return {
      success: false,
      sourceId,
      sourceName,
      type: normalizedType,
      urlTested: finalUrl,
      normalizedConfig,
      latencyMs: 0,
      httpStatusCode: 403,
      statusText: 'SSRF Protection',
      itemsFound: 0,
      error: `SSRF Protection: ${urlValidation.reason}`,
      payloadPreview: {
        httpStatus: 403,
        detectedItems: 0,
        rawPreview: urlValidation.reason,
      },
      testedAt,
    };
  }

  // 5. Execução HTTP real com timeout
  const startTime = Date.now();
  try {
    const response = await customFetch(finalUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - startTime;
    const bodyText = await response.text();

    if (normalizedConfig.type === 'api') {
      let parsedJson: any = null;
      let itemsFound = 0;
      let sampleTitle = '';
      const extractedItems: ExtractedItemPreview[] = [];

      try {
        parsedJson = JSON.parse(bodyText);
        // Detecta lista de itens em formatos comuns (data, items, itens, resultado ou array raiz)
        const candidates = Array.isArray(parsedJson)
          ? parsedJson
          : (parsedJson.data || parsedJson.items || parsedJson.itens || parsedJson.resultado || []);

        if (Array.isArray(candidates)) {
          itemsFound = candidates.length;
          for (let i = 0; i < Math.min(candidates.length, 5); i++) {
            const item = candidates[i];
            const title = item.title || item.objeto || item.objetoCompra || item.descricao || `Item #${i + 1}`;
            if (!sampleTitle) sampleTitle = String(title).slice(0, 100);
            extractedItems.push({
              title: String(title).slice(0, 120),
              processNumber: item.processo || item.numeroContratacao || item.processNumber,
              ncmCode: item.codigoNcm || item.ncmCode,
              description: String(item.objeto || item.objetoCompra || item.description || '').slice(0, 200),
            });
          }
        }
      } catch {
        return {
          success: response.ok,
          sourceId,
          sourceName,
          type: 'API',
          urlTested: finalUrl,
          normalizedConfig,
          latencyMs,
          httpStatusCode: response.status,
          statusText: response.statusText,
          itemsFound: 0,
          payloadPreview: {
            httpStatus: response.status,
            detectedItems: 0,
            parseError: 'Resposta não é JSON válido.',
            rawPreview: bodyText.slice(0, 300),
          },
          testedAt,
        };
      }

      return {
        success: response.ok,
        sourceId,
        sourceName,
        type: 'API',
        urlTested: finalUrl,
        normalizedConfig,
        latencyMs,
        httpStatusCode: response.status,
        statusText: response.statusText,
        itemsFound,
        payloadPreview: {
          httpStatus: response.status,
          detectedItems: itemsFound,
          sampleTitle: sampleTitle || (itemsFound > 0 ? `${itemsFound} itens retornados` : undefined),
          items: extractedItems,
          parsedJson,
          rawPreview: bodyText.slice(0, 300),
        },
        testedAt,
      };
    } else {
      // Scraper HTML execution via Cheerio
      const $ = cheerio.load(bodyText);
      const matchedElements = $(normalizedConfig.listSelector);
      const itemsFound = matchedElements.length;
      const extractedItems: ExtractedItemPreview[] = [];
      let sampleTitle = '';

      matchedElements.slice(0, 5).each((i, el) => {
        const itemEl = $(el);
        const titleText = normalizedConfig.titleSelector
          ? itemEl.find(normalizedConfig.titleSelector).first().text().trim() || itemEl.text().trim()
          : itemEl.text().trim();

        const descText = normalizedConfig.descriptionSelector
          ? itemEl.find(normalizedConfig.descriptionSelector).first().text().trim()
          : undefined;

        const dateText = normalizedConfig.dateSelector
          ? itemEl.find(normalizedConfig.dateSelector).first().text().trim()
          : undefined;

        if (!sampleTitle && titleText) {
          sampleTitle = titleText.slice(0, 100);
        }

        extractedItems.push({
          title: titleText.slice(0, 120),
          description: descText ? descText.slice(0, 200) : undefined,
          date: dateText,
        });
      });

      const isBotProtected = /captcha|access denied|cloudflare|are you human/i.test(bodyText);

      return {
        success: response.ok && !isBotProtected,
        sourceId,
        sourceName,
        type: 'SCRAPER',
        urlTested: finalUrl,
        normalizedConfig,
        latencyMs,
        httpStatusCode: response.status,
        statusText: response.statusText,
        itemsFound,
        payloadPreview: {
          httpStatus: response.status,
          detectedItems: itemsFound,
          htmlElementsMatched: itemsFound,
          sampleTitle: sampleTitle || (itemsFound > 0 ? `${itemsFound} elementos capturados` : undefined),
          items: extractedItems,
          botProtectionDetected: isBotProtected,
          rawPreview: bodyText.slice(0, 300),
        },
        testedAt,
      };
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    const statusText = isTimeout ? 'Timeout (15s) sem resposta.' : (error.message || 'Erro de rede.');

    return {
      success: false,
      sourceId,
      sourceName,
      type: normalizedType,
      urlTested: finalUrl,
      normalizedConfig,
      latencyMs,
      statusText,
      itemsFound: 0,
      error: statusText,
      payloadPreview: {
        detectedItems: 0,
        rawPreview: statusText,
      },
      testedAt,
    };
  }
}
