/**
 * Rotas /api/pipeline — Pipeline de Participação (Licinexus /minhas-licitacoes).
 */
import { Router, type Request, type Response } from 'express';
import { getAuthenticatedTenantId } from '../lib/tenantAuth.js';
import { filterPipelineRows, computePipelineKpis, countArchived } from '../lib/pipeline/kpis.js';
import { importPipelineByPncp, resolveContratacaoForPipeline } from '../lib/pipeline/import-pncp.js';
import {
  createPipelineFromContratacaoId,
  deletePipelineItem,
  getPipelineItemById,
  listPipelineItems,
  setPipelineArchived,
  updatePipelineStatus,
} from '../lib/pipeline/persist.js';
import { mapDragToUpdate, isDragNoOp } from '../lib/pipeline/status.js';
import type { PipelineColumn, PipelineListQuery, PipelinePersistedStatus } from '../lib/pipeline/types.js';
import { PERSISTED_PIPELINE_STATUSES } from '../lib/pipeline/types.js';

export const pipelineRouter = Router();

function ok<T>(res: Response, data: T, extra: Record<string, unknown> = {}) {
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, data, ...extra });
}

function tenantOrFail(req: Request, res: Response): number | null {
  return getAuthenticatedTenantId(req, res);
}

function isPersistedStatus(value: string): value is PipelinePersistedStatus {
  return (PERSISTED_PIPELINE_STATUSES as readonly string[]).includes(value);
}

pipelineRouter.get('/', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  try {
    const query: PipelineListQuery = {
      limit: Number.parseInt(String(req.query.limit ?? '500'), 10) || 500,
      arquivadas: (req.query.arquivadas as PipelineListQuery['arquivadas']) ?? 'all',
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    };

    const result = await listPipelineItems(tenantId, query);
    const archivedCount = countArchived(result.data);
    const forKpis = filterPipelineRows(result.data, { arquivadas: '0', q: query.q });
    const kpis = computePipelineKpis(forKpis);

    let responseData = result.data;
    if (query.arquivadas !== 'all') {
      responseData = filterPipelineRows(result.data, {
        q: query.q,
        arquivadas: query.arquivadas,
      });
    } else if (query.q) {
      responseData = filterPipelineRows(result.data, { q: query.q, arquivadas: 'all' });
    }

    return ok(res, responseData, {
      kpis,
      archivedCount,
      pagination: {
        ...result.pagination,
        total: responseData.length,
      },
    });
  } catch (err) {
    console.error('[Pipeline List]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar pipeline.' });
  }
});

pipelineRouter.post('/resolver-pncp', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  const numero = String(req.body?.numero_controle_pncp ?? '').trim();
  if (!numero) {
    return res.status(400).json({ success: false, error: 'Informe o número de controle PNCP.' });
  }

  try {
    const resolved = await resolveContratacaoForPipeline(numero);
    if (resolved.found === false) {
      return res.json({ success: true, found: false, error: resolved.error });
    }
    return ok(res, {
      found: true,
      contratacao_id: resolved.contratacaoId,
      numero_controle_pncp: resolved.numeroControlePncp,
      ingested: resolved.ingested,
    });
  } catch (err) {
    console.error('[Pipeline Resolver]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao resolver PNCP.' });
  }
});

pipelineRouter.post('/', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  try {
    const contratacaoId = req.body?.contratacao_id ? String(req.body.contratacao_id) : null;
    const numeroPncp = req.body?.numero_controle_pncp ? String(req.body.numero_controle_pncp).trim() : null;

    if (contratacaoId) {
      const result = await createPipelineFromContratacaoId(tenantId, contratacaoId);
      if (result.ok) return ok(res, result.data);
      if (result.ok === false && result.code === 'DUPLICATE') {
        return res.status(409).json({
          success: false,
          error: 'Esta licitação já está no seu pipeline.',
          existingId: result.existingId,
        });
      }
      if (result.ok === false) {
        const status = result.code === 'NOT_FOUND' ? 404 : 400;
        return res.status(status).json({ success: false, error: result.error });
      }
    }

    if (numeroPncp) {
      const result = await importPipelineByPncp(tenantId, numeroPncp);
      if (result.ok) return ok(res, result.data, { ingested: result.ingested });
      if (result.ok === false && result.code === 'DUPLICATE') {
        return res.status(409).json({
          success: false,
          error: 'Esta licitação já está no seu pipeline.',
          existingId: result.existingId,
        });
      }
      if (result.ok === false) {
        const status = result.code === 'NOT_FOUND' ? 404 : 400;
        return res.status(status).json({ success: false, error: result.error });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'Informe contratacao_id ou numero_controle_pncp.',
    });
  } catch (err) {
    console.error('[Pipeline Create]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao adicionar ao pipeline.' });
  }
});

pipelineRouter.put('/:id', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  const id = String(req.params.id);
  const column = req.body?.column as PipelineColumn | undefined;
  const statusRaw = req.body?.status ? String(req.body.status) : null;
  const vencedor = req.body?.vencedor;

  try {
    const existing = await getPipelineItemById(tenantId, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Licitação não encontrada no pipeline.' });
    }

    let update: { status: PipelinePersistedStatus; vencedor: boolean } | null = null;

    if (column) {
      if (isDragNoOp(existing, column)) {
        return ok(res, existing);
      }
      update = mapDragToUpdate(column);
    } else if (statusRaw && isPersistedStatus(statusRaw)) {
      update = {
        status: statusRaw,
        vencedor: typeof vencedor === 'boolean' ? vencedor : existing.vencedor,
      };
    }

    if (!update) {
      return res.status(400).json({ success: false, error: 'Status ou coluna inválidos.' });
    }

    const data = await updatePipelineStatus(tenantId, id, update);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Licitação não encontrada no pipeline.' });
    }
    return ok(res, data);
  } catch (err) {
    console.error('[Pipeline Update]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar status.' });
  }
});

pipelineRouter.patch('/:id/arquivar', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  const id = String(req.params.id);
  const arquivada = Boolean(req.body?.arquivada);

  try {
    const data = await setPipelineArchived(tenantId, id, arquivada);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Licitação não encontrada no pipeline.' });
    }
    return ok(res, data);
  } catch (err) {
    console.error('[Pipeline Archive]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao arquivar licitação.' });
  }
});

pipelineRouter.delete('/:id', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;

  const id = String(req.params.id);
  try {
    const deleted = await deletePipelineItem(tenantId, id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Licitação não encontrada no pipeline.' });
    }
    return ok(res, { id });
  } catch (err) {
    console.error('[Pipeline Delete]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao remover licitação.' });
  }
});
