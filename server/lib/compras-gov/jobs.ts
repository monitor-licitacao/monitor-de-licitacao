/**
 * Orquestração ENRICH_COMPRAS_GOV — Fase C (issue #79).
 */
import type { ComprasGovOpenDataClient } from './client.js';
import { planEnrichment, type EnrichmentPlan } from './enrichment-policy.js';
import type {
  ComprasGovCatmatItemDto,
  ComprasGovContratacao14133Dto,
  ComprasGovPgcDetalheDto,
} from './types.js';
import {
  CG_SOURCE,
  getComprasGovSql,
  getContratacaoEnrichmentContext,
  persistCatalogItem,
  persistContratacaoIdCompra,
  persistPgcDfdBatch,
  recordSourceHealth,
  upsertEntitySnapshot,
  upsertSourceRecord,
  type ContratacaoEnrichmentContext,
} from './persist.js';

export const JOB_TYPE_ENRICH_COMPRAS_GOV = 'ENRICH_COMPRAS_GOV';

export type EnrichContratacaoPayload = {
  kind: 'contratacao';
  numeroControlePncp: string;
};

export type EnrichPgcPayload = {
  kind: 'pgc';
  orgaoCnpj: string;
  ano: number;
  maxPages?: number;
};

export type EnrichComprasGovPayload = EnrichContratacaoPayload | EnrichPgcPayload;

export type EnrichComprasGovResult = {
  ok: boolean;
  plan?: EnrichmentPlan;
  idCompra?: string | null;
  catalogPersisted?: number;
  pgcPersisted?: number;
  enrichmentPartial?: boolean;
  error?: string;
};

export type EnrichClientAdapter = {
  fetchContratacaoByPncp: (numeroControlePncp: string) => Promise<ComprasGovContratacao14133Dto | null>;
  fetchCatmat: (codigoItem: number) => Promise<ComprasGovCatmatItemDto | null>;
  fetchPgcPage: (
    orgaoCnpj: string,
    ano: number,
    pagina: number,
  ) => Promise<{ dfds: ComprasGovPgcDetalheDto[]; totalPaginas: number }>;
};

export function createClientAdapter(client: ComprasGovOpenDataClient): EnrichClientAdapter {
  return {
    async fetchContratacaoByPncp(numeroControlePncp) {
      const res = await client.fetchContratacao14133('numeroControlePNCPCompra', numeroControlePncp);
      return res.data.resultado[0] ?? null;
    },
    async fetchCatmat(codigoItem) {
      const res = await client.fetchCatmatItem(codigoItem);
      return res.data.resultado[0] ?? null;
    },
    async fetchPgcPage(orgaoCnpj, ano, pagina) {
      const res = await client.fetchPgcDetalhe(orgaoCnpj, ano, { pagina, tamanhoPagina: 50 });
      return { dfds: res.data.resultado, totalPaginas: res.data.totalPaginas };
    },
  };
}

function contextToEnrichmentInput(ctx: ContratacaoEnrichmentContext) {
  const raw = ctx.rawJson ?? {};
  return {
    mode: 'contratacao' as const,
    pncpItemCount: ctx.pncpItemCount,
    items: ctx.items,
    orcamentoSigilosoCodigo:
      typeof raw.orcamentoSigilosoCodigo === 'number' ? raw.orcamentoSigilosoCodigo : null,
    linkSistemaOrigem: ctx.urlOrigem,
  };
}

