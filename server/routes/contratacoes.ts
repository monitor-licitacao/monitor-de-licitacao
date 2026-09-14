/**
 * Rotas /api/contratacoes — Fase E (issue #79).
 */
import { Router, type Request, type Response } from 'express';
import {
  getContratacaoDetail,
  getContratacaoEnrichment,
  listContratacoes,
} from '../lib/compras-gov/enrichment-api.js';

export const contratacoesRouter = Router();

contratacoesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const limit = Math.min(Number.parseInt(String(_req.query.limit ?? '50'), 10) || 50, 100);
    const items = await listContratacoes(limit);
    res.set('Cache-Control', 'no-store');
    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Contratacoes List Error]:', err);
    return res.status(500).json({ error: 'Erro ao listar contratações.' });
  }
});

contratacoesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const detail = await getContratacaoDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: 'Contratação não encontrada.' });
    }
    res.set('Cache-Control', 'no-store');
    return res.json(detail);
  } catch (err) {
    console.error('[Contratacoes Detail Error]:', err);
    return res.status(500).json({ error: 'Erro ao carregar contratação.' });
  }
});

contratacoesRouter.get('/:id/enriquecimento', async (req: Request, res: Response) => {
  try {
    const enrichment = await getContratacaoEnrichment(req.params.id);
    if (!enrichment) {
      return res.status(404).json({ error: 'Contratação não encontrada.' });
    }
    return res.json(enrichment);
  } catch (err) {
    console.error('[Contratacoes Enrichment Error]:', err);
    return res.status(500).json({ error: 'Erro ao carregar enriquecimento.' });
  }
});
