import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { getAuthenticatedTenantId, validateTenantAccess } from '../lib/tenantAuth.js';
import {
  executeHistoricalExtraction,
  activeHistoricalJobs,
  generateDateChunks,
  DEFAULT_FITNESS_KEYWORDS,
  DEFAULT_FITNESS_NEGATIVE_KEYWORDS,
  type HistoricalExtractionProgress,
} from '../workers/historical_pncp_extractor.js';

export const historicalRouter = Router();

/**
 * POST /api/historical-extractor/start
 * Inicia ou agenda um trabalho de extração histórica em background para o tenant autenticado.
 */
historicalRouter.post('/start', async (req: Request, res: Response) => {
  const tenantId = getAuthenticatedTenantId(req, res);
  if (tenantId === null) return;

  if (!validateTenantAccess(req, res, tenantId)) return;

  const {
    startDate,
    endDate,
    ncmCode = '9506.91.00',
    keywords,
    modalidades = [6, 5, 4, 8],
    chunkDays = 15,
    sourcePreference = 'AUTO',
  } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'Parâmetros "startDate" e "endDate" são obrigatórios no formato YYYY-MM-DD.',
    });
  }

  try {
    generateDateChunks(startDate, endDate, chunkDays);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  // Verifica se já existe um job em execução para este tenant
  const existingJob = Array.from(activeHistoricalJobs.values()).find(
    (j) => j.tenantId === tenantId && j.status === 'RUNNING'
  );

  if (existingJob) {
    return res.status(409).json({
      message: 'Já existe uma extração histórica em andamento para este tenant.',
      job: existingJob,
    });
  }

  const chunks = generateDateChunks(startDate, endDate, chunkDays);
  const initialJobId = `job-${tenantId}-${Date.now()}`;
  const initialProgress: HistoricalExtractionProgress = {
    jobId: initialJobId,
    tenantId,
    status: 'RUNNING',
    currentChunkIndex: 0,
    totalChunks: chunks.length,
    currentStartDate: chunks[0]?.start || startDate,
    currentEndDate: chunks[0]?.end || endDate,
    pagesProcessed: 0,
    itemsExamined: 0,
    matchedItemsCount: 0,
    totalEstimatedValue: 0,
    newEditaisInserted: 0,
    sourceUsed: sourcePreference,
    startedAt: new Date().toISOString(),
  };

  activeHistoricalJobs.set(initialJobId, initialProgress);

  // Executa em background de forma assíncrona
  executeHistoricalExtraction({
    tenantId,
    startDate,
    endDate,
    ncmCode,
    keywords,
    modalidades,
    chunkDays,
    sourcePreference,
  }).catch((err) => {
    console.error(`[Historical Worker Error]: ${err.message}`);
  });

  return res.status(202).json({
    message: 'Processamento de extração histórica iniciado com sucesso.',
    job: initialProgress,
    totalChunks: chunks.length,
    chunksPlanned: chunks,
  });
});

/**
 * GET /api/historical-extractor/status
 * Consulta o status do job atual ou mais recente de extração histórica do tenant.
 */
historicalRouter.get('/status', (req: Request, res: Response) => {
  const tenantId = getAuthenticatedTenantId(req, res);
  if (tenantId === null) return;

  if (!validateTenantAccess(req, res, tenantId)) return;

  const tenantJobs = Array.from(activeHistoricalJobs.values())
    .filter((j) => j.tenantId === tenantId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));

  if (tenantJobs.length === 0) {
    return res.json({
      status: 'IDLE',
      message: 'Nenhum job de extração histórica encontrado para este tenant.',
    });
  }

  const latestJob = tenantJobs[0];
  return res.json(latestJob);
});

/**
 * POST /api/historical-extractor/cancel
 * Cancela um job em execução
 */
historicalRouter.post('/cancel', (req: Request, res: Response) => {
  const tenantId = getAuthenticatedTenantId(req, res);
  if (tenantId === null) return;

  if (!validateTenantAccess(req, res, tenantId)) return;

  const runningJob = Array.from(activeHistoricalJobs.values()).find(
    (j) => j.tenantId === tenantId && j.status === 'RUNNING'
  );

  if (!runningJob) {
    return res.status(404).json({ error: 'Nenhum job em execução para cancelar.' });
  }

  runningJob.status = 'CANCELLED';
  runningJob.finishedAt = new Date().toISOString();

  return res.json({ message: 'Job cancelado com sucesso.', job: runningJob });
});

