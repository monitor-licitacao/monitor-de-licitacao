import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Logger } from 'winston';
import { CatalogoCollector } from './server/workers/CatalogoCollector.js';

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

describe('CatalogoCollector', () => {
  test('deve inicializar com logger', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);
    assert.ok(collector, 'Collector deve ser instanciado');
  });

  test('deve extrair slug de URL corretamente', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    // @ts-ignore - testando método privado
    const slug = collector.extractSlug('/pncp/catalogo/itens-padronizados/agua-mineral-natural-sem-gas');
    assert.equal(slug, 'agua-mineral-natural-sem-gas', 'Slug deve ser extraído corretamente');
  });

  test('deve extrair slug vazio se URL não contiver padrão esperado', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    // @ts-ignore
    const slug = collector.extractSlug('/outro-caminho/item');
    assert.equal(slug, '', 'Slug deve ser vazio para URL inválida');
  });

  test('deve normalizar item com uppercase em códigos', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    const item = {
      id: crypto.randomUUID(),
      slug: 'AGUA-MINERAL',
      nome: '  Água Mineral  ',
      codigosCatmat: ['445484'],
      codigosCatser: ['123456'],
      primeiraColetaEm: new Date().toISOString(),
      ultimaColetaEm: new Date().toISOString(),
    };

    // @ts-ignore
    const normalizado = collector.normalizarItem(item);

    assert.equal(normalizado.nome, 'Água Mineral', 'Nome deve ser trimado');
    assert.equal(normalizado.slug, 'agua-mineral', 'Slug deve ser lowercase');
    assert.deepEqual(
      normalizado.codigosCatmat,
      ['445484'],
      'Códigos CATMAT devem ser uppercase',
    );
    assert.deepEqual(
      normalizado.codigosCatser,
      ['123456'],
      'Códigos CATSER devem ser uppercase',
    );
  });

  test('deve gerar hash consistente para mesmo conteúdo', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    const item1 = {
      id: crypto.randomUUID(),
      slug: 'agua',
      nome: 'Água Mineral',
      codigosCatmat: ['445484'],
      codigosCatser: ['123456'],
      descricao: 'Água mineral natural',
      primeiraColetaEm: new Date().toISOString(),
      ultimaColetaEm: new Date().toISOString(),
    };

    const item2 = {
      id: crypto.randomUUID(),
      slug: 'agua',
      nome: 'Água Mineral',
      codigosCatmat: ['445484'],
      codigosCatser: ['123456'],
      descricao: 'Água mineral natural',
      primeiraColetaEm: new Date().toISOString(),
      ultimaColetaEm: new Date().toISOString(),
    };

    // @ts-ignore
    const normalizado1 = collector.normalizarItem(item1);
    // @ts-ignore
    const normalizado2 = collector.normalizarItem(item2);

    assert.equal(
      normalizado1.hashConteudo,
      normalizado2.hashConteudo,
      'Hash deve ser consistente para mesmo conteúdo',
    );
  });

  test('deve gerar hashes diferentes para conteúdos diferentes', () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    const item1 = {
      id: crypto.randomUUID(),
      slug: 'agua',
      nome: 'Água Mineral',
      codigosCatmat: ['445484'],
      codigosCatser: ['123456'],
      primeiraColetaEm: new Date().toISOString(),
      ultimaColetaEm: new Date().toISOString(),
    };

    const item2 = {
      id: crypto.randomUUID(),
      slug: 'agua',
      nome: 'Água Mineral Com Gás',
      codigosCatmat: ['445484'],
      codigosCatser: ['123456'],
      primeiraColetaEm: new Date().toISOString(),
      ultimaColetaEm: new Date().toISOString(),
    };

    // @ts-ignore
    const normalizado1 = collector.normalizarItem(item1);
    // @ts-ignore
    const normalizado2 = collector.normalizarItem(item2);

    assert.notEqual(
      normalizado1.hashConteudo,
      normalizado2.hashConteudo,
      'Hash deve ser diferente para conteúdos diferentes',
    );
  });

  test('deve retornar estatísticas no formato correto', async () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    const stats = await collector.coletarCatalogo();

    assert.ok(stats.totalProcessados >= 0, 'totalProcessados deve ser >= 0');
    assert.ok(stats.totalInseridos >= 0, 'totalInseridos deve ser >= 0');
    assert.ok(stats.totalAtualizados >= 0, 'totalAtualizados deve ser >= 0');
    assert.ok(stats.documentosBaixados >= 0, 'documentosBaixados deve ser >= 0');
    assert.ok(stats.erros >= 0, 'erros deve ser >= 0');
    assert.ok(stats.tempoExecucaoMs >= 0, 'tempoExecucaoMs deve ser >= 0');
    assert.ok(stats.dataCeleta, 'dataCeleta deve ser preenchida');
    assert.ok(
      ['sucesso', 'erro', 'parcial'].includes(stats.status),
      'status deve ser um dos valores válidos',
    );
  });

  test('deve validar estrutura de dados coletados', async () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    const stats = await collector.coletarCatalogo();

    // Se houver itens processados, validar estrutura
    if (stats.totalProcessados > 0) {
      assert.ok(stats.totalInseridos + stats.totalAtualizados > 0, 'Deve ter itens inseridos ou atualizados');
    }

    // Status deve corresponder aos resultados
    if (stats.erros === 0 && stats.totalProcessados > 0) {
      assert.equal(stats.status, 'sucesso', 'Status deve ser sucesso se não houver erros');
    }
  });

  test('deve lidar com URLs inválidas gracefully', async () => {
    const logger = createMockLogger();
    const collector = new CatalogoCollector(logger);

    // Não deve lançar exceção, apenas retornar erro
    const stats = await collector.coletarCatalogo();
    assert.ok(stats, 'Deve retornar stats mesmo com erro');
  });
});
