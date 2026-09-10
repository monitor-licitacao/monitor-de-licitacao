/**
 * server/workers/historical_pncp_extractor.ts
 *
 * Módulo de Coleta e Extração Histórica Fatiada (PNCP & Compras.gov.br Dados Abertos).
 *
 * Principais capacidades:
 * 1. Fatiamento temporal (chunking por períodos configuráveis de 15 a 30 dias).
 * 2. Suporte híbrido e resiliente:
 *    - PNCP Consulta Oficial (https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao) com mTLS opcional.
 *    - Compras.gov.br Dados Abertos / Módulo Contratações PNCP Lei 14.133
 *      (https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133).
 *      Fallback automático e resiliente quando pncp.gov.br oscila ou aplica rate-limit.
 * 3. Filtragem semântica rigorosa por NCM (ex: 9506.91.00) e vocabulário especializado fitness
 *    (esteira, musculação, ergométrica, supino, leg press, halteres, academia, cultura física).
 * 4. Persistência idempotente em schema.editais com extração de valorTotalEstimado / orçamento.
 * 5. Gerenciamento de estado de progresso (checkpoint em memória para rastreamento em tempo real).
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import { createHash } from 'crypto';
import { decryptSecret } from '../lib/crypto.js';

export interface HistoricalExtractionOptions {
  tenantId: number;
  jobId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  ncmCode?: string; // padrão: '9506.91.00'
  keywords?: string[];
  modalidades?: number[]; // padrão: [6, 5, 4, 8]
  chunkDays?: number; // padrão: 15
  delayMs?: number; // delay entre requisições (padrão: 500ms)
  sourcePreference?: 'AUTO' | 'PNCP_DIRECT' | 'COMPRAS_DADOS_ABERTOS';
}

export interface HistoricalExtractionProgress {
  jobId: string;
  tenantId: number;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentChunkIndex: number;
  totalChunks: number;
  currentStartDate: string;
  currentEndDate: string;
  pagesProcessed: number;
  itemsExamined: number;
  matchedItemsCount: number;
  totalEstimatedValue: number;
  newEditaisInserted: number;
  sourceUsed: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface MatchedHistoricalItem {
  id: string;
  processNumber: string;
  title: string;
  agency: string;
  ncmCode: string;
  objectDescription: string;
  url: string;
  rawUrl: string;
  estimatedValue: number | null;
  publishedAt: string;
  biddingDate: string;
  matchType: 'NCM' | 'KEYWORD';
  matchedTerm: string;
  source: 'PNCP_DIRECT' | 'COMPRAS_DADOS_ABERTOS';
}

// Dicionário padrão do setor de Fitness e Cultura Física
export const DEFAULT_FITNESS_KEYWORDS = [
  'esteira',
  'esteira ergométrica',
  'bicicleta ergométrica',
  'estação de musculação',
  'aparelhos de musculação',
  'musculação',
  'halteres',
  'anilhas',
  'dumbbells',
  'kettlebell',
  'cross training',
  'tatame',
  'espaldar',
  'barra fixa',
  'banco supino',
  'supino',
  'leg press',
  'polia',
  'equipamento de ginástica',
  'academia ao ar livre',
  'piso emborrachado academia',
  'simulador de caminhada',
  'cultura física',
  'aparelho ergométrico',
  'fitness'
];

export const DEFAULT_FITNESS_NEGATIVE_KEYWORDS = [
  'parquinho infantil',
  'brinquedos de praça',
  'uniforme escolar',
  'troféu',
  'medalha',
  'coffee break'
];

// URLs oficiais
export const PNCP_DIRECT_URL = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
export const COMPRAS_DADOS_ABERTOS_PNCP_URL =
  'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133';

/**
 * Utilitário para quebrar um intervalo [startDate, endDate] em sub-intervalos (chunks)
 */
export function generateDateChunks(
  startDateStr: string,
  endDateStr: string,
  chunkDays: number = 15
): Array<{ start: string; end: string }> {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    throw new Error('Intervalo de datas inválido para extração histórica.');
  }

  if (!Number.isInteger(chunkDays) || chunkDays < 1 || chunkDays > 31) {
    throw new Error('chunkDays inválido para extração histórica (use um valor entre 1 e 31).');
  }
  const chunks: Array<{ start: string; end: string }> = [];
  let currentStart = new Date(start);

  while (currentStart <= end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkDays - 1);

    const actualEnd = currentEnd > end ? new Date(end) : currentEnd;

    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: actualEnd.toISOString().split('T')[0],
    });

    // Próximo início
    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

