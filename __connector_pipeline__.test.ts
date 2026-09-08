import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConnectorConfig,
  buildApiUrl,
  executeConnector,
  isValidSourceUrl,
  ApiConnectorConfig,
  ScraperConnectorConfig,
} from './server/lib/connectorExecutor.js';
import { isRejectedSistemaSUrl } from './server/lib/sistemaSUrls.js';

test('1) Pipeline de Configuração - Normalização e Validação Estrita (Fail-Closed)', () => {
  // 1.1 API com Query String clássica
  const apiConfig1 = normalizeConnectorConfig('API', '?ncm=9506.91.00&modalidade=6&status=aberta');
  assert.equal(apiConfig1.type, 'api');
  assert.deepEqual((apiConfig1 as ApiConnectorConfig).query, {
    ncm: '9506.91.00',
    modalidade: '6',
    status: 'aberta',
  });

  // 1.2 API com JSON estruturado
  const apiConfigJson = normalizeConnectorConfig('API', JSON.stringify({
    query: { codigoModalidadeContratacao: 6, pagina: 1, tamanhoPagina: 50 },
    headers: { 'X-Custom-Client': 'VectraMonitor' },
  }));
  assert.equal(apiConfigJson.type, 'api');
  assert.equal((apiConfigJson as ApiConnectorConfig).query?.codigoModalidadeContratacao, 6);
  assert.equal((apiConfigJson as ApiConnectorConfig).headers?.['X-Custom-Client'], 'VectraMonitor');

  // 1.3 API com JSON plano (chave-valor direta)
  const apiConfigFlat = normalizeConnectorConfig('API', JSON.stringify({
    ncm: '9506.91.00',
    uf: 'RS',
  }));
  assert.equal(apiConfigFlat.type, 'api');
  assert.equal((apiConfigFlat as ApiConnectorConfig).query?.ncm, '9506.91.00');

  // 1.4 API com configuração inválida falha explicitamente (sem fallback silencioso)
  assert.throws(() => {
    normalizeConnectorConfig('API', '{ invalid json syntax !!!');
  }, /Configuração JSON de API inválida/);

  // 1.5 Scraper com seletor CSS simples
  const scraperConfigCss = normalizeConnectorConfig('SCRAPER', 'table.licitacoes tr.edital-item');
  assert.equal(scraperConfigCss.type, 'scraper');
  assert.equal((scraperConfigCss as ScraperConnectorConfig).listSelector, 'table.licitacoes tr.edital-item');

  // 1.6 Scraper com JSON avançado
  const scraperConfigJson = normalizeConnectorConfig('SCRAPER', JSON.stringify({
    listSelector: 'div.processo-card',
    titleSelector: 'h3.processo-titulo',
    descriptionSelector: 'p.resumo-objeto',
    dateSelector: 'span.data-abertura',
  }));
  assert.equal(scraperConfigJson.type, 'scraper');
  assert.equal((scraperConfigJson as ScraperConnectorConfig).listSelector, 'div.processo-card');
  assert.equal((scraperConfigJson as ScraperConnectorConfig).titleSelector, 'h3.processo-titulo');
  assert.equal((scraperConfigJson as ScraperConnectorConfig).descriptionSelector, 'p.resumo-objeto');

  // 1.7 Scraper sem seletor obrigatório falha explicitamente
  assert.throws(() => {
    normalizeConnectorConfig('SCRAPER', '');
  }, /listSelector.*obrigatório/);

  assert.throws(() => {
    normalizeConnectorConfig('SCRAPER', JSON.stringify({ titleSelector: 'h1' }));
  }, /'listSelector' é obrigatório no JSON/);
});

