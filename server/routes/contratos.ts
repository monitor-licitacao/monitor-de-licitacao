/**
 * Rotas /api/contratos — Painel de Contratos (Licinexus clone).
 */
import { Router, type Request, type Response } from 'express';
import { getAuthenticatedTenantId } from '../lib/tenantAuth.js';
import { listManualContractSources } from '../lib/contratos/manual-sources.js';
import { resolveOrgaoCnpj } from '../lib/contratos/orgao-registry.js';
import {
  analyzeContractRow,
  backfillContractFromContratacao,
  getDashboard,
  getTenantContractById,
  insertManualContract,
  listContractsPaginated,
  loadContractItems,
  searchCatalog,
  syncLinkedContracts,
} from '../lib/contratos/persist.js';
import { listUnidades } from '../lib/contratos/unidades.js';
import {
  applyReajuste,
  computeReajusteFactor,
  getIndiceSerieOrFixture,
  type IndiceCodigo,
} from '../lib/contratos/reajuste.js';
import {
  createOficio,
  getOficioById,
  listOficios,
  patchContractReajuste,
  renderOficioPdf,
  sendOficioEmail,
  updateOficio,
} from '../lib/contratos/oficios.js';
import { syncPncpContractsForTenant } from '../lib/contratos/pncp-sync.js';
import type { HealthStatus, ListContractsQuery, ManualContractInput } from '../lib/contratos/types.js';

export const contratosRouter = Router();

function ok<T>(res: Response, data: T) {
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, data });
}

function tenantOrFail(req: Request, res: Response): number | null {
  return getAuthenticatedTenantId(req, res);
}

contratosRouter.get('/unidades', (_req, res) => {
  return ok(res, listUnidades());
});

contratosRouter.get('/dashboard', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const data = await getDashboard(tenantId);
    return ok(res, data);
  } catch (err) {
    console.error('[Contratos Dashboard]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar dashboard de contratos.' });
  }
});

contratosRouter.get('/', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const query: ListContractsQuery = {
      page: Number.parseInt(String(req.query.page ?? '1'), 10) || 1,
      limit: Number.parseInt(String(req.query.limit ?? '20'), 10) || 20,
      status: (req.query.status as HealthStatus | undefined) ?? '',
      orderBy: (req.query.orderBy as ListContractsQuery['orderBy']) ?? 'health_score',
      vencimento: req.query.vencimento as 'vencendo' | 'vencido' | undefined,
      tipo: req.query.tipo as 'contrato' | 'ata' | undefined,
      fornecedorCnpj: req.query.fornecedor_cnpj as string | undefined,
    };
    const result = await listContractsPaginated(tenantId, query);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Contratos List]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar contratos.' });
  }
});

contratosRouter.get('/catalogo', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const q = String(req.query.q ?? '');
    const data = await searchCatalog(q);
    return ok(res, data);
  } catch (err) {
    console.error('[Contratos Catalogo]:', err);
    return res.status(500).json({ success: false, error: 'Erro na busca de catálogo.' });
  }
});

contratosRouter.get('/manual/sources', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? '100'), 10) || 100, 200);
    const pinId = typeof req.query.contratacaoId === 'string' ? req.query.contratacaoId : undefined;
    const contratacoes = await listManualContractSources(limit, pinId);
    return ok(res, { contratacoes });
  } catch (err) {
    console.error('[Contratos Manual Sources]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar contratações para cadastro.' });
  }
});

contratosRouter.get('/cnpj/:cnpj', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const data = await resolveOrgaoCnpj(req.params.cnpj);
    if (!data) {
      return res.status(404).json({ success: false, error: 'CNPJ não encontrado.' });
    }
    return ok(res, data);
  } catch (err) {
    console.error('[Contratos CNPJ]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao consultar CNPJ.' });
  }
});

contratosRouter.post('/manual', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const raw = req.body as ManualContractInput;
    const body: ManualContractInput = {
      ...raw,
      contratacao_id: typeof raw.contratacao_id === 'string' ? raw.contratacao_id.trim() : undefined,
      numero_contrato_empenho:
        typeof raw.numero_contrato_empenho === 'string'
          ? raw.numero_contrato_empenho.trim()
          : undefined,
    };
    const id = await insertManualContract(tenantId, body);
    return ok(res, { id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao criar contrato.';
    return res.status(400).json({ success: false, error: message });
  }
});

contratosRouter.post('/sync', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const result = await syncPncpContractsForTenant({ tenantId });
    return ok(res, result);
  } catch (err) {
    console.error('[Contratos Sync]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar contratos PNCP.' });
  }
});

contratosRouter.get('/indices/:codigo', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  const codigo = req.params.codigo.toLowerCase() as IndiceCodigo;
  if (codigo !== 'ipca' && codigo !== 'igpm') {
    return res.status(400).json({ success: false, error: 'Índice inválido. Use ipca ou igpm.' });
  }
  try {
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
    const serie = await getIndiceSerieOrFixture(codigo, desde);
    return ok(res, serie);
  } catch (err) {
    console.error('[Contratos Indices]:', err);
    return res.status(502).json({ success: false, error: 'Erro ao consultar índice.' });
  }
});