/**
 * Avalia se o objeto/NCM é relevante de acordo com o NCM alvo e dicionário semântico
 */
export function evaluateItemMatch(
  itemNcm: string,
  itemDesc: string,
  targetNcm: string,
  keywords: string[] = DEFAULT_FITNESS_KEYWORDS,
  negativeKeywords: string[] = DEFAULT_FITNESS_NEGATIVE_KEYWORDS
): { matches: boolean; type?: 'NCM' | 'KEYWORD'; term?: string } {
  const normalizedDesc = (itemDesc || '').toLowerCase();
  const normalizedNcm = (itemNcm || '').replace(/[^0-9]/g, '');
  const cleanTargetNcm = (targetNcm || '').replace(/[^0-9]/g, '');

  // 1. Verifica filtro negativo (exclusão)
  for (const neg of negativeKeywords) {
    if (normalizedDesc.includes(neg.toLowerCase())) {
      return { matches: false };
    }
  }

  // 2. Valida NCM
  if (cleanTargetNcm && normalizedNcm.length >= 4) {
    if (normalizedNcm.startsWith(cleanTargetNcm) || cleanTargetNcm.startsWith(normalizedNcm)) {
      return { matches: true, type: 'NCM', term: cleanTargetNcm };
    }
  }

  // 3. Valida Palavras-chave semânticas (ordena da maior para a menor para casar termos mais específicos primeiro)
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  for (const kw of sortedKeywords) {
    const cleanKw = kw.toLowerCase().trim();
    if (cleanKw.length >= 3 && normalizedDesc.includes(cleanKw)) {
      return { matches: true, type: 'KEYWORD', term: cleanKw };
    }
  }

  return { matches: false };
}

/**
 * Consulta a API de Dados Abertos do Compras.gov.br (que espelha dados da 14.133 do PNCP)
 */
export async function fetchComprasDadosAbertosPncp(
  startDateIso: string, // YYYY-MM-DD
  endDateIso: string, // YYYY-MM-DD
  modalidade: number,
  page: number = 1,
  pageSize: number = 50,
  timeoutMs: number = 15000
): Promise<{ items: any[]; total: number; totalPages: number }> {
  const url = new URL(COMPRAS_DADOS_ABERTOS_PNCP_URL);
  url.searchParams.set('dataPublicacaoPncpInicial', startDateIso);
  url.searchParams.set('dataPublicacaoPncpFinal', endDateIso);
  url.searchParams.set('codigoModalidade', String(modalidade));
  url.searchParams.set('pagina', String(page));
  url.searchParams.set('tamanhoPagina', String(pageSize));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Monitor-Licitacao-Historical-Worker/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} em Compras.gov.br: ${errText.slice(0, 150)}`);
  }

  const data = (await response.json()) as any;
  return {
    items: data?.resultado || [],
    total: data?.totalRegistros || 0,
    totalPages: data?.totalPaginas || 1,
  };
}

/**
 * Consulta a API direta do PNCP (com fallback e timeout estrito)
 */
export async function fetchPncpDirect(
  startDateIso: string, // YYYY-MM-DD
  endDateIso: string, // YYYY-MM-DD
  modalidade: number,
  page: number = 1,
  pageSize: number = 50,
  dispatcher?: any,
  timeoutMs: number = 6000
): Promise<{ items: any[]; total: number }> {
  const dataInicial = startDateIso.replace(/-/g, '');
  const dataFinal = endDateIso.replace(/-/g, '');

  const url = new URL(PNCP_DIRECT_URL);
  url.searchParams.set('dataInicial', dataInicial);
  url.searchParams.set('dataFinal', dataFinal);
  url.searchParams.set('codigoModalidadeContratacao', String(modalidade));
  url.searchParams.set('pagina', String(page));
  url.searchParams.set('tamanhoPagina', String(pageSize));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Monitor-Licitacao-Historical-Worker/1.0',
    },
    ...(dispatcher ? { dispatcher } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em PNCP direto`);
  }

  const data = (await response.json()) as any;
  return {
    items: data?.data || [],
    total: data?.totalRegistros || 0,
  };
}

/**
 * Normaliza um item vindo de qualquer uma das fontes públicas para o formato canônico interno
 */
