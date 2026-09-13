import { test } from 'node:test';
import assert from 'node:assert/strict';
import sescItens from './server/lib/pncp/fixtures/sesc-ce-026-2026/itens.json' with { type: 'json' };
import {
  parsePncpFacets,
  resolveCatalogMatchMethod,
} from './server/lib/pncp/parse-pncp-facets.js';

const GRAVITON_DESC =
  'Aparelho / Equipamento Para Condicionamento Físico tipo: graviton, material: aço, aplicação: condicionamento físico, caracteristicas adicionais: regulagem barras, regulagem de carga "MAQUINA DE ABDOMINAL ARTICULADO"';

test('parsePncpFacets — SESC item 1 graviton', () => {
  const item1 = (sescItens.body as { descricao: string }[])[0]!;
  const facets = parsePncpFacets(item1.descricao);
  assert.equal(facets.tipo, 'graviton');
  assert.equal(facets.material, 'aço');
  assert.ok(facets.base_class?.includes('Condicionamento Físico'));
  assert.ok(facets.nome_comercial?.includes('MAQUINA DE ABDOMINAL'));
});

test('parsePncpFacets — item 10 magnética (G2)', () => {
  const item10 = (sescItens.body as { descricao: string }[])[9]!;
  const facets = parsePncpFacets(item10.descricao);
  assert.equal(facets.tipo, 'magnética');
  assert.notEqual(facets.tipo, 'graviton');
});

test('parsePncpFacets — fixture inline graviton', () => {
  const facets = parsePncpFacets(GRAVITON_DESC);
  assert.equal(facets.tipo, 'graviton');
  assert.equal(facets.aplicacao, 'condicionamento físico');
});

test('resolveCatalogMatchMethod — facet only', () => {
  assert.equal(
    resolveCatalogMatchMethod({
      facets: { tipo: 'graviton', base_class: 'Aparelho' },
    }),
    'PNCP_FACET_ONLY',
  );
});

test('resolveCatalogMatchMethod — PNCP direct', () => {
  assert.equal(
    resolveCatalogMatchMethod({
      catalogoCodigoItem: 268925,
      facets: {},
    }),
    'PNCP_DIRECT',
  );
});

test('resolveCatalogMatchMethod — NCM 8 dígitos', () => {
  assert.equal(
    resolveCatalogMatchMethod({
      ncmNbsCodigo: '90181980',
      facets: {},
    }),
    'NCM_HINT',
  );
});
