import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGruposWithItens,
  normalizeContratacaoItem,
  parseItemDescricao,
} from './server/lib/compras-gov/normalize-contratacao-itens.js';

const GRAVITON_DESC =
  'Aparelho / Equipamento Para Condicionamento Físico tipo: graviton, material: aço, aplicação: condicionamento físico, caracteristicas adicionais: regulagem barras, regulagem de carga "MAQUINA DE ABDOMINAL ARTICULADO\nDIMENSÃO DO PRODUTO: 1180 X 1360 X 1520 MM"';

test('parseItemDescricao — extrai tipo graviton e nome comercial', () => {
  const parsed = parseItemDescricao(GRAVITON_DESC);
  assert.equal(parsed.tipoCatalogo, 'graviton');
  assert.ok(parsed.nomeComercial?.includes('MAQUINA DE ABDOMINAL'));
  assert.ok(parsed.descricaoResumida.includes('Aparelho / Equipamento'));
});

test('normalizeContratacaoItem — orçamento sigiloso e hint catálogo', () => {
  const item = normalizeContratacaoItem({
    numero_item: 1,
    descricao: GRAVITON_DESC,
    quantidade: 8,
    unidade_medida: 'Unidade',
    valor_unitario_estimado: 0,
    valor_total_estimado: 0,
    situacao: 'Anulado/Revogado/Cancelado',
    codigo_catalogo: null,
    catalogo_tipo: null,
    criterio_julgamento: 'Menor preço',
    beneficio_me_epp: 'Sem benefício',
    raw_json: { orcamentoSigiloso: true, criterioJulgamentoNome: 'Menor preço' },
  });
  assert.equal(item.orcamento_sigiloso, true);
  assert.equal(item.tipo_catalogo, 'graviton');
  assert.equal(item.catalogo_hint, 'tipo: graviton');
});

test('buildGruposWithItens — SESC G1/G2', () => {
  const itens = Array.from({ length: 14 }, (_, i) =>
    normalizeContratacaoItem({
      numero_item: i + 1,
      descricao: i < 8 ? GRAVITON_DESC : 'Bicicleta Ergométrica tipo: magnética',
      quantidade: 1,
      unidade_medida: 'Unidade',
      valor_unitario_estimado: 0,
      valor_total_estimado: 0,
      situacao: 'Anulado',
      codigo_catalogo: null,
      catalogo_tipo: null,
      criterio_julgamento: null,
      beneficio_me_epp: null,
      raw_json: { orcamentoSigiloso: true },
    }),
  );

  const { grupos, itens_avulsos } = buildGruposWithItens('03612122000127-1-000026/2026', itens);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0]!.identificador, 'G1');
  assert.equal(grupos[0]!.itens.length, 8);
  assert.equal(grupos[1]!.identificador, 'G2');
  assert.equal(grupos[1]!.itens.length, 5);
  assert.equal(itens_avulsos.length, 1);
  assert.equal(itens_avulsos[0]!.numero_item, 14);
  assert.ok(grupos[0]!.valor_estimado_total != null);
});