export async function runEnrichContratacao(
  numeroControlePncp: string,
  adapter: EnrichClientAdapter,
): Promise<EnrichComprasGovResult> {
  const ctx = await getContratacaoEnrichmentContext(numeroControlePncp);
  if (!ctx) {
    return { ok: false, error: `Contratação não encontrada: ${numeroControlePncp}` };
  }

  const plan = planEnrichment(contextToEnrichmentInput(ctx));

  try {
    let idCompra = ctx.idCompra;
    let cgDto: ComprasGovContratacao14133Dto | null = null;

    if (plan.fetchCgMetadata) {
      cgDto = await adapter.fetchContratacaoByPncp(numeroControlePncp);
      if (cgDto) {
        const sourceId = await upsertSourceRecord({
          source: CG_SOURCE,
          entityType: 'contratacao_14133',
          identifier: numeroControlePncp,
          sourceUrl: `cg://contratacao/${numeroControlePncp}`,
          rawPayload: cgDto,
        });
        const persisted = await persistContratacaoIdCompra(numeroControlePncp, cgDto, sourceId);
        idCompra = persisted.idCompra ?? idCompra;

        await upsertEntitySnapshot({
          entityType: 'contratacao',
          entityId: ctx.contratacaoId,
          source: CG_SOURCE,
          payload: { plan: plan.decisions, cg: cgDto, enrichmentPartial: plan.enrichmentPartial },
        });
      }
    }

    let catalogPersisted = 0;
    if (plan.fetchCatalog) {
      for (const codigo of plan.catalogCodigos) {
        const catmat = await adapter.fetchCatmat(codigo);
        if (catmat) {
          const sourceId = await upsertSourceRecord({
            source: CG_SOURCE,
            entityType: 'catmat_item',
            identifier: String(codigo),
            rawPayload: catmat,
          });
          await persistCatalogItem(catmat, sourceId);
          catalogPersisted++;
        }
      }
    }

    await recordSourceHealth(CG_SOURCE, true);

    return {
      ok: true,
      plan,
      idCompra,
      catalogPersisted,
      enrichmentPartial: plan.enrichmentPartial,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSourceHealth(CG_SOURCE, false, message).catch(() => {});
    return { ok: false, plan, error: message };
  }
}

export async function runEnrichPgc(
  orgaoCnpj: string,
  ano: number,
  adapter: EnrichClientAdapter,
  maxPages = 10,
): Promise<EnrichComprasGovResult> {
  const plan = planEnrichment({ mode: 'pgc', pncpItemCount: 0, items: [] });

  try {
    const allDfds: ComprasGovPgcDetalheDto[] = [];
    let totalPaginas = 1;

    for (let pagina = 1; pagina <= Math.min(maxPages, totalPaginas); pagina++) {
      const page = await adapter.fetchPgcPage(orgaoCnpj, ano, pagina);
      totalPaginas = page.totalPaginas;
      allDfds.push(...page.dfds);
    }

    const sourceId = await upsertSourceRecord({
      source: CG_SOURCE,
      entityType: 'pgc_detalhe',
      identifier: `${orgaoCnpj}:${ano}`,
      sourceUrl: `cg://pgc/${orgaoCnpj}/${ano}`,
      rawPayload: { orgao: orgaoCnpj, ano, total: allDfds.length },
    });

    const pgcPersisted = await persistPgcDfdBatch(allDfds, sourceId);
    await recordSourceHealth(CG_SOURCE, true, undefined, 'modulo-pgc');

    return { ok: true, plan, pgcPersisted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSourceHealth(CG_SOURCE, false, message, 'modulo-pgc').catch(() => {});
    return { ok: false, plan, error: message };
  }
}

export async function runEnrichComprasGovJob(
  payload: EnrichComprasGovPayload,
  adapter: EnrichClientAdapter,
): Promise<EnrichComprasGovResult> {
  if (payload.kind === 'pgc') {
    return runEnrichPgc(payload.orgaoCnpj, payload.ano, adapter, payload.maxPages);
  }
  return runEnrichContratacao(payload.numeroControlePncp, adapter);
}

/** Enfileira job ENRICH_COMPRAS_GOV (Neon job_queue). */
export async function enqueueEnrichComprasGovJob(
  payload: EnrichComprasGovPayload,
  priority = 0,
): Promise<string> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO job_queue (job_type, payload, status, priority)
    VALUES (
      ${JOB_TYPE_ENRICH_COMPRAS_GOV},
      ${sql.json(payload as unknown as import('postgres').JSONValue)},
      'pending',
      ${priority}
    )
    RETURNING id
  `;
  return rows[0].id;
}

export async function processNextEnrichJob(
  adapter: EnrichClientAdapter,
  workerId = 'compras-gov-enrich',
): Promise<EnrichComprasGovResult | null> {
  const sql = getComprasGovSql();

  const locked = await sql<{ id: string; payload: EnrichComprasGovPayload }[]>`
    UPDATE job_queue
    SET status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM job_queue
      WHERE job_type = ${JOB_TYPE_ENRICH_COMPRAS_GOV} AND status = 'pending'
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload
  `;

  const job = locked[0];
  if (!job) return null;

  const result = await runEnrichComprasGovJob(job.payload, adapter);

  if (result.ok) {
    await sql`
      UPDATE job_queue
      SET status = 'completed', completed_at = now(), last_error = NULL
      WHERE id = ${job.id}
    `;
  } else {
    await sql`
      UPDATE job_queue
      SET status = 'failed', last_error = ${result.error ?? 'unknown'}
      WHERE id = ${job.id}
    `;
  }

  return result;
}