/**
 * GET /api/historical-extractor/budget-analytics
 * Retorna dados analíticos consolidados de editais históricos e orçamentos estimados por trimestre/órgão.
 */
historicalRouter.get('/budget-analytics', async (req: Request, res: Response) => {
  const tenantId = getAuthenticatedTenantId(req, res);
  if (tenantId === null) return;

  if (!validateTenantAccess(req, res, tenantId)) return;

  try {
    // 1. Busca editais do tenant ordenados por data de publicação
    const editaisData = await db
      .select({
        id: schema.editais.id,
        title: schema.editais.title,
        agency: schema.editais.agency,
        ncmCode: schema.editais.ncmCode,
        estimatedValue: schema.editais.estimatedValue,
        publishedAt: schema.editais.publishedAt,
        biddingDate: schema.editais.biddingDate,
        sourceName: schema.editais.sourceName,
      })
      .from(schema.editais)
      .where(eq(schema.editais.tenantId, tenantId))
      .orderBy(desc(schema.editais.publishedAt));

    let totalBudget = 0;
    let editaisWithBudgetCount = 0;
    const agencyAggregations: Record<string, { count: number; totalValue: number }> = {};
    const quarterlyAggregations: Record<string, { count: number; totalValue: number }> = {};

    for (const ed of editaisData) {
      const val = ed.estimatedValue ? parseFloat(ed.estimatedValue) : 0;
      if (val > 0) {
        totalBudget += val;
        editaisWithBudgetCount++;
      }

      // Agregação por Órgão
      const agencyName = ed.agency || 'Órgão Não Informado';
      if (!agencyAggregations[agencyName]) {
        agencyAggregations[agencyName] = { count: 0, totalValue: 0 };
      }
      agencyAggregations[agencyName].count++;
      agencyAggregations[agencyName].totalValue += val;

      // Agregação por Trimestre / Ano (Ex: 2024-Q1)
      if (ed.publishedAt) {
        const pubDate = new Date(ed.publishedAt);
        const year = pubDate.getFullYear();
        const quarter = Math.floor(pubDate.getMonth() / 3) + 1;
        const quarterKey = `${year}-Q${quarter}`;

        if (!quarterlyAggregations[quarterKey]) {
          quarterlyAggregations[quarterKey] = { count: 0, totalValue: 0 };
        }
        quarterlyAggregations[quarterKey].count++;
        quarterlyAggregations[quarterKey].totalValue += val;
      }
    }

    const topAgencies = Object.entries(agencyAggregations)
      .map(([agency, data]) => ({
        agency,
        totalEditais: data.count,
        totalBudget: data.totalValue,
        averageTicket: data.count > 0 ? data.totalValue / data.count : 0,
      }))
      .sort((a, b) => b.totalBudget - a.totalBudget)
      .slice(0, 10);

    const quarterlyTrends = Object.entries(quarterlyAggregations)
      .map(([quarter, data]) => ({
        quarter,
        totalEditais: data.count,
        totalBudget: data.totalValue,
        averageTicket: data.count > 0 ? data.totalValue / data.count : 0,
      }))
      .sort((a, b) => a.quarter.localeCompare(b.quarter));

    const averageTicketOverall =
      editaisWithBudgetCount > 0 ? totalBudget / editaisWithBudgetCount : 0;

    return res.json({
      summary: {
        totalEditaisExamined: editaisData.length,
        totalEditaisWithBudget: editaisWithBudgetCount,
        totalEstimatedBudget: totalBudget,
        averageTicket: averageTicketOverall,
      },
      topAgencies,
      quarterlyTrends,
      sampleEditais: editaisData.slice(0, 15),
    });
  } catch (err: any) {
    console.error('[Budget Analytics Error]:', err);
    return res.status(500).json({ error: 'Erro ao calcular analítica de orçamentos históricos.' });
  }
});
