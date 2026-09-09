import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDateChunks,
  evaluateItemMatch,
  normalizeRawProcurementItem,
  DEFAULT_FITNESS_KEYWORDS,
  DEFAULT_FITNESS_NEGATIVE_KEYWORDS,
} from './server/workers/historical_pncp_extractor.js';

test('Historical PNCP Extractor - 1) Fatiamento Temporal (Date Chunks)', () => {
  // Teste de fatiamento padrão de 15 dias
  const chunks = generateDateChunks('2024-01-01', '2024-02-15', 15);
  assert.ok(chunks.length >= 3, `Deveria ter pelo menos 3 chunks, gerou ${chunks.length}`);
  assert.equal(chunks[0].start, '2024-01-01');
  assert.equal(chunks[0].end, '2024-01-15');
  assert.equal(chunks[1].start, '2024-01-16');
  assert.equal(chunks[chunks.length - 1].end, '2024-02-15');

  // Teste com período menor que o chunkDays
  const singleChunk = generateDateChunks('2024-03-01', '2024-03-05', 10);
  assert.equal(singleChunk.length, 1);
  assert.equal(singleChunk[0].start, '2024-03-01');
  assert.equal(singleChunk[0].end, '2024-03-05');

  // Teste de validação fail-closed de datas inválidas
  assert.throws(() => {
    generateDateChunks('2024-05-01', '2024-01-01', 15);
  }, /Intervalo de datas inválido/);
});

test('Historical PNCP Extractor - 2) Avaliação de Match Semântico e NCM Fitness (9506.91.00)', () => {
  const targetNcm = '9506.91.00';

  // 2.1 Match direto por NCM 9506.91
  const matchNcm = evaluateItemMatch('9506.91.00', 'Material esportivo não especificado', targetNcm);
  assert.equal(matchNcm.matches, true);
  assert.equal(matchNcm.type, 'NCM');

  // 2.2 Match por palavra-chave de esteira ergométrica
  const matchEsteira = evaluateItemMatch(
    '0000.00.00',
    'Aquisição de esteira ergométrica profissional para academia da PM',
    targetNcm,
    DEFAULT_FITNESS_KEYWORDS,
    DEFAULT_FITNESS_NEGATIVE_KEYWORDS
  );
  assert.equal(matchEsteira.matches, true);
  assert.equal(matchEsteira.type, 'KEYWORD');
  assert.equal(matchEsteira.term, 'esteira ergométrica');

  // 2.3 Match por musculação / supino / anilhas
  const matchSupino = evaluateItemMatch(
    '',
    'Banco supino regulável com suporte para halteres e anilhas',
    targetNcm
  );
  assert.equal(matchSupino.matches, true);
  assert.equal(matchSupino.type, 'KEYWORD');

  // 2.4 Rejeição de itens irrelevantes
  const nonMatch = evaluateItemMatch(
    '8471.30.12',
    'Contratação de link de fibra óptica e roteadores de rede',
    targetNcm
  );
  assert.equal(nonMatch.matches, false);

  // 2.5 Rejeição por filtro negativo (ex: parquinho infantil / brinquedos de praça)
  const rejectedNeg = evaluateItemMatch(
    '9506.91.00',
    'Manutenção de parquinho infantil e brinquedos de praça pública',
    targetNcm
  );
  assert.equal(rejectedNeg.matches, false, 'Deveria ser excluído pelo filtro negativo');
});

test('Historical PNCP Extractor - 3) Normalização Canônica de Dados e Orçamento Estimado', () => {
  const rawItemCompras = {
    idCompra: '92515306000572024',
    numeroControlePNCP: '28305936000140-1-000129/2024',
    anoCompraPncp: 2024,
    orgaoEntidadeRazaoSocial: 'PREFEITURA MUNICIPAL DE TESTE',
    unidadeOrgaoNomeUnidade: 'SECRETARIA DE ESPORTES',
    numeroCompra: '57',
    processo: '2024/0057',
    objetoCompra: 'AQUISIÇÃO DE EQUIPAMENTOS DE MUSCULAÇÃO E ESTEIRAS PROFISSIONAIS',
    valorTotalEstimado: 185400.5,
    dataInclusaoPncp: '2024-04-10T10:00:00',
    dataPublicacaoPncp: '2024-04-10T10:00:00',
    dataAberturaPropostaPncp: '2024-04-25T09:00:00',
  };

  const normalized = normalizeRawProcurementItem(rawItemCompras, 'COMPRAS_DADOS_ABERTOS');

  assert.equal(normalized.id, 'hist-compras-92515306000572024');
  assert.equal(normalized.processNumber, '2024/0057');
  assert.equal(normalized.agency, 'PREFEITURA MUNICIPAL DE TESTE');
  assert.equal(normalized.estimatedValue, 185400.5);
  assert.ok(normalized.title.includes('AQUISIÇÃO DE EQUIPAMENTOS'));
  assert.ok(normalized.url.includes('pncp.gov.br'));
});

const externalIntegrationTest = process.env.RUN_EXTERNAL_HISTORICAL_TESTS === '1' ? test : test.skip;
externalIntegrationTest(
  'Historical PNCP Extractor - 4) Integração com API Real de Dados Abertos (Consulta Amostra 14.133)',
  async () => {
    const { fetchComprasDadosAbertosPncp, COMPRAS_DADOS_ABERTOS_PNCP_URL } = await import(
      './server/workers/historical_pncp_extractor.js'
    );

    const healthUrl = new URL(COMPRAS_DADOS_ABERTOS_PNCP_URL);
    healthUrl.searchParams.set('dataPublicacaoPncpInicial', '2024-06-01');
    healthUrl.searchParams.set('dataPublicacaoPncpFinal', '2024-06-03');
    healthUrl.searchParams.set('codigoModalidade', '6');
    healthUrl.searchParams.set('pagina', '1');
    healthUrl.searchParams.set('tamanhoPagina', '1');
    const healthResponse = await fetch(healthUrl.toString());
    assert.equal(healthResponse.status, 200, 'Endpoint externo deve responder com HTTP 200');

    // Consulta um intervalo real de 3 dias de 2024 para Pregão Eletrônico (modalidade 6)
    const result = await fetchComprasDadosAbertosPncp('2024-06-01', '2024-06-03', 6, 1, 10);
    assert.ok(result.total > 0, 'Deveria retornar registros no período de dados abertos');
    assert.ok(Array.isArray(result.items), 'Deveria retornar array de itens');
    assert.ok(result.items.length > 0, 'Deveria conter itens reais retornados');

    const first = result.items[0];
    assert.ok(first.idCompra || first.numeroControlePNCP, 'Item deve ter idCompra ou controle PNCP');
  }
);

test('Historical PNCP Extractor - 5) Fail-Closed e Proteção de Tenant nas Rotas de Extração Histórica', async () => {
  const { historicalRouter } = await import('./server/routes/historical.js');
  assert.ok(historicalRouter, 'historicalRouter deve estar exportado');

  // Testa rejeição fail-closed sem usuário autenticado
  let resStatus = 0;
  let resJson: any = null;
  const mockReq: any = { user: null, body: {}, query: {} };
  const mockRes: any = {
    status(code: number) {
      resStatus = code;
      return this;
    },
    json(data: any) {
      resJson = data;
      return this;
    },
  };

  const getAuthenticatedTenantId = (await import('./server/lib/tenantAuth.js')).getAuthenticatedTenantId;
  const tid = getAuthenticatedTenantId(mockReq, mockRes);
  assert.equal(tid, null, 'Sem req.user deve retornar null');
  assert.equal(resStatus, 401, 'Deve retornar 401 fail-closed');
});

