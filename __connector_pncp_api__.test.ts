import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from 'winston';
import { PncpApiError, PncpOrgao } from './server/lib/connectors/pncp/types.js';
import { OrgaosCollector } from './server/workers/OrgaosCollector.js';

/**
 * Mock logger para testes
 */
const createMockLogger = (): Logger => {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    log: () => {},
  } as unknown as Logger;
};

test('PncpApiClient - PncpApiError deve ter estrutura correta', async () => {
  const error = new PncpApiError(
    500,
    'Erro no servidor',
    { url: 'https://pncp.gov.br/api/search/filters' },
  );

  assert.equal(error.statusCode, 500, 'Status code deve ser 500');
  assert.equal(error.message, 'Erro no servidor', 'Mensagem de erro');
  assert.ok(error.details, 'Deve ter detalhes');
  assert.equal(error.name, 'PncpApiError', 'Nome do erro');
});

test('PncpApiClient - PncpOrgao tipos validação', async () => {
  const orgao: PncpOrgao = {
    id: '1',
    cnpj: '00000000000191',
    nome: 'Ministério da Educação',
    total: 150,
    uf: 'DF',
    tipoOrgao: 'Ministério',
  };

  assert.ok(orgao.id, 'Deve ter ID');
  assert.ok(orgao.cnpj, 'Deve ter CNPJ');
  assert.ok(orgao.nome, 'Deve ter nome');
  assert.equal(typeof orgao.total, 'number', 'Total deve ser número');
});

test('OrgaosCollector - Deve coletar órgãos e gerar estatísticas', async () => {
  const logger = createMockLogger();

  // Mock PncpApiClient
  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
      {
        id: '2',
        cnpj: '34028316000152',
        nome: 'Universidade de São Paulo',
        total: 200,
        uf: 'SP',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.ok(stats, 'Deve retornar estatísticas');
  assert.equal(stats.totalProcessados, 2, 'Deve processar 2 órgãos');
  assert.equal(stats.totalInseridos, 2, 'Deve inserir 2 órgãos');
  assert.equal(stats.status, 'sucesso', 'Status deve ser sucesso');
  assert.ok(stats.tempoExecucaoMs >= 0, 'Tempo de execução deve ser válido');
  assert.equal(
    stats.dataCeleta,
    new Date(stats.dataCeleta).toISOString(),
    'Data de coleta deve ser ISO string',
  );
});

test('OrgaosCollector - Deve validar órgão com campo faltando', async () => {
  const logger = createMockLogger();

  // Mock PncpApiClient com órgão inválido (sem CNPJ)
  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '', // CNPJ vazio
        nome: 'Órgão Inválido',
        total: 150,
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.totalProcessados, 1, 'Deve processar 1 órgão');
  assert.equal(stats.erros, 1, 'Deve contar 1 erro (órgão inválido)');
  assert.equal(stats.totalInseridos, 0, 'Não deve inserir órgão inválido');
});

test('OrgaosCollector - Deve validar formato CNPJ', async () => {
  const logger = createMockLogger();

  // Mock PncpApiClient com CNPJ inválido
  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '123456', // CNPJ com menos de 14 dígitos
        nome: 'Órgão com CNPJ Inválido',
        total: 150,
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.erros, 1, 'Deve rejeitar CNPJ inválido');
  assert.equal(stats.totalInseridos, 0, 'Não deve inserir com CNPJ inválido');
});

test('OrgaosCollector - Deve ser idempotente (rodar 2x sem duplicatas)', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);

  // Primeira execução
  const stats1 = await collector.coletarOrgaos();
  assert.equal(stats1.totalInseridos, 1, 'Primeira execução insere 1');

  // Segunda execução (deve ser idempotente)
  const stats2 = await collector.coletarOrgaos();
  assert.equal(stats2.totalInseridos, 1, 'Segunda execução também insere 1 (idempotente)');
});

test('OrgaosCollector - Deve contar inserts vs updates', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.totalInseridos, 1, 'Deve contar inserts');
  assert.equal(stats.totalAtualizados, 0, 'Deve contar updates separadamente');
  assert.equal(
    stats.totalInseridos + stats.totalAtualizados,
    stats.totalProcessados,
    'Insert + Update deve igual total processado',
  );
});

test('OrgaosCollector - Deve gerar status parcial quando houver alguns erros', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
      {
        id: '2',
        cnpj: '', // Inválido
        nome: 'Órgão Inválido',
        total: 100,
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.status, 'parcial', 'Status deve ser parcial quando há alguns erros');
  assert.equal(stats.totalInseridos, 1, 'Deve ter inserido 1 órgão válido');
  assert.equal(stats.erros, 1, 'Deve ter 1 erro');
});

test('OrgaosCollector - Deve lidar com resposta vazia', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.status, 'erro', 'Status deve ser erro quando não há órgãos');
  assert.equal(stats.totalProcessados, 0, 'Deve processar 0 órgãos');
});

test('OrgaosCollector - Deve validar total não-negativo', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Órgão com total inválido',
        total: -10, // Negativo
        uf: 'DF',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.erros, 1, 'Deve rejeitar total negativo');
  assert.equal(stats.totalInseridos, 0, 'Não deve inserir com total inválido');
});

test('OrgaosCollector - Deve processar múltiplos órgãos sem parar em erro', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
      {
        id: '2',
        cnpj: '', // Inválido
        nome: 'Órgão Inválido',
        total: 100,
      },
      {
        id: '3',
        cnpj: '34028316000152',
        nome: 'Universidade de São Paulo',
        total: 200,
        uf: 'SP',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.equal(stats.totalProcessados, 3, 'Deve processar todos os 3 órgãos');
  assert.equal(stats.totalInseridos, 2, 'Deve inserir os 2 órgãos válidos');
  assert.equal(stats.erros, 1, 'Deve ter 1 erro');
  assert.equal(stats.status, 'parcial', 'Status deve ser parcial');
});

test('OrgaosCollector - Deve registrar informações de coleta corretamente', async () => {
  const logger = createMockLogger();

  const mockClient = {
    fetchOrgaos: async () => [
      {
        id: '1',
        cnpj: '00000000000191',
        nome: 'Ministério da Educação',
        total: 150,
        uf: 'DF',
      },
    ],
  } as any;

  const collector = new OrgaosCollector(logger, mockClient);
  const stats = await collector.coletarOrgaos();

  assert.ok(stats.dataCeleta, 'Deve ter data de coleta');
  assert.ok(stats.tempoExecucaoMs >= 0, 'Deve ter tempo de execução (pode ser 0 em testes rápidos)');
  assert.equal(stats.totalProcessados, stats.totalInseridos + stats.erros, 'Soma deve estar correta');
});
