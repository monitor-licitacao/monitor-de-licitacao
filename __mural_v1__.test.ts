import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SISTEMA_S_URLS,
  isRejectedSistemaSUrl,
  CANONICAL_URL_REWRITE_RULES
} from './server/lib/sistemaSUrls.js';
import {
  statusCatalogRepository,
  STATUS_FAMILIES,
  INITIAL_STATUS_CATALOG_SEED
} from './server/lib/statusCatalog.js';
import {
  mapRawDumpToCanonical,
  toCardMVP,
  RAW_DUMP_FIELD_MAPPING
} from './server/lib/muralMapping.js';
import {
  getMuralProcessDetail,
  listMuralCards,
  registerMuralProcess,
  GOLDEN_PROCESS_76
} from './server/lib/muralData.js';

test('1) Desmock URLs (Sistema S): canonical URLs and rejection logic', () => {
  assert.equal(
    CANONICAL_SISTEMA_S_URLS.SEST_SENAT,
    'https://compras.sestsenat.org.br/portal/Mural.aspx'
  );
  assert.equal(
    CANONICAL_SISTEMA_S_URLS.SESC_DN,
    'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx'
  );

  // Rejeição de licitacoes.sesc.com.br
  const r1 = isRejectedSistemaSUrl('https://licitacoes.sesc.com.br/portal/editais');
  assert.equal(r1.rejected, true);
  assert.equal(r1.canonicalSuggestion, CANONICAL_SISTEMA_S_URLS.SESC_DN);

  // Rejeição de sestsenat.org.br/licitacoes-e-compras
  const r2 = isRejectedSistemaSUrl('https://sestsenat.org.br/licitacoes-e-compras');
  assert.equal(r2.rejected, true);
  assert.equal(r2.canonicalSuggestion, CANONICAL_SISTEMA_S_URLS.SEST_SENAT);

  // Rejeição de PDFs inventados em /editais/*.pdf para sesc/sestsenat
  const r3 = isRejectedSistemaSUrl('https://licitacoes.sesc.com.br/editais/2026/CC-042-2026.pdf');
  assert.equal(r3.rejected, true);

  const r4 = isRejectedSistemaSUrl('https://sestsenat.org.br/editais/2026/PE-078-2026.pdf');
  assert.equal(r4.rejected, true);

  // URL canônica válida não é rejeitada
  const rValid = isRejectedSistemaSUrl(CANONICAL_SISTEMA_S_URLS.SEST_SENAT);
  assert.equal(rValid.rejected, false);
});

test('2) Explicit card field mapping: mislabeled raw dump keys -> canonical & card MVP', () => {
  const rawMislabeledRow = {
    'CÓDIGO': '76',
    'Chamamento público': '000010901-2/2026',
    'PROCESSO': 'SEST SENAT - DN',
    'Linha de fornecimento': 'Contratação de empresa especializada em fornecimento de equipamentos esportivos',
    'Edital': 'Pregão Eletrônico',
    'UNIDADE COMPRADORA': '2026-03-01T09:00:00Z', // Mislabeled datetime (início propostas)
    'OBJETO': '2026-03-15T18:00:00Z', // Mislabeled datetime (término propostas)
    'Início das inscrições': '2026-02-20T08:00:00Z',
    'STATUS': 'Em andamento'
  };

  const canonical = mapRawDumpToCanonical(rawMislabeledRow, {
    link_canonico: 'https://compras.sestsenat.org.br/portal/Mural.aspx'
  });

  assert.equal(canonical.codigo, '76');
  assert.equal(canonical.numero_processo, '000010901-2/2026');
  assert.equal(canonical.unidade_compradora, 'SEST SENAT - DN');
  assert.equal(canonical.modalidade, 'Pregão Eletrônico');
  assert.equal(canonical.inicio_propostas, '2026-03-01T09:00:00Z');
  assert.equal(canonical.termino_propostas, '2026-03-15T18:00:00Z');
  assert.equal(canonical.inicio_inscricoes, '2026-02-20T08:00:00Z');
  assert.equal(canonical.link_canonico, CANONICAL_SISTEMA_S_URLS.SEST_SENAT);

  const card = toCardMVP(canonical, {
    family: 'PregaoEletronico',
    code: 'EM_ANDAMENTO',
    label: 'Em andamento'
  });

  assert.equal(card.codigo, '76');
  assert.equal(card.numero_processo, '000010901-2/2026');
  assert.equal(card.unidade, 'SEST SENAT - DN');
  assert.equal(card.datas.inicio_propostas, '2026-03-01T09:00:00Z');
  assert.equal(card.datas.termino_propostas, '2026-03-15T18:00:00Z');
  assert.equal(card.status_normalizado.label, 'Em andamento');
  assert.equal(card.status_normalizado.is_valid, true);
  assert.equal(card.fonte_confirmada, true);
});

