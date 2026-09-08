import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateToBR,
  formatDateTimeToBR,
  formatCurrencyBRL
} from './src/utils/muralFormatters.js';
import {
  STATUS_FAMILIES,
  STATUS_FAMILY_LABELS
} from './src/types/mural.js';
import {
  GOLDEN_PROCESS_76,
  getMuralProcessDetail,
  listMuralCards
} from './server/lib/muralData.js';
import { statusCatalogRepository } from './server/lib/statusCatalog.js';

test('Frontend UI Formatter: honest dates and currency without fake data', () => {
  // Date format checks
  assert.equal(formatDateToBR('2026-03-01T09:00:00Z'), '01/03/2026');
  assert.equal(formatDateToBR('07/08/2026 09:30'), '07/08/2026');
  assert.equal(formatDateToBR(null), null);
  assert.equal(formatDateToBR(''), null);
  assert.equal(formatDateToBR(undefined), null);

  // DateTime format checks
  assert.equal(formatDateTimeToBR('07/08/2026 09:30'), '07/08/2026 09:30');
  assert.equal(formatDateTimeToBR(null), null);

  // Currency format checks
  assert.equal(formatCurrencyBRL(null), null);
  assert.equal(formatCurrencyBRL(undefined), null);
  assert.ok(formatCurrencyBRL(6605.39)?.includes('6.605,39'));
});

test('Frontend UI Spec: 5 status families configured with correct labels', () => {
  assert.equal(STATUS_FAMILIES.length, 5);
  assert.deepEqual(STATUS_FAMILIES, [
    'ProcessoDeContratacao',
    'ProcessosPresenciais',
    'CotacaoDeOrcamento',
    'PregaoEletronico',
    'CompraDireta'
  ]);

  assert.equal(STATUS_FAMILY_LABELS.ProcessoDeContratacao, 'Processo de Contratação');
  assert.equal(STATUS_FAMILY_LABELS.ProcessosPresenciais, 'Processos Presenciais');
  assert.equal(STATUS_FAMILY_LABELS.CotacaoDeOrcamento, 'Cotação de Orçamento');
  assert.equal(STATUS_FAMILY_LABELS.PregaoEletronico, 'Pregão Eletrônico');
  assert.equal(STATUS_FAMILY_LABELS.CompraDireta, 'Compra Direta');
});

test('Frontend UI Spec: Mural Cards list returns valid Card MVP payload', async () => {
  const cards = await listMuralCards();
  assert.ok(cards.length > 0, 'Deve retornar ao menos um card no mural');

  const card76 = cards.find(c => c.codigo === '76');
  assert.ok(card76, 'Card 76 deve estar na listagem');
  assert.equal(card76?.codigo, '76');
  assert.equal(card76?.numero_processo, '000010901-2/2026');
  assert.equal(card76?.unidade, 'B 077 - SEST - MARABA/PA');
  assert.equal(card76?.modalidade, 'Pregão Eletrônico');
  assert.equal(card76?.status_normalizado.label, 'Homologado');
  assert.equal(card76?.status_normalizado.is_valid, true);
  assert.equal(card76?.fonte_confirmada, true);
  assert.ok(card76?.link_canonico.startsWith('http'));
});

test('Frontend UI Spec: Golden Process 76 detail v2 contracts and honest totals', async () => {
  const detail76 = await getMuralProcessDetail('76');
  assert.ok(detail76);

  // 1. Resumo
  assert.equal(detail76?.resumo.codigo, '76');
  assert.equal(detail76?.resumo.numero_processo, '000010901-2/2026');
  assert.equal(detail76?.resumo.edital, 'PG 002/2026');
  assert.equal(detail76?.resumo.modalidade, 'Pregão Eletrônico');
  assert.equal(detail76?.resumo.fase, 'Homologação');
  assert.equal(detail76?.resumo.situacao, 'Homologado');
  assert.equal(detail76?.resumo.email_contato, 'licitacao.b077@sestsenat.org.br');
  assert.equal(detail76?.resumo.status_normalizado.family, 'PregaoEletronico');
  assert.equal(detail76?.resumo.status_normalizado.code, 'HOMOLOGADO');

  // Honest totals: valor_estimado exists, total_homologado is null (must not invent fake sum)
  assert.equal(detail76?.resumo.valor_estimado, 6605.39);
  assert.equal(detail76?.resumo.total_homologado, null);

  // 2. Itens (12 itens with ranking)
  assert.equal(detail76?.itens.length, 12);
  const item1 = detail76?.itens[0];
  assert.equal(item1?.numero_item, 1);
  assert.equal(item1?.quantidade, 1);
  assert.equal(item1?.unidade, 'KIT');
  assert.ok(item1?.ranking && item1.ranking.length > 0);
  assert.equal(item1?.ranking?.[0].posicao, 1);
  assert.equal(item1?.ranking?.[0].empresa, 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA');

  // 3. Anexos (grouped by folder)
  assert.ok(detail76?.anexos.length! >= 5);
  const grupos = new Set(detail76?.anexos.map(a => a.grupo));
  assert.ok(grupos.has('Processo'));
  assert.ok(grupos.has('Proposta'));
  assert.ok(grupos.has('Habilitação'));

  // 4. Historico
  assert.ok(detail76?.historico.length! >= 3);
});

test('Frontend UI Spec: Status Catalog CRUD verification', async () => {
  const counts = await statusCatalogRepository.getFamilyCounts();
  assert.equal(counts.ProcessoDeContratacao.expected, 13);
  assert.equal(counts.ProcessosPresenciais.expected, 17);
  assert.equal(counts.CotacaoDeOrcamento.expected, 7);
  assert.equal(counts.PregaoEletronico.expected, 36);
  assert.equal(counts.CompraDireta.expected, 18);

  const pregaoItems = await statusCatalogRepository.getAll({ family: 'PregaoEletronico' });
  assert.equal(pregaoItems.length, 36);
  const homologado = pregaoItems.find(i => i.code === 'HOMOLOGADO');
  assert.ok(homologado);
  assert.equal(homologado?.label, 'Homologado');
});
