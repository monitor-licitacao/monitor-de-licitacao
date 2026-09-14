import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePipelineKpis, filterPipelineRows, sortPipelineRows } from './server/lib/pipeline/kpis.js';
import type { PipelineItemRow } from './server/lib/pipeline/types.js';

function row(partial: Partial<PipelineItemRow> & Pick<PipelineItemRow, 'id' | 'status'>): PipelineItemRow {
  return {
    tenant_id: 1,
    contratacao_id: null,
    numero_controle_pncp: '03612122000127-1-000026/2026',
    portal: 'PNCP',
    orgao_cnpj: '03612122000127',
    orgao_razao_social: 'SESC CE',
    objeto_compra: 'Equipamentos',
    modalidade_nome: 'Pregão',
    valor_total_estimado: 100000,
    data_abertura_proposta: '2026-01-01T00:00:00.000Z',
    data_encerramento_proposta: '2026-02-01T00:00:00.000Z',
    uf_sigla: 'CE',
    vencedor: false,
    arquivada: false,
    source_record_id: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

test('kpis — fixture de 6 linhas', () => {
  const rows = [
    row({ id: '1', status: 'SELECIONADA', valor_total_estimado: 100 }),
    row({ id: '2', status: 'RECEBENDO_PROPOSTA', valor_total_estimado: 200 }),
    row({ id: '3', status: 'FASE_LANCE', valor_total_estimado: 300 }),
    row({ id: '4', status: 'HOMOLOGADA', vencedor: true, valor_total_estimado: 400 }),
    row({ id: '5', status: 'HOMOLOGADA', vencedor: false, valor_total_estimado: 500 }),
    row({ id: '6', status: 'CANCELADA', valor_total_estimado: 600 }),
  ];

  const kpis = computePipelineKpis(rows);
  assert.equal(kpis.total, 6);
  assert.equal(kpis.emDisputa, 2);
  assert.equal(kpis.homologadas, 1);
  assert.equal(kpis.perdidas, 1);
  assert.equal(kpis.ativas, 3);
  assert.equal(kpis.valorPipeline, 600);
});

test('kpis — filtro arquivadas e busca', () => {
  const rows = [
    row({ id: '1', status: 'SELECIONADA', arquivada: false, orgao_razao_social: 'SESC CE' }),
    row({ id: '2', status: 'ANALISE', arquivada: true, orgao_razao_social: 'Outro' }),
  ];
  const active = filterPipelineRows(rows, { arquivadas: '0' });
  assert.equal(active.length, 1);
  assert.equal(active[0].id, '1');

  const searched = filterPipelineRows(rows, { arquivadas: 'all', q: 'sesc' });
  assert.equal(searched.length, 1);
});

test('kpis — ordenação por encerramento', () => {
  const rows = [
    row({ id: 'late', status: 'SELECIONADA', data_encerramento_proposta: '2026-12-01T00:00:00.000Z' }),
    row({ id: 'early', status: 'SELECIONADA', data_encerramento_proposta: '2026-01-01T00:00:00.000Z' }),
  ];
  const sorted = sortPipelineRows(rows);
  assert.equal(sorted[0].id, 'early');
});
