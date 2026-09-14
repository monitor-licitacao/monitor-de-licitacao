import { createHttpIngestAdapter, ingestContratacaoBundle } from '../pncp/ingest.js';
import { parseNumeroControlePncp } from '../pncp/resolve-controle.js';
import {
  createPipelineFromContratacaoId,
  loadContratacaoSnapshotByPncp,
} from './persist.js';
import { buildSnapshotFromContratacao } from './snapshot.js';
import type { PipelineItemRow } from './types.js';

export type ResolvePncpResult =
  | { found: true; contratacaoId: string; numeroControlePncp: string; ingested: boolean }
  | { found: false; error: string };

export type ImportPipelineDeps = {
  loadByPncp: (numero: string) => Promise<{ id: string } | null>;
  ingest: (numero: string) => Promise<{ ok: boolean; contratacaoId?: string; error?: string }>;
};

export function createDefaultImportDeps(): ImportPipelineDeps {
  const adapter = createHttpIngestAdapter();
  return {
    async loadByPncp(numero) {
      const source = await loadContratacaoSnapshotByPncp(numero);
      return source ? { id: source.id } : null;
    },
    async ingest(numero) {
      const result = await ingestContratacaoBundle(numero, adapter);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, contratacaoId: result.contratacaoId };
    },
  };
}

export async function resolveContratacaoForPipeline(
  numeroControlePncp: string,
  deps: ImportPipelineDeps = createDefaultImportDeps(),
): Promise<ResolvePncpResult> {
  const parsed = parseNumeroControlePncp(numeroControlePncp.trim());
  if (!parsed) {
    return { found: false, error: 'Número de controle PNCP inválido.' };
  }

  const numero = parsed.numeroControlePncp;
  const existing = await deps.loadByPncp(numero);
  if (existing) {
    return { found: true, contratacaoId: existing.id, numeroControlePncp: numero, ingested: false };
  }

  const ingested = await deps.ingest(numero);
  if (!ingested.ok || !ingested.contratacaoId) {
    return {
      found: false,
      error: ingested.error ?? 'Processo não encontrado no PNCP.',
    };
  }

  return {
    found: true,
    contratacaoId: ingested.contratacaoId,
    numeroControlePncp: numero,
    ingested: true,
  };
}

export async function importPipelineByPncp(
  tenantId: number,
  numeroControlePncp: string,
  deps: ImportPipelineDeps = createDefaultImportDeps(),
): Promise<
  | { ok: true; data: PipelineItemRow; ingested: boolean }
  | { ok: false; code: 'NOT_FOUND'; error: string }
  | { ok: false; code: 'DUPLICATE'; existingId: string }
  | { ok: false; code: 'INVALID'; error: string }
> {
  const resolved = await resolveContratacaoForPipeline(numeroControlePncp, deps);
  if (resolved.found === false) {
    return { ok: false as const, code: 'NOT_FOUND' as const, error: resolved.error };
  }

  const created = await createPipelineFromContratacaoId(tenantId, resolved.contratacaoId);
  if (created.ok === false) {
    return created;
  }
  return { ok: true as const, data: created.data, ingested: resolved.ingested };
}

export function buildSnapshotForTest(source: Parameters<typeof buildSnapshotFromContratacao>[0]) {
  return buildSnapshotFromContratacao(source);
}
