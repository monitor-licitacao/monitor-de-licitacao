import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNumerosSugeridos,
  filterItensByNumeros,
  flattenContratacaoItens,
  mapContratacaoItemToManualInput,
  resolveRegisterPrefillItens,
  sumItensNaoSigilosos,
  validateManualFromContratacao,
} from './server/lib/contratos/map-contratacao-items.js';
import type { ContratacaoItemRico } from './server/lib/compras-gov/normalize-contratacao-itens.js';

const sampleItem = (overrides: Partial<ContratacaoItemRico> = {}): ContratacaoItemRico => ({
  numero_item: 1,
  descricao_resumida: 'Switch 48 portas',
  descricao_detalhada: 'Switch gerenciável',
  nome_comercial: 'Switch Pro',
  quantidade: 2,
  unidade: 'UN',
  valor_unitario: 1000,
  valor_total: 2000,
  orcamento_sigiloso: false,
  criterio_julgamento: null,
  beneficio_me_epp: null,
  situacao: 'Ativo',
  material_ou_servico: 'material',
  codigo_catalogo: 261521,
  catalogo_tipo: 'CATMAT',
  ncm_nbs: null,
  tipo_catalogo: null,
  exigencia_conteudo_nacional: null,
  margem_preferencia: null,
  catalogo_hint: null,
  parsed_facets: null,
  catalog_match_method: null,
  preco_mercado: null,
  ...overrides,
});

test('manual v2 — validate contratacao_id obrigatório', () => {
  assert.equal(
    validateManualFromContratacao({ numero_contrato_empenho: '045/2026' }),
    'Selecione uma contratação de origem.',
  );
  assert.equal(
    validateManualFromContratacao({ contratacao_id: 'uuid', numero_contrato_empenho: '045/2026' }),
    null,
  );
});

test('manual v2 — buildNumerosSugeridos deduplica', () => {
  const numeros = buildNumerosSugeridos({
    numero_controle_pncp: '03612122000127-1-000026/2026',
    numero_processo: '000010901-2/2026',
    edital: '026/2026',
    numero_compra: '026/2026',
  });
  assert.ok(numeros.some((n) => n.tipo === 'pncp'));
  assert.ok(numeros.some((n) => n.tipo === 'processo'));
  assert.equal(numeros.filter((n) => n.valor === '026/2026').length, 1);
});

test('manual v2 — flattenContratacaoItens merge grupos + avulsos (SESC 026)', () => {
  const g1Items = [sampleItem({ numero_item: 1 }), sampleItem({ numero_item: 2 })];
  const g2Items = [sampleItem({ numero_item: 3 })];
  const avulso = sampleItem({ numero_item: 14, nome_comercial: 'BIKE SPINNING PROFISSIONAL' });
  const grupoBase = {
    orcamento_sigiloso: false,
    valor_estimado_total: null,
    tratamento_me_epp: null,
    motivo_anulacao: null,
    situacao_label: null,
  };
  const flat = flattenContratacaoItens({
    itens_avulsos: [avulso],
    grupos: [
      { identificador: 'G1', descricao: 'Grupo 1', item_numeros: [1, 2], itens: g1Items, ...grupoBase },
      { identificador: 'G2', descricao: 'Grupo 2', item_numeros: [3], itens: g2Items, ...grupoBase },
    ],
  });
  assert.equal(flat.length, 4);
  assert.ok(flat.some((i) => i.numero_item === 14));
  assert.ok(flat.some((i) => i.numero_item === 1));
});

test('manual v2 — flattenContratacaoItens fallback ALL sem avulsos', () => {
  const flat = flattenContratacaoItens({
    grupos: [
      {
        identificador: 'ALL',
        descricao: 'Todos os itens',
        item_numeros: [1],
        itens: [sampleItem()],
        orcamento_sigiloso: false,
        valor_estimado_total: null,
        tratamento_me_epp: null,
        motivo_anulacao: null,
        situacao_label: null,
      },
    ],
    itens_avulsos: [],
  });
  assert.equal(flat.length, 1);
  assert.equal(flat[0].numero_item, 1);
});

test('manual v2 — mapContratacaoItemToManualInput', () => {
  const mapped = mapContratacaoItemToManualInput(sampleItem());
  assert.equal(mapped.descricao, 'Switch Pro');
  assert.equal(mapped.quantidade, 2);
  assert.equal(mapped.catalogo_codigo_item, 261521);
  assert.equal(mapped.material_ou_servico, 'material');
});

test('manual v2 — sigiloso zera valores no mapper', () => {
  const mapped = mapContratacaoItemToManualInput(
    sampleItem({ orcamento_sigiloso: true, valor_unitario: 100, valor_total: 200 }),
  );
  assert.equal(mapped.valor_unitario, undefined);
  assert.equal(mapped.valor_total, undefined);
});

test('manual v2 — sumItensNaoSigilosos ignora sigiloso', () => {
  const total = sumItensNaoSigilosos([
    sampleItem({ valor_total: 2000 }),
    sampleItem({ numero_item: 2, orcamento_sigiloso: true, valor_total: 9999 }),
  ]);
  assert.equal(total, 2000);
});

test('manual v2 — filterItensByNumeros', () => {
  const itens = [sampleItem({ numero_item: 1 }), sampleItem({ numero_item: 2 })];
  const filtered = filterItensByNumeros(itens, [2]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].numero_item, 2);
});

test('manual v2 — resolveOrgaoCnpjFromContratacaoMeta fallback PNCP', async () => {
  const { resolveOrgaoCnpjFromContratacaoMeta } = await import('./server/lib/contratos/persist.js');
  assert.equal(
    resolveOrgaoCnpjFromContratacaoMeta({
      cnpj_orgao: '',
      numero_controle_pncp: '03612122000127-1-000026/2026',
    }),
    '03612122000127',
  );
  assert.equal(
    resolveOrgaoCnpjFromContratacaoMeta({
      cnpj_orgao: '03.612.122/0001-27',
      numero_controle_pncp: '03612122000127-1-000026/2026',
    }),
    '03612122000127',
  );
});

test('manual v2 — resolveRegisterPrefillItens G1 + item avulso', () => {
  const g1Items = [sampleItem({ numero_item: 1 }), sampleItem({ numero_item: 2 })];
  const g2Items = [sampleItem({ numero_item: 3 })];
  const avulso = sampleItem({ numero_item: 14, nome_comercial: 'BIKE SPINNING PROFISSIONAL' });
  const grupoBase = {
    orcamento_sigiloso: false,
    valor_estimado_total: null,
    tratamento_me_epp: null,
    motivo_anulacao: null,
    situacao_label: null,
  };
  const grupos = [
    { identificador: 'G1', descricao: 'Grupo 1', item_numeros: [1, 2], itens: g1Items, ...grupoBase },
    { identificador: 'G2', descricao: 'Grupo 2', item_numeros: [3], itens: g2Items, ...grupoBase },
  ];

  const g1Only = resolveRegisterPrefillItens(grupos, [avulso], 'G1');
  assert.equal(g1Only.length, 2);
  assert.ok(!g1Only.some((i) => i.numero_item === 14));

  const avulsosOnly = resolveRegisterPrefillItens(grupos, [avulso], 'AVULSOS');
  assert.equal(avulsosOnly.length, 1);
  assert.equal(avulsosOnly[0].numero_item, 14);

  const item14 = resolveRegisterPrefillItens(grupos, [avulso], 'ALL', 14);
  assert.equal(item14.length, 1);
  assert.equal(item14[0].numero_item, 14);
});
