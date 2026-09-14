import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVigenciaExpectativa,
  vigenciaExpectativaLabel,
  vigenciaPendente,
} from './server/lib/contratos/vigencia-policy.js';

test('vigencia policy — preenchida quando datas informadas', () => {
  assert.equal(
    resolveVigenciaExpectativa({
      dataVigenciaInicio: '2026-01-01',
      dataVigenciaFim: '2026-12-31',
    }),
    'preenchida',
  );
});

test('vigencia policy — anulada → nao_aplicavel', () => {
  assert.equal(
    resolveVigenciaExpectativa({ situacao: 'Contratação Anulada' }),
    'nao_aplicavel',
  );
});

test('vigencia policy — SRP → aguardando_ata', () => {
  assert.equal(
    resolveVigenciaExpectativa({ srp: true }),
    'aguardando_ata',
  );
});

test('vigencia policy — instrumento Edital → aguardando_contrato', () => {
  assert.equal(
    resolveVigenciaExpectativa({
      instrumentoObrigatoriedadeEncerramento: 'Obrigatória',
      instrumentoNome: 'Edital',
    }),
    'aguardando_contrato',
  );
});

test('vigencia policy — labels e pendência', () => {
  assert.equal(vigenciaExpectativaLabel('aguardando_contrato'), 'Aguardando contrato PNCP');
  assert.equal(vigenciaPendente('aguardando_ata'), true);
  assert.equal(vigenciaPendente('preenchida'), false);
});
