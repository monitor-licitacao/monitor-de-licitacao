import type { Express, Request, Response, RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { analyzeEditalTextWithAI, analyzeTechnicalSpecificationRestrictedAI } from '../gemini.js';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { filterKeywordsBeforeAI } from './tokenEfficiency.js';
import { recordAuditEvent } from './auditLog.js';

/**
 * Canonical AI entrypoint (Regra 9 / GEMINI.md).
 * Decision: Express-hosted proxy on /api/proxy/gemini — Cloudflare Worker
 * (licitacoes-edge) remains a generic reverse proxy, not an AI gateway.
 */
export function registerAiProxyRoutes(app: Express, aiLimiter: RequestHandler): void {
  app.post('/api/proxy/gemini/analyze-edital/:id', aiLimiter, handleAnalyzeEdital);
  app.post('/api/proxy/gemini/analyze-technical-specification', aiLimiter, handleAnalyzeTechnicalSpec);

  // Backward-compatible aliases (deprecated — prefer /api/proxy/gemini/*)
  app.post('/api/editais/:id/analyze-ai', aiLimiter, handleAnalyzeEdital);
  app.post('/api/gemini/analyze-technical-specification', aiLimiter, handleAnalyzeTechnicalSpec);
}

async function handleAnalyzeEdital(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [edital] = await db.select().from(schema.editais).where(eq(schema.editais.id, id));
    if (!edital) {
      res.status(404).json({ error: 'Edital não encontrado' });
      return;
    }

    const ocrPages: Array<{ pageNumber?: number; text?: string }> = edital.ocrPages ?? [];
    const fullText = ocrPages
      .map((page) => `[PÁGINA ${page.pageNumber}]\n${page.text ?? ''}`)
      .join('\n\n');
    const filteredText = filterKeywordsBeforeAI(fullText, ['ncm', '9506', 'cultura física', 'esporte']);

    const analysis = await analyzeEditalTextWithAI(filteredText, edital.title, id);

    await recordAuditEvent({
      tenantId: req.user?.tenantId ?? edital.tenantId,
      action: 'ai.analyze_edital',
      actorUserId: req.user?.id,
      resourceType: 'edital',
      resourceId: id,
      ipAddress: req.ip,
      metadata: { route: '/api/proxy/gemini/analyze-edital' },
    });

    res.json(analysis);
  } catch {
    res.status(500).json({ error: 'Erro ao analisar com IA.' });
  }
}

async function handleAnalyzeTechnicalSpec(req: Request, res: Response): Promise<void> {
  try {
    const { clauseText, editalTitle, entityName, processNumber } = req.body;
    if (!clauseText || typeof clauseText !== 'string') {
      res.status(400).json({ error: 'Texto da especificação técnica é obrigatório.' });
      return;
    }

    const filteredClause = filterKeywordsBeforeAI(clauseText, ['marca', 'modelo', 'especificação', 'certificação']);
    const result = await analyzeTechnicalSpecificationRestrictedAI(filteredClause, {
      editalTitle,
      entityName,
      processNumber,
    });

    await recordAuditEvent({
      tenantId: req.user?.tenantId ?? 1,
      action: 'ai.analyze_technical_spec',
      actorUserId: req.user?.id,
      resourceType: 'technical_spec',
      resourceId: processNumber,
      ipAddress: req.ip,
      metadata: { route: '/api/proxy/gemini/analyze-technical-specification' },
    });

    res.json(result);
  } catch (error) {
    console.error('Error analyzing technical specification:', error);
    res.status(500).json({ error: 'Erro ao processar análise técnica de especificação com IA.' });
  }
}
