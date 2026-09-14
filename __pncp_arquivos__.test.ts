import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import arquivosFixture from './server/lib/pncp/fixtures/passex-19732/pncp-arquivos-p1.json' with { type: 'json' };
import historicoFixture from './server/lib/pncp/fixtures/passex-19732/pncp-historico-p1.json' with { type: 'json' };
import {
  buildHistoricoEventoLabel,
  createPncpDocumentosClient,
  resolveArquivoDownloadUrl,
} from './server/lib/pncp/arquivos-client.js';
import { upsertArquivos, listArquivos, countArquivos } from './server/lib/pncp/persist-arquivos.js';
import {
  upsertHistoricoPncp,
  listHistoricoPncp,
  countHistoricoPncp,
} from './server/lib/pncp/persist-historico-pncp.js';
import { mapArquivosToAnexos, mapHistoricoPncpToUi } from './server/lib/pncp/map-documentos-ui.js';
import { getContratacaoEnrichmentContext, closeComprasGovPersistPool } from './server/lib/compras-gov/persist.js';
import type { PncpArquivoDto, PncpHistoricoLogDto } from './server/lib/pncp/types.js';

const hasDb = Boolean(process.env.DATABASE_URL);
const PASSEX_CONTROLE = '00394452000103-1-019732/2026';
const CNPJ = '00394452000103';
const ANO = 2026;
const SEQ = 19732;

test('arquivos-client — parse fixture Passex (4 documentos)', () => {
  const arquivos = arquivosFixture as PncpArquivoDto[];
  assert.equal(arquivos.length, 4);

  const tipos = arquivos.map((a) => a.tipoDocumentoNome);
  assert.deepEqual(tipos, ['Edital', 'Estudo Técnico Preliminar', 'Mapa de Riscos', 'Termo de Referência']);

  for (const arq of arquivos) {
    const url = resolveArquivoDownloadUrl(arq);
    assert.ok(url?.startsWith('https://pncp.gov.br/'));
  }
});

test('arquivos-client — evento_label Mapa de Riscos', () => {
  const logs = historicoFixture as PncpHistoricoLogDto[];
  const mapa = logs.find((l) => l.documentoTipo === 'Mapa de Riscos');
  assert.ok(mapa);
  assert.equal(buildHistoricoEventoLabel(mapa!), 'Inclusão - Documento de Contratação');
});

test('arquivos-client — fetch via mock (paginação)', async () => {
  const arquivos = arquivosFixture as PncpArquivoDto[];
  const historico = historicoFixture as PncpHistoricoLogDto[];

  const client = createPncpDocumentosClient({
    fetchFn: async (url) => {
      const u = String(url);
      if (u.includes('/arquivos/quantidade')) {
        return new Response('4', { status: 200 });
      }
      if (u.includes('/arquivos?')) {
        return new Response(JSON.stringify(arquivos), { status: 200 });
      }
      if (u.includes('/historico?')) {
        return new Response(JSON.stringify(historico), { status: 200 });
      }
      return new Response(null, { status: 404 });
    },
  });

  assert.equal(await client.fetchArquivosQuantidade(CNPJ, ANO, SEQ), 4);
  assert.equal((await client.fetchAllArquivos(CNPJ, ANO, SEQ)).length, 4);
  assert.equal((await client.fetchAllHistorico(CNPJ, ANO, SEQ)).length, historico.length);
});

test('persist — upsert idempotente (arquivos + histórico)', { skip: !hasDb }, async () => {
  const ctx = await getContratacaoEnrichmentContext(PASSEX_CONTROLE);
  assert.ok(ctx, `contratação ${PASSEX_CONTROLE} não encontrada no DB`);

  const arquivos = arquivosFixture as PncpArquivoDto[];
  const historico = historicoFixture as PncpHistoricoLogDto[];

  await upsertArquivos(ctx!.contratacaoId, arquivos, 'pncp_sync');
  await upsertHistoricoPncp(ctx!.contratacaoId, historico, 'pncp_sync');

  const count1Arq = await countArquivos(ctx!.contratacaoId);
  const count1Log = await countHistoricoPncp(ctx!.contratacaoId);
  assert.equal(count1Arq, 4);
  assert.ok(count1Log >= 5);

  await upsertArquivos(ctx!.contratacaoId, arquivos, 'pncp_sync');
  await upsertHistoricoPncp(ctx!.contratacaoId, historico, 'pncp_sync');

  assert.equal(await countArquivos(ctx!.contratacaoId), count1Arq);
  assert.equal(await countHistoricoPncp(ctx!.contratacaoId), count1Log);

  const anexos = mapArquivosToAnexos(await listArquivos(ctx!.contratacaoId));
  assert.equal(anexos.length, 4);
  assert.ok(anexos.some((a) => a.tipo === 'Edital'));
  assert.ok(anexos.every((a) => a.url_download?.startsWith('https://')));

  const uiLogs = mapHistoricoPncpToUi(await listHistoricoPncp(ctx!.contratacaoId, { limit: 10 }));
  assert.ok(uiLogs.length >= 5);
  assert.ok(uiLogs.every((l) => l.source === 'pncp_log'));
  assert.ok(uiLogs.some((l) => l.evento === 'Inclusão - Documento de Contratação'));
});

test.after(async () => {
  await closeComprasGovPersistPool();
});
