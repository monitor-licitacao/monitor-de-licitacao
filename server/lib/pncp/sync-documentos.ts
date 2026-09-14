/**
 * Sync PNCP arquivos + histórico → Postgres (idempotente).
 */
import { createPncpDocumentosClient, type PncpDocumentosClientOptions } from './arquivos-client.js';
import { upsertArquivos } from './persist-arquivos.js';
import { upsertHistoricoPncp } from './persist-historico-pncp.js';
import type { SyncPncpDocumentosResult } from './types.js';

export type SyncPncpDocumentosInput = {
  contratacaoId: string;
  cnpj: string;
  ano: number;
  sequencial: number;
  source?: 'pncp_sync' | 'pncp_ingest';
};

export async function syncPncpDocumentos(
  input: SyncPncpDocumentosInput,
  clientOptions: PncpDocumentosClientOptions = {},
): Promise<SyncPncpDocumentosResult> {
  const source = input.source ?? 'pncp_sync';
  const client = createPncpDocumentosClient(clientOptions);

  try {
    const [arquivos, historico] = await Promise.all([
      client.fetchAllArquivos(input.cnpj, input.ano, input.sequencial),
      client.fetchAllHistorico(input.cnpj, input.ano, input.sequencial),
    ]);

    const arquivoCount = await upsertArquivos(input.contratacaoId, arquivos, source);
    const historicoCount = await upsertHistoricoPncp(input.contratacaoId, historico, source);

    return { ok: true, arquivoCount, historicoCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, arquivoCount: 0, historicoCount: 0, error: message };
  }
}