test('3) Status catalog CRUD: 5 families (13, 17, 7, 36, 18 = 91 total) & fail-closed validation', async () => {
  const counts = await statusCatalogRepository.getFamilyCounts();
  assert.equal(counts.ProcessoDeContratacao.expected, 13);
  assert.equal(counts.ProcessosPresenciais.expected, 17);
  assert.equal(counts.CotacaoDeOrcamento.expected, 7);
  assert.equal(counts.PregaoEletronico.expected, 36);
  assert.equal(counts.CompraDireta.expected, 18);

  const total = Object.values(counts).reduce((acc, c) => acc + c.total, 0);
  assert.equal(total, 91, 'O catálogo deve possuir exatamente 91 status distribuídos nas 5 famílias');

  // Fail-closed validation for unknown status
  const validCheck = await statusCatalogRepository.validateStatusOnWrite(
    'PregaoEletronico',
    'HOMOLOGADO'
  );
  assert.equal(validCheck.valid, true);

  const invalidCheck = await statusCatalogRepository.validateStatusOnWrite(
    'PregaoEletronico',
    'STATUS_INVENTADO_FAKE'
  );
  assert.equal(invalidCheck.valid, false);
  assert.ok(invalidCheck.error?.includes('fail-closed'));

  // CRUD operations
  const created = await statusCatalogRepository.create({
    family: 'CotacaoDeOrcamento',
    code: 'TEST_CUSTOM_STATUS',
    label: 'Status de Teste Customizado',
    description: 'Criado durante teste unitário'
  });
  assert.ok(created.id);
  assert.equal(created.code, 'TEST_CUSTOM_STATUS');

  const updated = await statusCatalogRepository.update(created.id!, {
    label: 'Status de Teste Editado'
  });
  assert.equal(updated?.label, 'Status de Teste Editado');

  const deactivated = await statusCatalogRepository.deactivate(created.id!);
  assert.equal(deactivated?.active, false);
});

test('4) Golden process support: Processo 000010901-2/2026 / codigo 76 shaped for Frontend Design', async () => {
  const detail76 = await getMuralProcessDetail('76');
  assert.ok(detail76, 'Processo 76 deve existir');
  assert.equal(detail76?.resumo.codigo, '76');
  assert.equal(detail76?.resumo.numero_processo, '000010901-2/2026');
  assert.equal(detail76?.resumo.link_canonico, CANONICAL_SISTEMA_S_URLS.SEST_SENAT);

  // Resumo
  assert.equal(detail76?.resumo.codigo, '76');
  assert.equal(detail76?.resumo.numero_processo, '000010901-2/2026');
  assert.equal(detail76?.resumo.modalidade, 'Pregão Eletrônico');
  assert.equal(detail76?.resumo.status_normalizado.code, 'HOMOLOGADO');

  // Itens (12 itens reais sem inventar totais)
  assert.equal(detail76?.itens.length, 12);
  assert.equal(detail76?.itens[0].numero_item, 1);
  assert.equal(detail76?.itens[0].quantidade, 1);
  assert.ok(detail76?.itens[0].descricao.includes('KIT DE PUXADORES ANATÔMICOS'));
  assert.equal(detail76?.itens[0].ranking[0].empresa, 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA');

  // Anexos
  assert.ok(detail76?.anexos.length! >= 5);
  const editalAnexo = detail76?.anexos.find(a => a.tipo === 'PDF');
  assert.ok(editalAnexo);
  assert.equal(editalAnexo?.url_download, CANONICAL_SISTEMA_S_URLS.SEST_SENAT);

  // Detail query by processNumber
  const detailByNum = await getMuralProcessDetail('000010901-2/2026');
  assert.equal(detailByNum?.resumo.codigo, '76');

  // List mural cards returns golden process in Card MVP shape
  const cards = await listMuralCards();
  const card76 = cards.find(c => c.codigo === '76');
  assert.ok(card76);
  assert.equal(card76?.numero_processo, '000010901-2/2026');
  assert.equal(card76?.link_canonico, CANONICAL_SISTEMA_S_URLS.SEST_SENAT);
});