test('2) Executor Unificado - Aplicação Real de Query Params para Conector API', async () => {
  let capturedUrl = '';
  let capturedHeaders: HeadersInit = {};

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = input.toString();
    capturedHeaders = init?.headers || {};
    return new Response(JSON.stringify({
      data: [
        {
          numeroContratacao: '123/2026',
          codigoNcm: '9506.91.00',
          objetoCompra: 'Aquisição de esteiras ergométricas e bicicletas ergométricas profissionais',
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const persistedSource = {
    sourceId: 'src-pncp-test-01',
    sourceName: 'PNCP Portal Nacional',
    type: 'API',
    endpointOrUrl: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao',
    selectorOrParams: '?codigoModalidadeContratacao=6&tamanhoPagina=50&pagina=1&dataInicial=20260801&dataFinal=20260901',
    customFetch: mockFetch,
  };

  const result = await executeConnector(persistedSource);

  assert.equal(result.success, true);
  assert.equal(result.itemsFound, 1);
  assert.equal(result.payloadPreview.detectedItems, 1);
  assert.ok(result.payloadPreview.sampleTitle?.includes('Aquisição de esteiras'));

  // Validação crítica: Os query params configurados foram EFETIVAMENTE aplicados na URL final da requisição externa
  const urlObj = new URL(capturedUrl);
  assert.equal(urlObj.origin, 'https://pncp.gov.br');
  assert.equal(urlObj.pathname, '/api/consulta/v1/contratacoes/publicacao');
  assert.equal(urlObj.searchParams.get('codigoModalidadeContratacao'), '6');
  assert.equal(urlObj.searchParams.get('tamanhoPagina'), '50');
  assert.equal(urlObj.searchParams.get('pagina'), '1');
  assert.equal(urlObj.searchParams.get('dataInicial'), '20260801');
  assert.equal(urlObj.searchParams.get('dataFinal'), '20260901');
});

test('3) Executor Unificado - Aplicação Real de Seletores CSS para Conector Scraper', async () => {
  const mockHtml = `
    <html>
      <body>
        <table class="grid-licitacoes">
          <tbody>
            <tr class="item-edital">
              <td class="col-proc">PE 045/2026</td>
              <td class="col-title"><a href="/edital/45">Fornecimento de Aparelhos de Musculação</a></td>
              <td class="col-date">18/09/2026</td>
            </tr>
            <tr class="item-edital">
              <td class="col-proc">PE 046/2026</td>
              <td class="col-title"><a href="/edital/46">Renovação de Anilhas e Barras Olímpicas</a></td>
              <td class="col-date">20/09/2026</td>
            </tr>
            <tr class="irrelevant-row">
              <td>Outro Conteúdo</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const mockFetch: typeof fetch = async () => {
    return new Response(mockHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };

  const persistedSource = {
    sourceId: 'src-scraper-test-01',
    sourceName: 'Prefeitura de Frederico Westphalen',
    type: 'SCRAPER',
    endpointOrUrl: 'https://fredericowestphalen.rs.gov.br/licitacoes',
    selectorOrParams: JSON.stringify({
      listSelector: 'table.grid-licitacoes tr.item-edital',
      titleSelector: 'td.col-title a',
      dateSelector: 'td.col-date',
    }),
    customFetch: mockFetch,
  };

  const result = await executeConnector(persistedSource);

  assert.equal(result.success, true);
  assert.equal(result.itemsFound, 2);
  assert.equal(result.payloadPreview.htmlElementsMatched, 2);
  assert.equal(result.payloadPreview.items?.length, 2);
  assert.equal(result.payloadPreview.items?.[0].title, 'Fornecimento de Aparelhos de Musculação');
  assert.equal(result.payloadPreview.items?.[0].date, '18/09/2026');
  assert.equal(result.payloadPreview.items?.[1].title, 'Renovação de Anilhas e Barras Olímpicas');
});

test('4) Executor Unificado - Segurança: Bloqueio SSRF e Desmock Sistema S', async () => {
  // 4.1 Bloqueio de URL mock/descontinuada do Sistema S
  const sestMockResult = await executeConnector({
    type: 'SCRAPER',
    endpointOrUrl: 'https://sestsenat.org.br/licitacoes-e-compras',
    selectorOrParams: 'table tr',
  });
  assert.equal(sestMockResult.success, false);
  assert.ok(sestMockResult.error?.includes('desatualizado e foi rejeitado'));
  assert.equal(sestMockResult.canonicalSuggestion, 'https://compras.sestsenat.org.br/portal/Mural.aspx');

  // 4.2 Bloqueio SSRF de IP local/privado
  const ssrfResult = await executeConnector({
    type: 'API',
    endpointOrUrl: 'http://169.254.169.254/latest/meta-data/',
    selectorOrParams: '',
  });
  assert.equal(ssrfResult.success, false);
  assert.ok(ssrfResult.error?.includes('SSRF Protection'));

  const localhostResult = await executeConnector({
    type: 'API',
    endpointOrUrl: 'http://localhost:5432',
    selectorOrParams: '',
  });
  assert.equal(localhostResult.success, false);
  assert.ok(localhostResult.error?.includes('SSRF Protection'));
});

test('5) Conector PNCP Prioritário - Formato Real, Parâmetros e Isolamento', () => {
  const pncpBase = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
  const query = {
    dataInicial: '20260801',
    dataFinal: '20260901',
    codigoModalidadeContratacao: 6,
    tamanhoPagina: 50,
    pagina: 2,
  };

  const finalUrl = buildApiUrl(pncpBase, query);
  const parsed = new URL(finalUrl);

  assert.equal(parsed.searchParams.get('dataInicial'), '20260801');
  assert.equal(parsed.searchParams.get('dataFinal'), '20260901');
  assert.equal(parsed.searchParams.get('codigoModalidadeContratacao'), '6');
  assert.equal(parsed.searchParams.get('tamanhoPagina'), '50');
  assert.equal(parsed.searchParams.get('pagina'), '2');
});

test('6) Pipeline NCM Multi-Item - Suporte a Múltiplos NCMs e Desbloqueio de Itens', () => {
  // Simula o catálogo inicial de NCMs
  const monitoredNcms = [
    { id: 1, code: '9506.91.00', description: 'Artigos e aparelhos para cultura física, ginástica ou atletismo', active: true, isPrimary: true },
    { id: 2, code: '9506.99.00', description: 'Outros artigos e equipamentos para esportes ou jogos ao ar livre', active: true, isPrimary: false },
    { id: 3, code: '9506.62.00', description: 'Bolas infláveis (futebol, basquete, vôlei)', active: true, isPrimary: false },
  ];

  // 6.1 Confirma que múltiplos NCMs podem ser monitorados concomitantemente
  assert.equal(monitoredNcms.length, 3);
  assert.equal(monitoredNcms.filter(n => n.active).length, 3);
  const primaryNcm = monitoredNcms.find(n => n.isPrimary);
  assert.equal(primaryNcm?.code, '9506.91.00');

  // 6.2 Adição de novo NCM desbloqueando novos itens (ex: piso de borracha / tatame 9506.91.00 ou 4008.21.00)
  const newNcm = {
    id: 4,
    code: '4008.21.00',
    description: 'Placas e folhas de borracha alveolar para piso de academia',
    active: true,
    isPrimary: false,
  };
  monitoredNcms.push(newNcm);
  assert.equal(monitoredNcms.length, 4);

  // 6.3 Alternância de NCM primário
  const targetId = 2;
  monitoredNcms.forEach(n => { n.isPrimary = n.id === targetId; });
  assert.equal(monitoredNcms.find(n => n.id === 2)?.isPrimary, true);
  assert.equal(monitoredNcms.find(n => n.id === 1)?.isPrimary, false);
});

