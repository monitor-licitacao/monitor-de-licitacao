/**
 * Rotas /api/v1/domains — Domain Registry PNCP (issue #81).
 */
import { Router, type Request, type Response } from 'express';
import {
  getAmparoById,
  listAmparos,
  listInstrumentos,
  listModalidades,
  parseStatusAtivo,
} from '../lib/pncp/domains/api.js';
import { runSyncPncpDomains } from '../lib/pncp/domains/jobs.js';

export const domainsRouter = Router();

domainsRouter.get('/modalidades', async (req: Request, res: Response) => {
  try {
    const items = await listModalidades({
      statusAtivo: parseStatusAtivo(req.query.status_ativo),
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Domains Modalidades Error]:', err);
    return res.status(500).json({ error: 'Erro ao listar modalidades PNCP.' });
  }
});

domainsRouter.get('/instrumentos-convocatorios', async (req: Request, res: Response) => {
  try {
    const items = await listInstrumentos({
      statusAtivo: parseStatusAtivo(req.query.status_ativo),
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Domains Instrumentos Error]:', err);
    return res.status(500).json({ error: 'Erro ao listar instrumentos convocatórios PNCP.' });
  }
});

domainsRouter.get('/amparos-legais', async (req: Request, res: Response) => {
  try {
    const tipoRaw = req.query.tipo;
    const tipo = typeof tipoRaw === 'string' && tipoRaw !== '' ? Number.parseInt(tipoRaw, 10) : undefined;
    const items = await listAmparos({
      statusAtivo: parseStatusAtivo(req.query.status_ativo),
      tipo: Number.isFinite(tipo) ? tipo : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Domains Amparos Error]:', err);
    return res.status(500).json({ error: 'Erro ao listar amparos legais PNCP.' });
  }
});

domainsRouter.get('/amparos-legais/:id', async (req: Request, res: Response) => {
  try {
    const item = await getAmparoById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Amparo legal não encontrado.' });
    return res.json(item);
  } catch (err) {
    console.error('[Domains Amparo Detail Error]:', err);
    return res.status(500).json({ error: 'Erro ao carregar amparo legal PNCP.' });
  }
});

domainsRouter.post('/sync', async (_req: Request, res: Response) => {
  try {
    const result = await runSyncPncpDomains();
    return res.status(result.ok ? 200 : 207).json(result);
  } catch (err) {
    console.error('[Domains Sync Error]:', err);
    return res.status(500).json({ error: 'Erro ao sincronizar domínios PNCP.' });
  }
});
