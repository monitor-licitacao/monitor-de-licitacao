import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePncpListHit,
  shouldPersistForTenant,
} from './server/lib/contratos/pncp-sync.js';

test('pncp sync — filtra por tenant_party', () => {
  const tenant = new Set(['62188748000117']);
  assert.equal(shouldPersistForTenant('62188748000117', tenant), true);
  assert.equal(shouldPersistForTenant('00000000000191', tenant), false);
  assert.equal(shouldPersistForTenant(null, tenant), false);
});

test('pncp sync — normaliza hit mínimo', () => {
  const norm = normalizePncpListHit(
    {
      numeroControlePNCP: '03612122000127-1-000026/2026',
      orgaoEntidade: { cnpj: '03612122000127', razaoSocial: 'SESC CE' },
      niFornecedor: '62188748000117',
      nomeRazaoSocialFornecedor: 'Vectra Cargo',
      objetoContrato: 'Equipamentos fitness',
      valorGlobal: 150000,
      dataVigenciaInicio: '20260101',
      dataVigenciaFim: '20261231',
      uf: 'CE',
      numeroContratoEmpenho: '045/2026',
    },
    'contrato',
  );
  assert.ok(norm);
  assert.equal(norm!.fornecedorCnpj, '62188748000117');
  assert.equal(norm!.orgaoCnpj, '03612122000127');
  assert.equal(norm!.vigenciaFim, '2026-12-31');
});