export function normalizeRawProcurementItem(
  item: any,
  sourceOrigin: 'PNCP_DIRECT' | 'COMPRAS_DADOS_ABERTOS'
): {
  id: string;
  processNumber: string;
  title: string;
  agency: string;
  ncmCode: string;
  objectDescription: string;
  url: string;
  rawUrl: string;
  estimatedValue: number | null;
  publishedAt: Date;
  biddingDate: Date;
} {
  if (sourceOrigin === 'COMPRAS_DADOS_ABERTOS') {
    const agency =
      item.orgaoEntidadeRazaoSocial ||
      item.unidadeOrgaoNomeUnidade ||
      `Órgão CNPJ ${item.orgaoEntidadeCnpj || 'Desconhecido'}`;

    const fallbackDeterministicKey = [
      item.processo,
      item.numeroCompra,
      item.objetoCompra,
      item.dataPublicacaoPncp,
      item.dataInclusaoPncp,
      item.orgaoEntidadeCnpj,
      item.orgaoEntidadeRazaoSocial,
    ]
      .filter(Boolean)
      .join('|');
    const fallbackDeterministicId = createHash('sha256')
      .update(fallbackDeterministicKey || 'sem-identificador-compras')
      .digest('hex')
      .slice(0, 24);

    const rawId = `hist-compras-${item.idCompra || item.numeroControlePNCP || fallbackDeterministicId}`;
    const uniqueId = rawId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const pubDateStr = item.dataPublicacaoPncp || item.dataInclusaoPncp;
    const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
    const bidDateStr = item.dataAberturaPropostaPncp || pubDateStr;
    const bidDate = bidDateStr ? new Date(bidDateStr) : pubDate;

    const val = item.valorTotalEstimado != null ? Number(item.valorTotalEstimado) : null;

    return {
      id: uniqueId,
      processNumber: item.processo || item.numeroCompra || item.numeroControlePNCP || uniqueId,
      title: (item.objetoCompra || 'Contratação Pública').slice(0, 100),
      agency,
      ncmCode: item.codigoNcm || item.codigoNCM || '9506.91.00',
      objectDescription: item.objetoCompra || '',
      url:
        item.linkSistemaOrigem ||
        (item.numeroControlePNCP
          ? `https://pncp.gov.br/app/editais/${encodeURIComponent(item.numeroControlePNCP)}`
          : 'https://compras.gov.br'),
      rawUrl: COMPRAS_DADOS_ABERTOS_PNCP_URL,
      estimatedValue: val != null && !isNaN(val) ? val : null,
      publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
      biddingDate: isNaN(bidDate.getTime()) ? new Date() : bidDate,
    };
  } else {
    // PNCP direto
    const agency = item.orgaoEntidade?.razaoSocial || item.razaoSocial || 'Órgão Desconhecido';
    const uniqueId = `hist-pncp-${item.anoContratacao}-${item.numeroContratacao}-${item.orgaoEntidade?.cnpj || 's-cnpj'}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    const pubDate = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp) : new Date();
    const bidDate = item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : pubDate;
    const val = item.valorTotalEstimado != null ? Number(item.valorTotalEstimado) : null;

    return {
      id: uniqueId,
      processNumber: item.processo || `${item.numeroContratacao}/${item.anoContratacao}`,
      title: (item.objetoCompra || item.objeto || 'Edital PNCP').slice(0, 100),
      agency,
      ncmCode: item.codigoNcm || '9506.91.00',
      objectDescription: item.objetoCompra || item.objeto || '',
      url: item.linkSistemaOrigem || PNCP_DIRECT_URL,
      rawUrl: PNCP_DIRECT_URL,
      estimatedValue: val != null && !isNaN(val) ? val : null,
      publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
      biddingDate: isNaN(bidDate.getTime()) ? new Date() : bidDate,
    };
  }
}

/**
 * Singleton/Map em memória para rastreamento de jobs de extração histórica por tenant
 */
export const activeHistoricalJobs = new Map<string, HistoricalExtractionProgress>();

/**
 * Reuses the Map entry created by POST /start so status/cancel mutate the same object
 * the worker reads. Mint a jobId only when the caller did not supply one.
 */
export function bindHistoricalJob(
  options: Pick<HistoricalExtractionOptions, 'tenantId' | 'jobId' | 'startDate' | 'endDate' | 'chunkDays' | 'sourcePreference'>
): HistoricalExtractionProgress {
  const jobId = options.jobId || `job-${options.tenantId}-${Date.now()}`;
  const existing = activeHistoricalJobs.get(jobId);
  if (existing) return existing;

  const chunks = generateDateChunks(options.startDate, options.endDate, options.chunkDays || 15);
  const progress: HistoricalExtractionProgress = {
    jobId,
    tenantId: options.tenantId,
    status: 'RUNNING',
    currentChunkIndex: 0,
    totalChunks: chunks.length,
    currentStartDate: chunks[0]?.start || options.startDate,
    currentEndDate: chunks[0]?.end || options.endDate,
    pagesProcessed: 0,
    itemsExamined: 0,
    matchedItemsCount: 0,
    totalEstimatedValue: 0,
    newEditaisInserted: 0,
    sourceUsed: options.sourcePreference || 'AUTO',
    startedAt: new Date().toISOString(),
  };
  activeHistoricalJobs.set(jobId, progress);
  return progress;
}

export function isHistoricalJobCancelled(
  progress: Pick<HistoricalExtractionProgress, 'status'>
): boolean {
  return progress.status === 'CANCELLED';
}

export function countSuccessfulInserts(
  returningRows: Array<{ id?: string }> | null | undefined
): number {
  return Array.isArray(returningRows) ? returningRows.length : 0;
}

/**
 * Executa a orquestração histórica completa fatiada para um determinado Tenant
 */
export async function executeHistoricalExtraction(
  options: HistoricalExtractionOptions,
  onProgress?: (progress: HistoricalExtractionProgress) => void
): Promise<HistoricalExtractionProgress> {
  const targetNcm = options.ncmCode || '9506.91.00';
  const modalidades = options.modalidades && options.modalidades.length > 0 ? options.modalidades : [6, 5, 4, 8];
  const chunkDays = options.chunkDays || 15;
  const delayMs = options.delayMs || 400;
  const keywords = options.keywords && options.keywords.length > 0 ? options.keywords : DEFAULT_FITNESS_KEYWORDS;

  const chunks = generateDateChunks(options.startDate, options.endDate, chunkDays);
  const progress = bindHistoricalJob(options);
  if (isHistoricalJobCancelled(progress)) {
    return progress;
  }
  progress.status = 'RUNNING';
  if (onProgress) onProgress(progress);

  // Conexão com o banco Neon
  const connectionString = process.env.DATABASE_URL;
  let dbClient: any = null;
  let db: any = null;

  if (connectionString) {
    try {
      dbClient = postgres(connectionString);
      db = drizzle(dbClient, { schema });
    } catch (e: any) {
      console.warn(`[Historical Worker] Aviso: banco não conectado diretamente: ${e.message}`);
    }
  }

  // Certificado mTLS se configurado no tenant
  let dispatcher: any;
  if (db) {
    try {
      const tenantConfigs = await db
        .select()
        .from(schema.tenantConfigs)
        .where(eq(schema.tenantConfigs.tenantId, options.tenantId));
      const pConfig = tenantConfigs[0]?.pncpConfig;
      if (pConfig?.isActive && pConfig?.certificatePath && fs.existsSync(pConfig.certificatePath)) {
        try {
          const { Agent } = await import('undici');
          const certData = fs.readFileSync(pConfig.certificatePath);
          dispatcher = new Agent({
            connect: {
              pfx: certData,
              passphrase: decryptSecret(pConfig.certificatePassword || ''),
              rejectUnauthorized: true,
            },
          });
        } catch (undiciErr: any) {
          console.warn(`[Historical Worker] Undici indisponível para mTLS: ${undiciErr.message}`);
        }
      }
    } catch (certErr: any) {
      console.warn(`[Historical Worker] Certificado mTLS não carregado: ${certErr.message}`);
    }
  }

  const sourceId = 'src-pncp-api-01';

  try {
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      if (isHistoricalJobCancelled(progress)) break;

      const chunk = chunks[cIdx];
      progress.currentChunkIndex = cIdx + 1;
      progress.currentStartDate = chunk.start;
      progress.currentEndDate = chunk.end;
      if (onProgress) onProgress(progress);

      for (const modalidade of modalidades) {
        if (isHistoricalJobCancelled(progress)) break;

        let page = 1;
        let keepPaging = true;
        const maxPagesPerModalidade = 10; // Limite de segurança por modalidade/fatia

        while (keepPaging && page <= maxPagesPerModalidade) {
          let items: any[] = [];
          let sourceUsedNow: 'PNCP_DIRECT' | 'COMPRAS_DADOS_ABERTOS' = 'COMPRAS_DADOS_ABERTOS';

          // Tenta PNCP direto primeiro se preferido
          if (options.sourcePreference === 'PNCP_DIRECT') {
            try {
              const res = await fetchPncpDirect(chunk.start, chunk.end, modalidade, page, 50, dispatcher, 4000);
              items = res.items;
              sourceUsedNow = 'PNCP_DIRECT';
            } catch (pncpErr) {
              // Fallback para Compras Dados Abertos
              const res = await fetchComprasDadosAbertosPncp(chunk.start, chunk.end, modalidade, page, 50);
              items = res.items;
              sourceUsedNow = 'COMPRAS_DADOS_ABERTOS';
            }
          } else {
            // Padrão: Compras Dados Abertos (altamente estável)
            try {
              const res = await fetchComprasDadosAbertosPncp(chunk.start, chunk.end, modalidade, page, 50);
              items = res.items;
              sourceUsedNow = 'COMPRAS_DADOS_ABERTOS';
            } catch (comprasErr) {
              // Fallback para PNCP direto
              try {
                const res = await fetchPncpDirect(chunk.start, chunk.end, modalidade, page, 50, dispatcher, 5000);
                items = res.items;
                sourceUsedNow = 'PNCP_DIRECT';
              } catch (bothErr: any) {
                console.warn(`[Historical Worker] Erro em ambas as fontes para ${chunk.start}-${chunk.end}: ${bothErr.message}`);
                break;
              }
            }
          }

          progress.sourceUsed = sourceUsedNow;
          progress.pagesProcessed++;

          if (!items || items.length === 0) {
            keepPaging = false;
            break;
          }

          progress.itemsExamined += items.length;

          for (const rawItem of items) {
            const normalized = normalizeRawProcurementItem(rawItem, sourceUsedNow);
            const matchEval = evaluateItemMatch(
              normalized.ncmCode,
              normalized.objectDescription,
              targetNcm,
              keywords
            );

            if (matchEval.matches) {
              progress.matchedItemsCount++;
              if (normalized.estimatedValue != null) {
                progress.totalEstimatedValue += normalized.estimatedValue;
              }

              // Persistência idempotente
              if (db) {
                try {
                  const inserted = await db
                    .insert(schema.editais)
                    .values({
                      id: normalized.id,
                      tenantId: options.tenantId,
                      sourceId,
                      processNumber: normalized.processNumber,
                      title: normalized.title,
                      sourceName:
                        sourceUsedNow === 'PNCP_DIRECT'
                          ? 'PNCP (Portal Nacional)'
                          : 'Compras.gov.br Dados Abertos (PNCP 14.133)',
                      sourceCategory: 'Federal',
                      ncmCode: normalized.ncmCode,
                      objectDescription: normalized.objectDescription,
                      url: normalized.url,
                      rawUrl: normalized.rawUrl,
                      status: 'OPEN',
                      agency: normalized.agency,
                      estimatedValue:
                        normalized.estimatedValue != null ? String(normalized.estimatedValue) : null,
                      publishedAt: normalized.publishedAt,
                      biddingDate: normalized.biddingDate,
                      humanReviewStatus: 'PENDING',
                    })
                    .onConflictDoNothing()
                    .returning({ id: schema.editais.id });

                  progress.newEditaisInserted += countSuccessfulInserts(inserted);
                } catch (dbErr: any) {
                  // Conflito ou erro de chave ignorado
                }
              }
            }
          }

          page++;
          if (onProgress) onProgress(progress);

          // Rate limit delay suave
          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
    }

    if (!isHistoricalJobCancelled(progress)) {
      progress.status = 'COMPLETED';
      progress.finishedAt = new Date().toISOString();
    }
  } catch (fatalErr: any) {
    if (!isHistoricalJobCancelled(progress)) {
      progress.status = 'FAILED';
      progress.error = fatalErr.message;
      progress.finishedAt = new Date().toISOString();
    }
  } finally {
    if (dbClient) {
      await dbClient.end({ timeout: 5 }).catch(() => {});
    }
    if (onProgress) onProgress(progress);
  }

  return progress;
}
