import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compareContratacaoPncpVsComprasGov } from './server/lib/compras-gov/compare-pncp.js';
import {
  alignItemByNumero,
  PASSEX_GOLDEN,
  shortTitle,
} from './server/lib/compras-gov/compare-passex.js';
import type { ComprasGovContratacao14133Dto, ComprasGovPagedResponse } from './server/lib/compras-gov/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, 'server/lib/compras-gov/fixtures/passex-19732');

function load<T>(name: string): T {
  const raw = JSON.parse(readFileSync(join(FIX, name), 'utf8')) as { body: T };
  return raw.body;
}

test('Passex Golden — metadados canônicos', () => {
  assert.equal(PASSEX_GOLDEN.totalItens, 17);
  assert.equal(PASSEX_GOLDEN.idCompra, '16036005002242026');
});

test('Passex Golden — PNCP 17 itens com valores e NCM', () => {
  const itens = load<Array<{ numeroItem: number; descricao?: string; orcamentoSigiloso: boolean; valorUnitarioEstimado: number; ncmNbsCodigo?: string }>>('pncp-itens.json');
  assert.equal(itens.length, 17);
  assert.ok(itens.every((i) => i.orcamentoSigiloso === false));
  assert.ok(itens.every((i) => i.valorUnitarioEstimado > 0));
  assert.ok(itens.some((i) => i.ncmNbsCodigo === '90181980'));
  const item9 = itens.find((i) => i.numeroItem === 9)!;
  assert.match(item9.descricao, /esteira elétrica/i);
  assert.equal(item9.valorUnitarioEstimado, 11600);
});

test('Passex Golden — soma PNCP = total Compras.gov Dados Abertos', () => {
  const itens = load<Array<{ valorTotal: number }>>('pncp-itens.json');
  const total = itens.reduce((s, i) => s + i.valorTotal, 0);
  assert.ok(Math.abs(total - PASSEX_GOLDEN.valorTotalEstimado) < 0.01);
  const cg = load<ComprasGovPagedResponse<ComprasGovContratacao14133Dto>>('dados-abertos-contratacao.json').resultado[0];
  assert.ok(Math.abs((cg.valorTotalEstimado ?? 0) - total) < 0.01);
});

test('Passex Golden — Compras.gov fase-externa página 0 alinha valores com PNCP', () => {
  const pncpItens = load<Array<{ numeroItem: number; descricao: string; valorUnitarioEstimado: number; valorTotal: number; ncmNbsCodigo?: string }>>('pncp-itens.json');
  const cnWrap = JSON.parse(readFileSync(join(FIX, 'comprasnet-itens-p0.json'), 'utf8')) as {
    body: Array<{ numero: number; descricao: string; valorEstimadoUnitario: number; valorEstimadoTotal: number }>;
    registerCount: string;
  };
  assert.equal(cnWrap.registerCount, '17');
  assert.equal(cnWrap.body.length, 10);

  for (const cn of cnWrap.body) {
    const pncp = pncpItens.find((i) => i.numeroItem === cn.numero)!;
    const aligned = alignItemByNumero(pncp, cn);
    assert.equal(aligned.valorUnitMatch, true, `item ${cn.numero} unit`);
    assert.equal(aligned.valorTotalMatch, true, `item ${cn.numero} total`);
    assert.equal(aligned.pncpDescricaoLonger, true, `item ${cn.numero} desc`);
    assert.ok(shortTitle(pncp.descricao).toLowerCase().startsWith(aligned.comprasNetDescricaoCurta!.toLowerCase().slice(0, 8)));
  }
});

test('Passex Golden — PNCP suficiente; Dados Abertos itens vazios', () => {
  const compra = load<Record<string, unknown>>('pncp-compra.json');
  const cg = load<ComprasGovPagedResponse<ComprasGovContratacao14133Dto>>('dados-abertos-contratacao.json').resultado[0];
  const report = compareContratacaoPncpVsComprasGov(compra as never, cg, {
    pncp: 17,
    comprasGov: 0,
    note: 'Dados Abertos 2.1 vazio — ingest itens via PNCP Classe B',
  });
  assert.equal(report.itemCoverage.pncpItemCount, 17);
  assert.equal(report.itemCoverage.comprasGovItemCount, 0);
  assert.ok(report.comparisons.some((c) => c.field === 'numeroControlePNCP' && c.status === 'match'));
});
