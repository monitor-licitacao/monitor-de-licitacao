import 'dotenv/config';
import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeComprasGovPersistPool, hashPayload } from './server/lib/sourceLayer.js';
import {
  PncpDomainHttpError,
  PncpDomainSchemaError,
  validateAmparoList,
  validateInstrumentoList,
  validateModalidadeList,
} from './server/lib/pncp/domains/validate.js';
import {
  normalizeAmparo,
  normalizeInstrumento,
  normalizeModalidade,
} from './server/lib/pncp/domains/normalize.js';
import { PncpDomainClient, PNCP_DOMAIN_ENDPOINTS } from './server/lib/pncp/domains/client.js';
import {
  countPncpDomainRows,
  getAmparoByPncpId,
  getInstrumentoByPncpId,
  getModalidadeByPncpId,
  listAmparos,
  listInstrumentos,
  listModalidades,
} from './server/lib/pncp/domains/api.js';
import { runSyncPncpDomains, type PncpDomainFetchAdapter } from './server/lib/pncp/domains/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, 'server/lib/pncp/fixtures/domains');

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8')) as T;
}

const hasDb = Boolean(process.env.DATABASE_URL);
const modalidades = loadJson<unknown[]>('modalidades.json');
const instrumentos = loadJson<unknown[]>('instrumentos.json');
const amparos = loadJson<unknown[]>('amparos-legais.json');

function fixtureAdapter(overrides: Partial<Record<'modalidade' | 'instrumento' | 'amparo', unknown>> = {}): PncpDomainFetchAdapter {
  return {
    async fetchModalidades() {
      return { payload: overrides.modalidade ?? modalidades, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.modalidade, durationMs: 1 };
    },
    async fetchInstrumentos() {
      return { payload: overrides.instrumento ?? instrumentos, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.instrumento, durationMs: 1 };
    },
    async fetchAmparos() {
      return { payload: overrides.amparo ?? amparos, statusCode: 200, endpoint: PNCP_DOMAIN_ENDPOINTS.amparo, durationMs: 1 };
    },
  };
}

after(async () => {
  await closeComprasGovPersistPool();
});

test('validate — modalidades da fixture', () => {
  const rows = validateModalidadeList(modalidades);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 6);
  assert.equal(rows[0].irp, true);
  assert.equal(rows[2].statusAtivo, false);
});

test('validate — instrumentos preservam obrigatoriedade e inativo', () => {
  const rows = validateInstrumentoList(instrumentos);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].obrigatoriedadeDataAberturaPropostaNome, 'Obrigatória');
  assert.equal(rows[2].id, 5);
  assert.equal(rows[2].statusAtivo, false);
});

test('validate — amparos com tipo aninhado e campo opcional ausente', () => {
  const rows = validateAmparoList(amparos);
  assert.equal(rows.length, 3);
  assert.ok(rows[0].tipoAmparoLegal);
  assert.equal(rows[0].tipoAmparoLegal?.id, 1);
  assert.equal(rows[2].tipoAmparoLegal, null);
  assert.equal(rows[2].statusAtivo, false);
});

test('validate — payload inválido (não-lista)', () => {
  assert.throws(() => validateModalidadeList({ foo: 1 }), PncpDomainSchemaError);
});

test('validate — schema drift (id ausente)', () => {
  assert.throws(
    () => validateModalidadeList([{ nome: 'Sem id', statusAtivo: true }]),
    (err: unknown) => err instanceof PncpDomainSchemaError && /id/.test(err.message),
  );
});

test('normalize — modalidade preserva irp e datas da fonte', () => {
  const dto = validateModalidadeList(modalidades)[0];
  const row = normalizeModalidade(dto);
  assert.equal(row.pncpId, 6);
  assert.equal(row.irp, true);
  assert.equal(row.statusAtivo, true);
  assert.ok(row.sourceCreatedAt);
  assert.ok(row.sourceUpdatedAt);
  assert.equal(row.rawJson.id, 6);
  assert.equal(typeof row.payloadHash, 'string');
  assert.equal(row.payloadHash.length, 64);
});

test('normalize — instrumento preserva obrigatoriedade', () => {
  const dto = validateInstrumentoList(instrumentos)[0];
  const row = normalizeInstrumento(dto);
  assert.equal(row.obrigatoriedadeAberturaProposta, 'Obrigatória');
  assert.equal(row.obrigatoriedadeEncerramentoProposta, 'Obrigatória');
});

test('normalize — amparo normaliza tipo aninhado', () => {
  const dto = validateAmparoList(amparos)[0];
  const row = normalizeAmparo(dto);
  assert.equal(row.pncpId, 1);
  assert.ok(row.tipo);
  assert.equal(row.tipo?.pncpId, 1);
  assert.equal(row.tipo?.nome, 'Lei');
});

test('normalize — hash muda quando nome muda', () => {
  const dto = validateModalidadeList(modalidades)[0];
  const a = normalizeModalidade(dto);
  const b = normalizeModalidade({ ...dto, nome: 'Pregão alterado' });
  assert.notEqual(a.payloadHash, b.payloadHash);
  assert.equal(hashPayload(dto), a.payloadHash);
});

test('client — HTTP não 2xx', async () => {
  const client = new PncpDomainClient({
    fetchFn: async () => new Response('nope', { status: 503 }),
    maxRetries: 1,
  });
  await assert.rejects(() => client.fetchModalidades(), (err: unknown) => {
    return err instanceof PncpDomainHttpError && err.statusCode === 503;
  });
});

