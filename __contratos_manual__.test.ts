import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripCnpj } from './server/lib/contratos/persist.js';

function validateManualInput(input: {
  orgao_cnpj?: string;
  objeto_contrato?: string;
  numero_contrato_empenho?: string;
}): string | null {
  const orgao = stripCnpj(input.orgao_cnpj ?? '');
  if (orgao.length !== 14) return 'Informe o CNPJ do órgão contratante.';
  if (!input.objeto_contrato?.trim() && !input.numero_contrato_empenho?.trim()) {
    return 'Informe o objeto ou o número do contrato.';
  }
  return null;
}

function sumItens(itens: { quantidade?: number; valor_unitario?: number; valor_total?: number }[]) {
  return itens.reduce((acc, item) => {
    const qtd = item.quantidade ?? 0;
    const unit = item.valor_unitario ?? 0;
    return acc + (item.valor_total ?? qtd * unit);
  }, 0);
}

test('manual — CNPJ obrigatório', () => {
  assert.equal(validateManualInput({ orgao_cnpj: '123', objeto_contrato: 'x' }), 'Informe o CNPJ do órgão contratante.');
  assert.equal(validateManualInput({ orgao_cnpj: '03612122000127', objeto_contrato: 'x' }), null);
});

test('manual — objeto ou número', () => {
  assert.equal(
    validateManualInput({ orgao_cnpj: '03612122000127' }),
    'Informe o objeto ou o número do contrato.',
  );
  assert.equal(validateManualInput({ orgao_cnpj: '03612122000127', numero_contrato_empenho: '045/2026' }), null);
});

test('manual — soma de itens', () => {
  const total = sumItens([
    { quantidade: 2, valor_unitario: 100 },
    { quantidade: 1, valor_unitario: 50, valor_total: 55 },
  ]);
  assert.equal(total, 255);
});
