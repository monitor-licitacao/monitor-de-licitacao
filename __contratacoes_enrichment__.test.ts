import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComprasGovUrl,
  buildPncpAppUrl,
  getContratacaoDetail,
  getContratacaoEnrichment,
  listContratacoes,
  resolveEnrichmentBadge,
} from './server/lib/compras-gov/enrichment-api.js';
import { closeComprasGovPersistPool } from './server/lib/compras-gov/persist.js';
import { planEnrichment } from './server/lib/compras-gov/enrichment-policy.js';

const hasDb = Boolean(process.env.DATABASE_URL);
const SESC_CONTROLE = '03612122000127-1-000026/2026';

test('enrichment-api — URLs oficiais SESC', () => {
  assert.equal(
    buildPncpAppUrl('03612122000127', 2026, 26),
    'https://pncp.gov.br/app/editais/03612122000127/2026/26',
  );
  const cg = buildComprasGovUrl(
    '45102305000062026',
    'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=45102305000062026',
  );
  assert.ok(cg?.includes('45102305000062026'));
});

test('enrichment-api — badge SESC parcial', () => {
  const plan = planEnrichment({
    mode: 'contratacao',
    pncpItemCount: 14,
    items: Array.from({ length: 14 }, () => ({
      valorUnitarioEstimado: 0,
      valorTotalEstimado: 0,
      orcamentoSigiloso: true,
    })),
    orcamentoSigilosoCodigo: 3,
    linkSistemaOrigem: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=45102305000062026',
  });
  assert.equal(resolveEnrichmentBadge(plan), 'ENRICHMENT_PARTIAL');
});

test('enrichment-api — list contratacoes', { skip: !hasDb }, async () => {
  const items = await listContratacoes(10);
  assert.ok(items.length >= 1);
  const sesc = items.find((i) => i.numeroControlePncp === SESC_CONTROLE);
  assert.ok(sesc);
  assert.equal(sesc!.pncpItemCount, 14);
});

test('enrichment-api — GET detail SESC (formato Mural)', { skip: !hasDb }, async () => {
  const items = await listContratacoes(10);
  const sesc = items.find((i) => i.numeroControlePncp === SESC_CONTROLE);
  assert.ok(sesc);

  const detail = await getContratacaoDetail(sesc!.id);
  assert.ok(detail);
  assert.ok(detail!.resumo);
  assert.ok(detail!.resumo.numero_controle_pncp === SESC_CONTROLE);
  assert.equal(detail!.itens.length, 14);
  assert.equal(detail!.grupos.length, 2);
  assert.equal(detail!.grupos[0]!.identificador, 'G1');
  assert.equal(detail!.grupos[0]!.itens.length, 8);
  assert.equal(detail!.grupos[1]!.itens.length, 5);
  assert.equal(detail!.itens_avulsos.length, 1);
  assert.equal(detail!.itens_avulsos[0]!.numero_item, 14);
  assert.ok(detail!.grupos[0]!.itens[0]!.tipo_catalogo === 'graviton');
  assert.equal(detail!.grupos[0]!.itens[0]!.parsed_facets?.tipo, 'graviton');
  assert.equal(detail!.grupos[0]!.itens[0]!.catalog_match_method, 'PNCP_FACET_ONLY');
  assert.ok(Array.isArray(detail!.anexos));
  assert.ok(Array.isArray(detail!.historico));
  assert.ok(detail!.enriquecimento.badge === 'ENRICHMENT_PARTIAL');
  assert.ok(detail!.resumo.link_pncp.includes('pncp.gov.br'));
});

test('enrichment-api — GET enriquecimento SESC', { skip: !hasDb }, async () => {
  const items = await listContratacoes(10);
  const sesc = items.find((i) => i.numeroControlePncp === SESC_CONTROLE);
  assert.ok(sesc);

  const enrichment = await getContratacaoEnrichment(sesc!.id);
  assert.ok(enrichment);
  assert.equal(enrichment!.numeroControlePncp, SESC_CONTROLE);
  assert.equal(enrichment!.idCompra, '45102305000062026');
  assert.equal(enrichment!.pncpItemCount, 14);
  assert.equal(enrichment!.badge, 'ENRICHMENT_PARTIAL');
  assert.ok(enrichment!.links.pncp.includes('pncp.gov.br'));
  assert.ok(enrichment!.links.comprasGov?.includes('45102305000062026'));
  assert.ok(enrichment!.decisions.includes('LINK_COMPRASNET_ONLY'));
  assert.ok(enrichment!.decisions.includes('CG_METADATA_ONLY'));
});

test.after(async () => {
  await closeComprasGovPersistPool();
});