contratosRouter.get('/oficios/:oficioId/pdf', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const oficio = await getOficioById(req.params.oficioId);
    if (!oficio) return res.status(404).json({ success: false, error: 'Ofício não encontrado.' });
    const contract = await getTenantContractById(tenantId, oficio.tenant_contract_id);
    if (!contract) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    const pdf = renderOficioPdf(oficio.assunto, oficio.corpo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="oficio-${oficio.id.slice(0, 8)}.pdf"`);
    res.setHeader('X-Oficio-Assinado', '0');
    return res.send(pdf);
  } catch (err) {
    console.error('[Contratos Oficio PDF]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao gerar PDF.' });
  }
});

contratosRouter.post('/oficios/:oficioId/enviar', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const oficio = await getOficioById(req.params.oficioId);
    if (!oficio) return res.status(404).json({ success: false, error: 'Ofício não encontrado.' });
    const contract = await getTenantContractById(tenantId, oficio.tenant_contract_id);
    if (!contract) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });

    const emailOrgao = String(req.body?.email_orgao ?? '').trim();
    if (!emailOrgao) {
      return res.status(400).json({ success: false, error: 'email_orgao é obrigatório.' });
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Envio por e-mail indisponível (RESEND_API_KEY não configurada). PDF disponível para download.',
      });
    }
    const sent = await sendOficioEmail({
      oficio,
      emailOrgao,
      emailCliente: req.body?.email_cliente ? String(req.body.email_cliente) : undefined,
    });
    if (!sent.ok) {
      return res.status(502).json({ success: false, error: sent.error ?? 'Falha no envio.' });
    }
    return ok(res, { enviado: true });
  } catch (err) {
    console.error('[Contratos Oficio Enviar]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao enviar ofício.' });
  }
});

contratosRouter.patch('/oficios/:oficioId', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const oficio = await getOficioById(req.params.oficioId);
    if (!oficio) return res.status(404).json({ success: false, error: 'Ofício não encontrado.' });
    const contract = await getTenantContractById(tenantId, oficio.tenant_contract_id);
    if (!contract) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    const updated = await updateOficio(req.params.oficioId, {
      assunto: req.body?.assunto,
      corpo: req.body?.corpo,
      status: req.body?.status,
    });
    return ok(res, updated);
  } catch (err) {
    console.error('[Contratos Oficio Patch]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar ofício.' });
  }
});

contratosRouter.get('/:id', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    let row = await getTenantContractById(tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    await backfillContractFromContratacao(row.id);
    row = (await getTenantContractById(tenantId, req.params.id)) ?? row;
    const [analysis, itens, oficios] = await Promise.all([
      analyzeContractRow(row, tenantId),
      loadContractItems(row.id),
      listOficios(row.id),
    ]);
    return ok(res, { ...analysis, itens, oficios });
  } catch (err) {
    console.error('[Contratos Detail]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar contrato.' });
  }
});

contratosRouter.post('/:id/sync-contratacao', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const row = await getTenantContractById(tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    if (!row.contratacao_id) {
      return res.status(400).json({ success: false, error: 'Contrato sem contratação vinculada.' });
    }
    const updated = await syncLinkedContracts(row.contratacao_id);
    await backfillContractFromContratacao(row.id);
    const fresh = await getTenantContractById(tenantId, req.params.id);
    const analysis = fresh ? await analyzeContractRow(fresh, tenantId) : null;
    return ok(res, { updated, analysis });
  } catch (err) {
    console.error('[Contratos Sync Contratacao]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar contrato com contratação.' });
  }
});

contratosRouter.patch('/:id/reajuste', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const row = await getTenantContractById(tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });

    const indice = String(req.body?.indice ?? 'ipca').toLowerCase() as IndiceCodigo;
    const dataBase = String(req.body?.data_base ?? row.data_vigencia_inicio ?? '').slice(0, 10);
    if (!dataBase) {
      return res.status(400).json({ success: false, error: 'data_base ou vigência inicial necessários.' });
    }
    const valorBase = Number(row.valor_global ?? 0);
    if (valorBase <= 0) {
      return res.status(400).json({ success: false, error: 'Contrato sem valor global.' });
    }

    const serie = await getIndiceSerieOrFixture(indice, dataBase);
    const factor = computeReajusteFactor(serie);
    const valorReajustado = applyReajuste(valorBase, factor);
    const updated = await patchContractReajuste({
      tenantId,
      contractId: row.id,
      indice,
      valorReajustado,
    });
    return ok(res, updated);
  } catch (err) {
    console.error('[Contratos Reajuste]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao aplicar reajuste.' });
  }
});

contratosRouter.get('/:id/oficios', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const row = await getTenantContractById(tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    const oficios = await listOficios(row.id);
    return ok(res, oficios);
  } catch (err) {
    console.error('[Contratos Oficios List]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar ofícios.' });
  }
});

contratosRouter.post('/:id/oficios', async (req, res) => {
  const tenantId = tenantOrFail(req, res);
  if (tenantId == null) return;
  try {
    const row = await getTenantContractById(tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    const tipo = (req.body?.tipo ?? 'renovacao') as 'renovacao' | 'reajuste' | 'encerramento';
    const oficio = await createOficio({
      contractId: row.id,
      tipo,
      assunto: req.body?.assunto,
      corpo: req.body?.corpo,
      contract: row,
    });
    return ok(res, oficio);
  } catch (err) {
    console.error('[Contratos Oficios Create]:', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar ofício.' });
  }
});
