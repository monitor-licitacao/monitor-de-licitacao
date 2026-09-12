import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClientSideFilters,
  buildPublicationQuery,
  buildPncpEditalId,
  extractPncpPdfUrl,
  formatPncpDate,
  matchTenantsForItem,
  normalizePncpItem,
} from './server/lib/pncpClient.js';

test('formatPncpDate converte para AAAAMMDD', () => {
  assert.equal(formatPncpDate('2026-09-01'), '20260901');
});

test('buildPublicationQuery mapeia filtros oficiais do PNCP', () => {
  const { url, clientSideFilters } = buildPublicationQuery({
    dataInicial: '2026-08-01',
    dataFinal: '2026-09-01',
    modalidade: 6,
    cnpj: '15.829.998/0001-09',
    pagina: 2,
    q: 'notebook',
    uf: 'ES',
  });

  assert.equal(url.searchParams.get('dataInicial'), '20260801');
  assert.equal(url.searchParams.get('dataFinal'), '20260901');
  assert.equal(url.searchParams.get('codigoModalidadeContratacao'), '6');
  assert.equal(url.searchParams.get('cnpj'), '15829998000109');
  assert.equal(url.searchParams.get('pagina'), '2');
  assert.equal(clientSideFilters.q, 'notebook');
  assert.equal(clientSideFilters.uf, 'ES');
});

test('extractPncpPdfUrl prioriza documento tipo edital', () => {
  const url = extractPncpPdfUrl([
    { url: 'https://exemplo.gov/anexo.pdf', titulo: 'Anexo I' },
    { url: 'https://exemplo.gov/edital.pdf', tipoDocumentoNome: 'Edital' },
  ]);
  assert.equal(url, 'https://exemplo.gov/edital.pdf');
});

test('normalizePncpItem gera draft compatível com schema.editais', () => {
  const draft = normalizePncpItem({
    anoContratacao: 2026,
    numeroContratacao: 42,
    processo: '001/2026',
    objetoCompra: 'Aquisição de esteiras ergométricas para academias',
    codigoNcm: '9506.91.00',
    orgaoEntidade: { cnpj: '15829998000109', razaoSocial: 'Compras RJ', uf: 'RJ' },
    valorTotalEstimado: 150000,
    linkSistemaOrigem: 'https://www.compras.rj.gov.br/edital/42',
    arquivos: [{ url: 'https://www.compras.rj.gov.br/edital.pdf', tipoDocumentoNome: 'Edital' }],
    dataPublicacaoPncp: '2026-09-01T10:00:00.000Z',
    dataAberturaProposta: '2026-10-01T10:00:00.000Z',
  });

  assert.equal(draft.processNumber, '001/2026');
  assert.equal(draft.ncmCode, '9506.91.00');
  assert.equal(draft.url, 'https://www.compras.rj.gov.br/edital.pdf');
  assert.equal(draft.uf, 'RJ');
  assert.match(buildPncpEditalId({ anoContratacao: 2026, numeroContratacao: 42, orgaoEntidade: { cnpj: '15829998000109' } }), /^edital-pncp-/);
});

test('applyClientSideFilters respeita q, uf e faixa de valor', () => {
  const items = [
    {
      objetoCompra: 'notebook escolar',
      orgaoEntidade: { uf: 'ES', municipio: 'Vitória' },
      valorTotalEstimado: 50000,
      dataAberturaProposta: '2026-12-01T00:00:00.000Z',
    },
    {
      objetoCompra: 'merenda escolar',
      orgaoEntidade: { uf: 'BA', municipio: 'Salvador' },
      valorTotalEstimado: 10000,
      dataAberturaProposta: '2026-12-01T00:00:00.000Z',
    },
  ];

  const filtered = applyClientSideFilters(items, {
    q: 'notebook',
    uf: 'ES',
    valorMin: 20000,
    situacao: 'abertas',
  }, new Date('2026-09-01'));

  assert.equal(filtered.length, 1);
  assert.match(filtered[0].objetoCompra!, /notebook/);
});

test('matchTenantsForItem detecta NCM e keyword', () => {
  const rules = [
    { tenantId: 1, ncms: ['9506.91'], keywords: [] },
    { tenantId: 2, ncms: [], keywords: ['esteira'] },
  ];

  const ncmMatches = matchTenantsForItem({ codigoNcm: '9506.91.00', objetoCompra: 'equipamentos' }, rules);
  assert.deepEqual(ncmMatches, [{ tenantId: 1, matchType: 'NCM', matchedTerm: '9506.91' }]);

  const kwMatches = matchTenantsForItem({ codigoNcm: '9999', objetoCompra: 'esteira ergométrica' }, rules);
  assert.deepEqual(kwMatches, [{ tenantId: 2, matchType: 'KEYWORD', matchedTerm: 'esteira' }]);
});