test('client — timeout', async () => {
  const client = new PncpDomainClient({
    timeoutMs: 20,
    maxRetries: 1,
    fetchFn: async (_url, init) => {
      await new Promise<void>((_resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), 80);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      });
      return new Response('[]', { status: 200 });
    },
  });
  await assert.rejects(() => client.fetchModalidades(), (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';
    return name === 'AbortError' || /timeout|aborted/i.test(message);
  });
});

describe('persistência e API', { concurrency: 1 }, () => {
test('sync — primeira sincronização', { skip: !hasDb }, async () => {
  const result = await runSyncPncpDomains(fixtureAdapter());
  assert.equal(result.ok, true);
  assert.equal(result.domains.modalidade.ok, true);
  assert.ok((result.domains.modalidade.recordCount ?? 0) >= 3);
  assert.ok((result.domains.instrumento.recordCount ?? 0) >= 3);
  assert.ok((result.domains.amparo.recordCount ?? 0) >= 3);

  const pregao = await getModalidadeByPncpId(6);
  assert.ok(pregao);
  assert.equal(pregao!.pncpId, 6);
  assert.equal(pregao!.irp, true);
  assert.ok(pregao!.rawJson);
  assert.ok(pregao!.sourceUpdatedAt);
  assert.ok(pregao!.lastSeenAt);
  assert.notEqual(String(pregao!.sourceUpdatedAt), String(pregao!.lastSeenAt));

  const inativo = await getInstrumentoByPncpId(5);
  assert.ok(inativo);
  assert.equal(inativo!.statusAtivo, false);

  const amparo = await getAmparoByPncpId(1);
  assert.ok(amparo);
  assert.ok(amparo!.tipoAmparoLegal);
  assert.equal(amparo!.tipoAmparoLegal!.pncpId, 1);
});

test('sync — idempotente não duplica', { skip: !hasDb }, async () => {
  const first = await runSyncPncpDomains(fixtureAdapter());
  const afterFirst = await countPncpDomainRows('modalidade');
  const second = await runSyncPncpDomains(fixtureAdapter());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.domains.modalidade.changedRecords, 0);
  assert.equal(second.domains.instrumento.changedRecords, 0);
  assert.equal(second.domains.amparo.changedRecords, 0);
  assert.equal(await countPncpDomainRows('modalidade'), afterFirst);
});

test('sync — registro novo e alteração de nome', { skip: !hasDb }, async () => {
  await runSyncPncpDomains(fixtureAdapter());
  const extra = [
    ...(modalidades as object[]),
    {
      id: 99,
      nome: "Diálogo Competitivo",
      descricao: "novo",
      dataInclusao: "2026-01-01T00:00:00",
      dataAtualizacao: "2026-01-01T00:00:00",
      statusAtivo: true,
      irp: false,
    },
  ];
  const created = await runSyncPncpDomains(fixtureAdapter({ modalidade: extra }));
  assert.equal(created.domains.modalidade.changedRecords, 1);
  const novo = await getModalidadeByPncpId(99);
  assert.equal(novo?.nome, 'Diálogo Competitivo');

  extra[extra.length - 1] = { ...extra[extra.length - 1], nome: 'Diálogo Competitivo (rev)' };
  const updated = await runSyncPncpDomains(fixtureAdapter({ modalidade: extra }));
  assert.ok((updated.domains.modalidade.changedRecords ?? 0) >= 1);
  const after = await getModalidadeByPncpId(99);
  assert.equal(after?.nome, 'Diálogo Competitivo (rev)');
});

test('sync — inativação statusAtivo true → false preserva linha', { skip: !hasDb }, async () => {
  await runSyncPncpDomains(fixtureAdapter());
  const mutated = (instrumentos as Array<Record<string, unknown>>).map((row) =>
    row.id === 1 ? { ...row, statusAtivo: false } : row,
  );
  const result = await runSyncPncpDomains(fixtureAdapter({ instrumento: mutated }));
  assert.ok((result.domains.instrumento.changedRecords ?? 0) >= 1);
  const edital = await getInstrumentoByPncpId(1);
  assert.equal(edital?.statusAtivo, false);
  const stillThere = await getInstrumentoByPncpId(5);
  assert.ok(stillThere);
});

test('sync — payload inválido isola o domínio', { skip: !hasDb }, async () => {
  const result = await runSyncPncpDomains(fixtureAdapter({ modalidade: { invalid: true } }));
  assert.equal(result.domains.modalidade.ok, false);
  assert.match(result.domains.modalidade.error ?? '', /schema|lista|payload/i);
  assert.equal(result.domains.instrumento.ok, true);
  assert.equal(result.domains.amparo.ok, true);
});

test('API — listagem e filtros', { skip: !hasDb }, async () => {
  await runSyncPncpDomains(fixtureAdapter());

  const allMod = await listModalidades({});
  assert.ok(allMod.some((m) => m.pncpId === 6));

  const ativos = await listModalidades({ statusAtivo: true });
  assert.ok(ativos.every((m) => m.statusAtivo));

  const q = await listInstrumentos({ q: 'Edital' });
  assert.ok(q.some((i) => i.pncpId === 1));

  const inativos = await listInstrumentos({ statusAtivo: false });
  assert.ok(inativos.some((i) => i.pncpId === 5));

  const tipo = await listAmparos({ tipo: 1 });
  assert.ok(tipo.some((a) => a.pncpId === 1));

  const qAmparo = await listAmparos({ q: 'Art. 75' });
  assert.ok(qAmparo.some((a) => a.pncpId === 75));
});
});
