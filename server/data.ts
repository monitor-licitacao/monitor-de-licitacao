import { Source, Edital, WhatsAppNotification, RetificationDiff, NCMConfigItem, SchedulerState } from '../src/types';

export const INITIAL_NCM_CONFIG: NCMConfigItem[] = [
  {
    code: '9506.91.00',
    description: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    keywords: [
      'esteira', 'esteira ergométrica', 'bicicleta ergométrica', 'estação de musculação',
      'halteres', 'anilhas', 'dumbbells', 'kettlebell', 'cross training', 'tatame',
      'espaldar', 'barra fixa', 'banco supino', 'leg press', 'polia', 'equipamento de ginástica',
      'academia ao ar livre', 'piso emborrachado academia', 'simulador de caminhada'
    ],
    isPrimary: true,
  },
  {
    code: '9506.99.00',
    description: 'Outros artigos e equipamentos para esportes ou jogos ao ar livre',
    keywords: ['trave de futebol', 'tabela de basquete', 'poste de voleibol', 'rede de proteção esportiva'],
    isPrimary: false,
  },
  {
    code: '9506.62.00',
    description: 'Bolas infláveis (futebol, basquete, vôlei)',
    keywords: ['bola de futebol', 'bola de basquete', 'bola de pilates', 'bola suíça'],
    isPrimary: false,
  }
];

export const INITIAL_SOURCES: Source[] = [
  // 1. API ComprasNet
  {
    id: 'src-comprasnet-01',
    name: 'ComprasNet Gov.br (API Federal & Municípios)',
    category: 'ComprasNet',
    type: 'API',
    uf: 'DF',
    city: 'Brasília (Nacional)',
    endpointOrUrl: 'https://comprasnet.gov.br/api/v1/licitacoes',
    selectorOrParams: '?ncm=9506.91.00&modalidade=concorrencia,pregao&status=aberta',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:00:00Z',
    latencyMs: 142,
    successRate: 99.4,
    totalCollected: 84,
    format: 'JSON',
    notes: 'Âncora de verdade para validação de NCM em campos estruturados (JSON oficial).'
  },

  // 2. Sistema S Nacional e Regionais
  {
    id: 'src-sesc-nac-01',
    name: 'SESC Departamento Nacional - Portal de Licitações',
    category: 'SESC',
    type: 'SCRAPER',
    uf: 'RJ',
    city: 'Rio de Janeiro (Nacional)',
    endpointOrUrl: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
    selectorOrParams: 'div.card-edital-sesc > table.tabela-itens tr.item-ncm',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:05:00Z',
    latencyMs: 412,
    successRate: 98.1,
    totalCollected: 29,
    format: 'HTML',
    notes: 'Regulamento de Licitações do SESC (Resolução 1.252/2012). Canonical Mural Paradigma SESC DN.'
  },
  {
    id: 'src-sesc-sp-01',
    name: 'SESC Regional São Paulo',
    category: 'SESC',
    type: 'SCRAPER',
    uf: 'SP',
    city: 'São Paulo',
    endpointOrUrl: 'https://sescsp.org.br/licitacoes/cultura-fisica',
    selectorOrParams: '.licitacao-box .anexos a[href$=".pdf"]',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:10:00Z',
    latencyMs: 380,
    successRate: 97.5,
    totalCollected: 38,
    format: 'HTML',
    notes: 'Aquisições recorrentes para unidades e academias SESC SP.'
  },
  {
    id: 'src-sesc-rs-01',
    name: 'SESC Regional Rio Grande do Sul',
    category: 'SESC',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Porto Alegre',
    endpointOrUrl: 'https://www.sesc-rs.com.br/licitacoes',
    selectorOrParams: '.edital-list .item-licitacao',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:12:00Z',
    latencyMs: 310,
    successRate: 99.0,
    totalCollected: 22,
    format: 'HTML'
  },
  {
    id: 'src-senat-nac-01',
    name: 'SEST SENAT Nacional',
    category: 'SENAT',
    type: 'SCRAPER',
    uf: 'DF',
    city: 'Brasília (Nacional)',
    endpointOrUrl: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    selectorOrParams: '#tabelaEditaisSest tr.row-processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:15:00Z',
    latencyMs: 520,
    successRate: 96.2,
    totalCollected: 31,
    format: 'HTML',
    notes: 'Portal Mural SEST SENAT (Paradigma). Foco em concorrências, academias de saúde do motorista e credenciamentos.'
  },
  {
    id: 'src-sesi-nac-01',
    name: 'SESI Departamento Nacional (CNI)',
    category: 'SESI',
    type: 'SCRAPER',
    uf: 'DF',
    city: 'Brasília (Nacional)',
    endpointOrUrl: 'https://compras.portaldaindustria.com.br/sesi',
    selectorOrParams: '.licitacoes-sesi-grid .item-card',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:20:00Z',
    latencyMs: 395,
    successRate: 98.8,
    totalCollected: 26,
    format: 'HTML'
  },
  {
    id: 'src-sesi-rs-01',
    name: 'SESI Regional Rio Grande do Sul (FIERGS)',
    category: 'SESI',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Porto Alegre',
    endpointOrUrl: 'https://licitacoes.sesirs.org.br/editais',
    selectorOrParams: 'table#listaEditaisSesiRS tr.edital-item',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:22:00Z',
    latencyMs: 340,
    successRate: 98.4,
    totalCollected: 19,
    format: 'HTML'
  },
  {
    id: 'src-sesi-sp-01',
    name: 'SESI São Paulo — Portal de Transparência (Licitações)',
    category: 'SESI',
    type: 'SCRAPER',
    uf: 'SP',
    city: 'São Paulo',
    endpointOrUrl: 'https://transparencia.sesisp.org.br/licitacoes/licitacoes-editais',
    selectorOrParams: JSON.stringify({
      listSelector: 'article.edital',
      titleSelector: '#Resumo, h3',
      descriptionSelector: '#Objeto',
      dateSelector: '#Status',
    }),
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:25:00Z',
    latencyMs: 290,
    successRate: 99.2,
    totalCollected: 44,
    format: 'HTML',
    notes: 'Portal oficial de transparência e processos licitatórios do SESI SP. Seletores canônicos validados contra DOM real.',
  },

  // 3. 28 Municípios AMZOP / Região RS
  {
    id: 'src-amzop-01',
    name: 'Prefeitura Municipal de Frederico Westphalen',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Frederico Westphalen',
    endpointOrUrl: 'https://fredericowestphalen.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabela-licitacoes tr.linha-edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:30:00Z',
    latencyMs: 460,
    successRate: 99.1,
    totalCollected: 14,
    format: 'HTML'
  },
  {
    id: 'src-amzop-02',
    name: 'Prefeitura Municipal de Palmeira das Missões',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Palmeira das Missões',
    endpointOrUrl: 'https://palmeiradasmissoes.rs.gov.br/transparencia/licitacoes',
    selectorOrParams: '.licitacao-container .documento-link',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:32:00Z',
    latencyMs: 510,
    successRate: 97.8,
    totalCollected: 11,
    format: 'HTML'
  },
  {
    id: 'src-amzop-03',
    name: 'Prefeitura Municipal de Seberi',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Seberi',
    endpointOrUrl: 'https://seberi.rs.gov.br/licitacoes',
    selectorOrParams: 'div.listagem-editais a.download-edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:33:00Z',
    latencyMs: 620,
    successRate: 95.5,
    totalCollected: 8,
    format: 'HTML'
  },
  {
    id: 'src-amzop-04',
    name: 'Prefeitura Municipal de Rodeio Bonito',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Rodeio Bonito',
    endpointOrUrl: 'https://rodeiobonito.rs.gov.br/licitacoes',
    selectorOrParams: '.grid-licitacoes tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:34:00Z',
    latencyMs: 480,
    successRate: 98.0,
    totalCollected: 6,
    format: 'HTML'
  },
  {
    id: 'src-amzop-05',
    name: 'Prefeitura Municipal de Ametista do Sul',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Ametista do Sul',
    endpointOrUrl: 'https://ametistadosul.rs.gov.br/licitacoes',
    selectorOrParams: 'table.licitacoes-tabela tr.linha',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:35:00Z',
    latencyMs: 550,
    successRate: 96.0,
    totalCollected: 7,
    format: 'HTML'
  },
  {
    id: 'src-amzop-06',
    name: 'Prefeitura Municipal de Iraí',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Iraí',
    endpointOrUrl: 'https://irai.rs.gov.br/licitacoes-editais',
    selectorOrParams: '.painel-editais .item-edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:36:00Z',
    latencyMs: 430,
    successRate: 98.5,
    totalCollected: 9,
    format: 'HTML'
  },
  {
    id: 'src-amzop-07',
    name: 'Prefeitura Municipal de Planalto',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Planalto',
    endpointOrUrl: 'https://planalto.rs.gov.br/licitacoes',
    selectorOrParams: '#tabelaLicitacoes tr.processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:37:00Z',
    latencyMs: 590,
    successRate: 94.2,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-08',
    name: 'Prefeitura Municipal de Nonoai',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Nonoai',
    endpointOrUrl: 'https://nonoai.rs.gov.br/portal/licitacoes',
    selectorOrParams: '.licitacoes-lista .row-item',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:38:00Z',
    latencyMs: 470,
    successRate: 97.9,
    totalCollected: 10,
    format: 'HTML'
  },
  {
    id: 'src-amzop-09',
    name: 'Prefeitura Municipal de Três Passos',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Três Passos',
    endpointOrUrl: 'https://trespassos.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabelaEditais tr.item',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:39:00Z',
    latencyMs: 380,
    successRate: 99.0,
    totalCollected: 13,
    format: 'HTML'
  },
  {
    id: 'src-amzop-10',
    name: 'Prefeitura Municipal de Tenente Portela',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Tenente Portela',
    endpointOrUrl: 'https://tenenteportela.rs.gov.br/licitacoes',
    selectorOrParams: '.lista-processos .card-processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:40:00Z',
    latencyMs: 505,
    successRate: 96.7,
    totalCollected: 7,
    format: 'HTML'
  },
  {
    id: 'src-amzop-11',
    name: 'Prefeitura Municipal de Constantina',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Constantina',
    endpointOrUrl: 'https://constantina.rs.gov.br/licitacoes',
    selectorOrParams: '#conteudoLicitacoes tr.linha',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:41:00Z',
    latencyMs: 440,
    successRate: 98.2,
    totalCollected: 8,
    format: 'HTML'
  },
  {
    id: 'src-amzop-12',
    name: 'Prefeitura Municipal de Sarandi',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Sarandi',
    endpointOrUrl: 'https://sarandi.rs.gov.br/licitacoes',
    selectorOrParams: '.tabela-licitacoes-geral tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:42:00Z',
    latencyMs: 410,
    successRate: 98.9,
    totalCollected: 12,
    format: 'HTML'
  },
  {
    id: 'src-amzop-13',
    name: 'Prefeitura Municipal de Rondinha',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Rondinha',
    endpointOrUrl: 'https://rondinha.rs.gov.br/licitacoes',
    selectorOrParams: '.lista-editais a.link-pdf',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:43:00Z',
    latencyMs: 600,
    successRate: 95.0,
    totalCollected: 4,
    format: 'HTML'
  },
  {
    id: 'src-amzop-14',
    name: 'Prefeitura Municipal de Boa Vista das Missões',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Boa Vista das Missões',
    endpointOrUrl: 'https://boavistadasmissoes.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabela tr.edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:44:00Z',
    latencyMs: 530,
    successRate: 96.1,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-15',
    name: 'Prefeitura Municipal de Caiçara',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Caiçara',
    endpointOrUrl: 'https://caicara.rs.gov.br/licitacoes',
    selectorOrParams: '.lista-compras tr.processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:45:00Z',
    latencyMs: 490,
    successRate: 97.4,
    totalCollected: 6,
    format: 'HTML'
  },
  {
    id: 'src-amzop-16',
    name: 'Prefeitura Municipal de Cristal do Sul',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Cristal do Sul',
    endpointOrUrl: 'https://cristaldosul.rs.gov.br/licitacoes',
    selectorOrParams: '.editais-grid .edital-box',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:46:00Z',
    latencyMs: 520,
    successRate: 96.8,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-17',
    name: 'Prefeitura Municipal de Erval Seco',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Erval Seco',
    endpointOrUrl: 'https://ervalseco.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabela-processos tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:47:00Z',
    latencyMs: 480,
    successRate: 98.1,
    totalCollected: 6,
    format: 'HTML'
  },
  {
    id: 'src-amzop-18',
    name: 'Prefeitura Municipal de Jaboticaba',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Jaboticaba',
    endpointOrUrl: 'https://jaboticaba.rs.gov.br/licitacoes',
    selectorOrParams: '.licitacoes-container a.anexo-pdf',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:48:00Z',
    latencyMs: 510,
    successRate: 95.8,
    totalCollected: 4,
    format: 'HTML'
  },
  {
    id: 'src-amzop-19',
    name: 'Prefeitura Municipal de Novo Tiradentes',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Novo Tiradentes',
    endpointOrUrl: 'https://novotiradentes.rs.gov.br/licitacoes',
    selectorOrParams: '#editais-publicados tr.item',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:49:00Z',
    latencyMs: 540,
    successRate: 96.3,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-20',
    name: 'Prefeitura Municipal de Palmitinho',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Palmitinho',
    endpointOrUrl: 'https://palmitinho.rs.gov.br/licitacoes',
    selectorOrParams: '.tabela-licitacoes-palmitinho tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:50:00Z',
    latencyMs: 470,
    successRate: 97.6,
    totalCollected: 8,
    format: 'HTML'
  },
  {
    id: 'src-amzop-21',
    name: 'Prefeitura Municipal de Pinhal',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Pinhal',
    endpointOrUrl: 'https://pinhal.rs.gov.br/licitacoes',
    selectorOrParams: '.grid-editais .item-edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:51:00Z',
    latencyMs: 530,
    successRate: 95.9,
    totalCollected: 4,
    format: 'HTML'
  },
  {
    id: 'src-amzop-22',
    name: 'Prefeitura Municipal de Pinheirinho do Vale',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Pinheirinho do Vale',
    endpointOrUrl: 'https://pinheirinhodovale.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabela tr.processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:52:00Z',
    latencyMs: 560,
    successRate: 96.0,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-23',
    name: 'Prefeitura Municipal de Redentora',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Redentora',
    endpointOrUrl: 'https://redentora.rs.gov.br/licitacoes',
    selectorOrParams: '.licitacoes-redentora .edital-card',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:53:00Z',
    latencyMs: 490,
    successRate: 97.0,
    totalCollected: 7,
    format: 'HTML'
  },
  {
    id: 'src-amzop-24',
    name: 'Prefeitura Municipal de Taquaruçu do Sul',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Taquaruçu do Sul',
    endpointOrUrl: 'https://taquarucudosul.rs.gov.br/licitacoes',
    selectorOrParams: '#tabelaLicitacoesTaquarucu tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:54:00Z',
    latencyMs: 520,
    successRate: 96.5,
    totalCollected: 6,
    format: 'HTML'
  },
  {
    id: 'src-amzop-25',
    name: 'Prefeitura Municipal de Vicente Dutra',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Vicente Dutra',
    endpointOrUrl: 'https://vicentedutra.rs.gov.br/licitacoes',
    selectorOrParams: '.lista-processos tr.edital',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:55:00Z',
    latencyMs: 580,
    successRate: 95.1,
    totalCollected: 4,
    format: 'HTML'
  },
  {
    id: 'src-amzop-26',
    name: 'Prefeitura Municipal de Vista Alegre',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Vista Alegre',
    endpointOrUrl: 'https://vistaalegre.rs.gov.br/licitacoes',
    selectorOrParams: 'table.tabela-editais tr',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:56:00Z',
    latencyMs: 500,
    successRate: 97.2,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-27',
    name: 'Prefeitura Municipal de Cerro Grande',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Cerro Grande',
    endpointOrUrl: 'https://cerrogrande.rs.gov.br/licitacoes',
    selectorOrParams: '.editais-cerro-grande .item',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:57:00Z',
    latencyMs: 540,
    successRate: 96.4,
    totalCollected: 5,
    format: 'HTML'
  },
  {
    id: 'src-amzop-28',
    name: 'Prefeitura Municipal de Alpestre',
    category: 'Prefeitura',
    type: 'SCRAPER',
    uf: 'RS',
    city: 'Alpestre',
    endpointOrUrl: 'https://alpestre.rs.gov.br/licitacoes',
    selectorOrParams: '#gridLicitacoes tr.processo',
    authType: 'NONE',
    status: 'ACTIVE',
    lastCheckedAt: '2026-08-16T17:58:00Z',
    latencyMs: 470,
    successRate: 97.8,
    totalCollected: 6,
    format: 'HTML'
  }
];

export const INITIAL_EDITAIS: Edital[] = [
  {
    id: 'edt-sesc-2026-042',
    sourceId: 'src-sesc-nac-01',
    sourceName: 'SESC Departamento Nacional',
    sourceCategory: 'SESC',
    sourceType: 'SCRAPER',
    processNumber: 'CC-042/2026-SESC-DN',
    title: 'Concorrência nº 042/2026 - Modernização das Academias e Salas de Ginástica SESC',
    objectDescription: 'Contratação de empresa especializada para fornecimento e montagem de esteiras ergométricas profissionais de alto rendimento, estações multifuncionais de musculação, bancos articulados e kits de halteres emborrachados para os centros de cultura física do SESC.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'REGEX_NLP',
    modality: 'Concorrência',
    publicationDate: '2026-08-14T09:00:00Z',
    openingDate: '2026-09-02T14:00:00Z',
    budgetEstimated: 1850000.00,
    rawUrl: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
    s3StorageKey: 's3://editais-vault/sesc-dn/2026/CC-042-2026-v1.pdf',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    fileSizeBytes: 3418290,
    version: 1,
    ocrStatus: 'COMPLETE',
    ocrConfidenceAvg: 96.8,
    city: 'Rio de Janeiro',
    uf: 'RJ',
    collectionMethod: 'MURAL_PARADIGMA',
    urlValidation: {
      originalUrl: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
      originalRequestedUrl: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
      validationStatus: 'VALID_DIRECT_200',
      collectionMethod: 'MURAL_PARADIGMA',
      httpStatusCode: 200,
      finalResolvedUrl: 'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
      mimeTypeValidated: 'text/html; charset=utf-8',
      contentLengthBytes: 3418290,
      validatedAt: '2026-08-16T12:47:00Z',
      dnsResolutionStatus: 'RESOLVED_OK',
      rewriteRuleApplied: 'sesc-dn -> https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx',
      limitationNotice: 'Portal Mural SESC DN oficial (Paradigma). Integridade canônica confirmada.',
      redirectChain: [
        'https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx (HTTP 200 Direto)'
      ],
      isUnavailable: false
    },
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 98.5,
        text: `SERVIÇO SOCIAL DO COMÉRCIO - DEPARTAMENTO NACIONAL
EDITAL DE CONCORRÊNCIA Nº 042/2026
PROCESSO ADMINISTRATIVO: SESC-DN-8931/2026
OBJETO: Aquisição de equipamentos profissionais para renovação de academias de ginástica e centros de condicionamento físico (NCM 9506.91.00).
Abertura das Propostas: 02/09/2026 às 14h00.
Local de entrega: Unidades SESC Polo Nacional.`
      },
      {
        pageNumber: 2,
        confidenceScore: 97.0,
        text: `SEÇÃO II - DA HABILITAÇÃO TÉCNICA E REQUISITOS ESPECÍFICOS
Item 4.2.1 - Para fins de qualificação técnica dos lotes 01 e 02 (Esteiras e Estações de Musculação NCM 9506.91.00), a licitante deverá apresentar obrigatoriamente atestado de capacidade técnica emitido exclusivamente por rede hoteleira de padrão 5 estrelas ou academias com mais de 2.000 alunos ativos, comprovando fornecimento anterior de no mínimo 50 unidades idênticas nos últimos 12 meses.`
      },
      {
        pageNumber: 3,
        confidenceScore: 95.2,
        text: `Item 4.3 - DAS ESPECIFICAÇÕES TÉCNICAS RESTRITIVAS:
Os equipamentos deverão possuir sistema exclusivo de absorção de impacto patenteado modelo "FlexWave Duo" ou equivalente estrito aprovado previamente pelo corpo técnico antes da sessão de lances. Prazo para entrega e montagem integral: impreterivelmente 05 (cinco) dias corridos após emissão da Ordem de Fornecimento.`
      },
      {
        pageNumber: 4,
        confidenceScore: 96.5,
        text: `SEÇÃO V - DAS DISPOSIÇÕES GERAIS E RECURSOS
Os casos omissos serão regulados pela Resolução SESC nº 1.252/2012 e subsidiariamente pelos princípios gerais do direito administrativo.`
      }
    ],
    findings: [
      {
        id: 'fnd-sesc-01',
        editalId: 'edt-sesc-2026-042',
        page: 2,
        snippet: 'Item 4.2.1 - ...apresentar obrigatoriamente atestado de capacidade técnica emitido exclusivamente por rede hoteleira de padrão 5 estrelas ou academias com mais de 2.000 alunos ativos...',
        legalBasis: 'Art. 12 do Regulamento de Licitações do SESC c/c Princípio da Isonomia e Competitividade',
        findingType: 'EXIGENCIA_RESTRITIVA',
        impactRisk: 'ALTO',
        explanation: 'Exigência de atestado restrito a determinado segmento comercial (redes hoteleiras 5 estrelas / academias >2000 alunos), configurando restrição indevida à competitividade e violação aos princípios licitatórios do Sistema S.',
        confidence: 'ALTA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      },
      {
        id: 'fnd-sesc-02',
        editalId: 'edt-sesc-2026-042',
        page: 3,
        snippet: 'Item 4.3 - ...possuir sistema exclusivo de absorção de impacto patenteado modelo "FlexWave Duo" ou equivalente estrito aprovado previamente...',
        legalBasis: 'Súmula 270 TCU e Art. 12 do Regulamento do SESC',
        findingType: 'MARCA_ESPECIFICA',
        impactRisk: 'ALTO',
        explanation: 'Direcionamento velado através de menção a tecnologia proprietária/patenteada sem prévia justificativa técnica demonstrando inexistência de alternativas no mercado de aparelhos de ginástica (NCM 9506.91.00).',
        confidence: 'ALTA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      },
      {
        id: 'fnd-sesc-03',
        editalId: 'edt-sesc-2026-042',
        page: 3,
        snippet: 'Prazo para entrega e montagem integral: impreterivelmente 05 (cinco) dias corridos após emissão da Ordem de Fornecimento.',
        legalBasis: 'Princípio da Razoabilidade e Proporcionalidade',
        findingType: 'PRAZO_EXIGUO',
        impactRisk: 'ALTO',
        explanation: 'Prazo de 5 dias corridos para fabricação, transporte interestadual e montagem de 50 estações complexas de musculação em âmbito nacional é manifestamente inexequível, favorecendo empresa pré-alocada.',
        confidence: 'MEDIA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      }
    ],
    humanReviewStatus: 'PENDING',
    publishedInternally: false
  },

  {
    id: 'edt-comprasnet-2026-108',
    sourceId: 'src-comprasnet-01',
    sourceName: 'ComprasNet Gov.br',
    sourceCategory: 'ComprasNet',
    sourceType: 'API',
    processNumber: 'PE-108/2026-UASG-158123',
    title: 'Pregão Eletrônico nº 108/2026 - Aquisição de Kits de Cultura Física e Ginástica Laboral',
    objectDescription: 'Registro de Preços para fornecimento de equipamentos esportivos, tatames em EVA de alta densidade 40mm, barras olímpicas com rolamento, anilhas de ferro fundido revestidas e halteres sextavados para centros de treinamento esportivo.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'STRUCTURED_API',
    modality: 'Pregão Eletrônico',
    publicationDate: '2026-08-15T11:30:00Z',
    openingDate: '2026-08-28T09:00:00Z',
    budgetEstimated: 620000.00,
    rawUrl: 'https://comprasnet.gov.br/consultalicitacoes/download/PE1082026.pdf',
    s3StorageKey: 's3://editais-vault/comprasnet/2026/PE-108-2026-UASG158123.pdf',
    sha256Hash: 'a89c74efb153d842918b958c27389178f294029f6311094892c9043ef8471b02',
    fileSizeBytes: 2198000,
    version: 1,
    ocrStatus: 'COMPLETE',
    ocrConfidenceAvg: 99.2,
    city: 'Brasília',
    uf: 'DF',
    collectionMethod: 'DIRECT_HTTPX',
    urlValidation: {
      originalUrl: 'https://comprasnet.gov.br/consultalicitacoes/download/PE1082026.pdf',
      originalRequestedUrl: 'https://comprasnet.gov.br/consultalicitacoes/download/PE1082026.pdf',
      validationStatus: 'VALID_DIRECT_200',
      collectionMethod: 'DIRECT_HTTPX',
      httpStatusCode: 200,
      finalResolvedUrl: 'https://comprasnet.gov.br/consultalicitacoes/download/PE1082026.pdf',
      mimeTypeValidated: 'application/pdf (Magic Bytes %PDF-1.7)',
      contentLengthBytes: 2198000,
      validatedAt: '2026-08-16T16:00:00Z',
      dnsResolutionStatus: 'RESOLVED_OK',
      limitationNotice: 'Documento acessado diretamente via endpoint REST da API de Dados Abertos ComprasNet.',
      isUnavailable: false
    },
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 99.5,
        text: `MINISTÉRIO DO ESPORTE / UASG 158123
EDITAL DE PREGÃO ELETRÔNICO Nº 108/2026 (LEI 14.133/2021)
Item CATMAT / NCM 9506.91.00: Artigos para ginástica, condicionamento e treinamento funcional.
Valor total estimado: R$ 620.000,00.`
      },
      {
        pageNumber: 2,
        confidenceScore: 99.0,
        text: `CRITÉRIO DE JULGAMENTO: Menor Preço por Item.
Exigência de Certificado de Conformidade Técnica emitido por laboratório acreditado pelo INMETRO para os tatames e anilhas de precisão.`
      }
    ],
    findings: [
      {
        id: 'fnd-cpn-01',
        editalId: 'edt-comprasnet-2026-108',
        page: 2,
        snippet: 'Exigência de Certificado de Conformidade Técnica emitido por laboratório acreditado pelo INMETRO para os tatames...',
        legalBasis: 'Art. 67, § 1º da Lei nº 14.133/2021',
        findingType: 'CERTIFICACAO_INMETRO',
        explanation: 'Exigência de laudo INMETRO para material em que inexiste portaria compulsória específica vigente, devendo ser facultada apresentação de laudo de fabricante com garantia de densidade.',
        confidence: 'MEDIA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      }
    ],
    humanReviewStatus: 'PENDING',
    publishedInternally: false
  },

  {
    id: 'edt-fw-2026-089',
    sourceId: 'src-amzop-01',
    sourceName: 'Prefeitura Municipal de Frederico Westphalen',
    sourceCategory: 'Prefeitura',
    sourceType: 'SCRAPER',
    processNumber: 'PE-089/2026-PMFW',
    title: 'Pregão Eletrônico nº 089/2026 - Instalação de Academias da Terceira Idade e Cultura Física',
    objectDescription: 'Aquisição de aparelhos para academia ao ar livre, simuladores de caminhada duplos, esquiadores, rotações diagonais e estações completas de ginástica em aço carbono galvanizado (NCM 9506.91.00) para praças do município.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'REGEX_NLP',
    modality: 'Pregão Eletrônico',
    publicationDate: '2026-08-13T10:00:00Z',
    openingDate: '2026-08-27T10:00:00Z',
    budgetEstimated: 340000.00,
    rawUrl: 'https://fredericowestphalen.rs.gov.br/editais/PE0892026.pdf',
    s3StorageKey: 's3://editais-vault/amzop/frederico-westphalen/PE-089-2026.pdf',
    sha256Hash: '439a4bb387401c70e88915b88c7f991f868c227b926487920cf67e2a90f6b402',
    fileSizeBytes: 1845200,
    version: 2,
    retificationStatus: 'RETIFICADO',
    retificationOfId: 'edt-fw-2026-089-v1',
    ocrStatus: 'COMPLETE',
    ocrConfidenceAvg: 97.4,
    city: 'Frederico Westphalen',
    uf: 'RS',
    collectionMethod: 'DIRECT_HTTPX',
    urlValidation: {
      originalUrl: 'https://fredericowestphalen.rs.gov.br/editais/PE0892026.pdf',
      originalRequestedUrl: 'https://fredericowestphalen.rs.gov.br/editais/PE0892026.pdf',
      validationStatus: 'VALID_DIRECT_200',
      collectionMethod: 'DIRECT_HTTPX',
      httpStatusCode: 200,
      finalResolvedUrl: 'https://fredericowestphalen.rs.gov.br/editais/PE0892026.pdf',
      mimeTypeValidated: 'application/pdf (Magic Bytes %PDF-1.4)',
      contentLengthBytes: 1845200,
      validatedAt: '2026-08-16T14:00:00Z',
      dnsResolutionStatus: 'RESOLVED_OK',
      limitationNotice: 'Edital retificado baixado diretamente do portal municipal.',
      isUnavailable: false
    },
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 98.0,
        text: `MUNICÍPIO DE FREDERICO WESTPHALEN - RS
EDITAL DE PREGÃO ELETRÔNICO Nº 089/2026 - EDITAL RETIFICADO V2.0
OBJETO: Aquisição e instalação de equipamentos para Academias da Saúde e Cultura Física (NCM 9506.91.00).
Data de abertura: 27/08/2026.`
      },
      {
        pageNumber: 2,
        confidenceScore: 97.1,
        text: `CLÁUSULA 8ª - DA QUALIFICAÇÃO TÉCNICA E VISITA TÉCNICA (RETIFICADA):
8.1. A visita técnica é facultativa, podendo a licitante apresentar Declaração Formal de Pleno Conhecimento do local de instalação firmada pelo responsável técnico.`
      }
    ],
    findings: [
      {
        id: 'fnd-fw-01',
        editalId: 'edt-fw-2026-089',
        page: 2,
        snippet: '8.1. A visita técnica é facultativa, podendo a licitante apresentar Declaração Formal...',
        legalBasis: 'Art. 67, § 2º da Lei Federal nº 14.133/2021',
        findingType: 'QUALIFICACAO_TECNICA',
        explanation: 'A exigência de visita técnica obrigatória constante na v1.0 foi corrigida na retificação v2.0, passando a ser facultativa.',
        confidence: 'ALTA',
        status: 'CORRIGIDO',
        humanDecision: 'APROVADO',
        reviewerComment: 'Retificação regularizou a cláusula conforme Art. 67 da Nova Lei de Licitações.',
        reviewedBy: 'Dra. Camila Vargas (OAB/RS 88.412)',
        reviewedAt: '2026-08-16T14:10:00Z'
      }
    ],
    humanReviewStatus: 'APPROVED',
    reviewedBy: 'Dra. Camila Vargas (OAB/RS 88.412)',
    reviewedAt: '2026-08-16T14:10:00Z',
    reviewNotes: 'Edital retificado aprovado com conformidade jurídica integral. Achado anterior marcado como corrigido.',
    publishedInternally: true
  },

  {
    id: 'edt-sest-2026-019',
    sourceId: 'src-senat-nac-01',
    sourceName: 'SEST SENAT Nacional',
    sourceCategory: 'SENAT',
    sourceType: 'SCRAPER',
    processNumber: 'CC-019/2026-SENAT',
    title: 'Concorrência nº 019/2026 - Aparelhagem Esportiva e Musculação Preventiva',
    objectDescription: 'Fornecimento continuado de esteiras de alta absorção, bicicletas ergométricas horizontais e estações ergonômicas para os centros de reabilitação e condicionamento físico do SEST SENAT.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'REGEX_NLP',
    modality: 'Concorrência',
    publicationDate: '2026-08-12T14:00:00Z',
    openingDate: '2026-09-05T10:00:00Z',
    budgetEstimated: 980000.00,
    rawUrl: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    s3StorageKey: 's3://editais-vault/sest-senat/CC-019-2026.pdf',
    sha256Hash: '99bf4e21a007bc46f1406856b3e9447192f15931cb7f8b919a9d2ff0031a5472',
    fileSizeBytes: 2890100,
    version: 1,
    ocrStatus: 'PARTIAL',
    ocrConfidenceAvg: 74.5,
    city: 'Brasília',
    uf: 'DF',
    collectionMethod: 'MURAL_PARADIGMA',
    urlValidation: {
      originalUrl: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
      originalRequestedUrl: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
      validationStatus: 'VALID_DIRECT_200',
      collectionMethod: 'MURAL_PARADIGMA',
      httpStatusCode: 200,
      finalResolvedUrl: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
      mimeTypeValidated: 'text/html; charset=utf-8',
      contentLengthBytes: 2890100,
      validatedAt: '2026-08-16T13:30:00Z',
      dnsResolutionStatus: 'RESOLVED_OK',
      limitationNotice: 'Portal Mural SEST SENAT oficial (compras.sestsenat.org.br). Integridade canônica confirmada.',
      isUnavailable: false
    },
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 78.0,
        text: `SERVIÇO NACIONAL DE APRENDIZAGEM DO TRANSPORTE - SEST SENAT
CONCORRÊNCIA Nº 019/2026 - AQUISIÇÃO DE APARELHOS DE GINÁSTICA (NCM 9506.91.00).
[Aviso: Página com ruído de digitalização e caracteres de baixa resolução].`
      },
      {
        pageNumber: 2,
        confidenceScore: 71.0,
        text: `Item 6 - Exige-se depósito caução em dinheiro correspondente a 15% do valor estimado da contratação como condição preliminar de participação antes do credenciamento.`
      }
    ],
    findings: [
      {
        id: 'fnd-sest-01',
        editalId: 'edt-sest-2026-019',
        page: 2,
        snippet: 'Item 6 - Exige-se depósito caução em dinheiro correspondente a 15% do valor estimado...',
        legalBasis: 'Regulamento de Licitações do SEST SENAT e Súmula 275 TCU',
        findingType: 'GARANTIA_EXCESSIVA',
        impactRisk: 'ALTO',
        explanation: 'Exigência de garantia de participação prévia de 15% extrapola o limite usual de 1% a 5%, restringindo empresas de menor porte financeiro.',
        confidence: 'ALTA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      },
      {
        id: 'fnd-sest-02',
        editalId: 'edt-sest-2026-019',
        page: 1,
        snippet: '[OCR Parcial: Termos de certificação de solda não puderam ser transcritos com 100% de clareza]',
        legalBasis: 'Necessidade de verificação do documento original',
        findingType: 'OUTRO',
        impactRisk: 'MEDIO',
        explanation: 'Trecho do Anexo Técnico com OCR abaixo de 80%. Recomenda-se revisão manual do PDF escaneado.',
        confidence: 'INCONCLUSIVA',
        status: 'ATIVO',
        humanDecision: 'PENDING'
      }
    ],
    humanReviewStatus: 'PENDING',
    publishedInternally: false
  },

  {
    id: 'edt-sesi-2026-055',
    sourceId: 'src-sesi-rs-01',
    sourceName: 'SESI Regional Rio Grande do Sul',
    sourceCategory: 'SESI',
    sourceType: 'SCRAPER',
    processNumber: 'PE-055/2026-SESI-RS',
    title: 'Pregão Eletrônico nº 055/2026 - Renovação de Aparelhos de Ginástica e Musculação do Trabalhador',
    objectDescription: 'Aquisição de esteiras elétricas industriais, elípticos magnéticos e estações de musculação para o Centro de Atividades do Trabalhador SESI em Caxias do Sul e Passo Fundo.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'REGEX_NLP',
    modality: 'Pregão Eletrônico',
    publicationDate: '2026-08-11T08:00:00Z',
    openingDate: '2026-08-25T14:30:00Z',
    budgetEstimated: 510000.00,
    rawUrl: 'https://licitacoes.sesirs.org.br/editais/PE0552026.pdf',
    s3StorageKey: 's3://editais-vault/sesi-rs/2026/PE-055-2026.pdf',
    sha256Hash: '52c0f658097b61f87920ab84594c7e661642845c928424e65bc46059d0fa0481',
    fileSizeBytes: 1940000,
    version: 1,
    ocrStatus: 'COMPLETE',
    ocrConfidenceAvg: 98.6,
    city: 'Porto Alegre',
    uf: 'RS',
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 99.0,
        text: `SERVIÇO SOCIAL DA INDÚSTRIA - SESI/RS
EDITAL DE PREGÃO ELETRÔNICO Nº 055/2026
OBJETO: Aquisição de equipamentos esportivos e de condicionamento físico para saúde do trabalhador (NCM 9506.91.00).`
      }
    ],
    findings: [],
    humanReviewStatus: 'APPROVED',
    reviewedBy: 'Dr. Lucas Silveira (OAB/RS 74.190)',
    reviewedAt: '2026-08-16T11:00:00Z',
    reviewNotes: 'Edital analisado sem inconformidades legais. Total conformidade com o Regulamento de Licitações do SESI.',
    publishedInternally: true
  },

  {
    id: 'edt-palmeira-2026-031',
    sourceId: 'src-amzop-02',
    sourceName: 'Prefeitura Municipal de Palmeira das Missões',
    sourceCategory: 'Prefeitura',
    sourceType: 'SCRAPER',
    processNumber: 'PE-031/2026-PMPM',
    title: 'Pregão Eletrônico nº 031/2026 - Estruturação do Ginásio Municipal de Esportes e Lazer',
    objectDescription: 'Aquisição de piso esportivo emborrachado para ginástica de alto impacto, espaldares de madeira de lei, barras paralelas e anilhas para o programa de formação de atletas do município.',
    ncmCode: '9506.91.00',
    ncmDescription: 'Artigos e aparelhos para cultura física, ginástica ou atletismo',
    matchType: 'REGEX_NLP',
    modality: 'Pregão Eletrônico',
    publicationDate: '2026-08-10T16:00:00Z',
    openingDate: '2026-08-26T09:30:00Z',
    budgetEstimated: 215000.00,
    rawUrl: 'https://palmeiradasmissoes.rs.gov.br/editais/PE0312026.pdf',
    s3StorageKey: 's3://editais-vault/amzop/palmeira/PE-031-2026.pdf',
    sha256Hash: '17bc429188a10427b5879a832e185c96b74400194856a935b02657e231149e08',
    fileSizeBytes: 1420000,
    version: 1,
    ocrStatus: 'COMPLETE',
    ocrConfidenceAvg: 95.8,
    city: 'Palmeira das Missões',
    uf: 'RS',
    ocrPages: [
      {
        pageNumber: 1,
        confidenceScore: 96.5,
        text: `MUNICÍPIO DE PALMEIRA DAS MISSÕES / RS
EDITAL DE PREGÃO ELETRÔNICO Nº 031/2026 (LEI 14.133/2021)
OBJETO: Aquisição de artigos para cultura física, ginástica e atletismo (NCM 9506.91.00).`
      }
    ],
    findings: [],
    humanReviewStatus: 'APPROVED',
    reviewedBy: 'Dra. Camila Vargas (OAB/RS 88.412)',
    reviewedAt: '2026-08-15T15:20:00Z',
    reviewNotes: 'Edital em estrita consonância com a Lei 14.133/2021.',
    publishedInternally: true
  }
];

export const INITIAL_NOTIFICATIONS: WhatsAppNotification[] = [
  {
    id: 'wpp-notif-01',
    editalId: 'edt-fw-2026-089',
    entityName: 'Prefeitura Municipal de Frederico Westphalen',
    processNumber: 'PE-089/2026-PMFW',
    recipientPhone: '+55 55 99876-5432',
    status: 'DELIVERED',
    messageBody: '🚨 *Novo relatório:* Prefeitura Municipal de Frederico Westphalen\nEdital PE-089/2026 (NCM 9506.91.00 - Cultura Física)\nStatus: Revisão Concluída (Retificado v2.0)\nAcesse o relatório seguro: https://monitor-editais.gov.br/r/edt-fw-2026-089',
    sentAt: '2026-08-16T14:15:00Z',
    deepLink: 'https://monitor-editais.gov.br/r/edt-fw-2026-089',
    templateName: 'meta_novo_relatorio_edital_v1'
  },
  {
    id: 'wpp-notif-02',
    editalId: 'edt-sesi-2026-055',
    entityName: 'SESI Regional Rio Grande do Sul',
    processNumber: 'PE-055/2026-SESI-RS',
    recipientPhone: '+55 51 98123-4567',
    status: 'DELIVERED',
    messageBody: '🚨 *Novo relatório:* SESI Regional Rio Grande do Sul\nEdital PE-055/2026 (NCM 9506.91.00 - Cultura Física)\nStatus: Revisão Concluída\nAcesse o relatório seguro: https://monitor-editais.gov.br/r/edt-sesi-2026-055',
    sentAt: '2026-08-16T11:05:00Z',
    deepLink: 'https://monitor-editais.gov.br/r/edt-sesi-2026-055',
    templateName: 'meta_novo_relatorio_edital_v1'
  }
];

export const INITIAL_DIFFS: RetificationDiff[] = [
  {
    id: 'diff-fw-089',
    originalEditalId: 'edt-fw-2026-089-v1',
    retifiedEditalId: 'edt-fw-2026-089',
    processNumber: 'PE-089/2026-PMFW',
    entityName: 'Prefeitura Municipal de Frederico Westphalen',
    dateAnalyzed: '2026-08-14T11:00:00Z',
    summary: 'A Administração Municipal publicou a Retificação nº 01 alterando a Cláusula 8ª (Visita Técnica Obrigatória) e prorrogando a data de abertura de 18/08/2026 para 27/08/2026.',
    addedClauses: [
      {
        page: 2,
        text: '8.1.1. É facultada a apresentação de Declaração Formal de Conhecimento Técnico das Condições Locais em substituição à vistoria prévia.'
      }
    ],
    removedClauses: [
      {
        page: 2,
        text: '8.1. A realização de visita técnica é condição INDISPENSÁVEL e eliminatória para habilitação, devendo ser agendada com no mínimo 48h de antecedência junto à Secretaria de Obras.'
      }
    ],
    modifiedClauses: [
      {
        page: 1,
        field: 'Data de Abertura da Sessão',
        oldText: '18/08/2026 às 09:00h',
        newText: '27/08/2026 às 10:00h'
      }
    ],
    findingsTransitions: [
      {
        findingId: 'fnd-fw-01',
        previousSnippet: '8.1. A realização de visita técnica é condição INDISPENSÁVEL e eliminatória...',
        newStatus: 'CORRIGIDO',
        justification: 'A exigência restritiva foi expurgada do texto editalício com acolhimento da recomendação de visita facultativa.'
      }
    ]
  }
];

export const INITIAL_SCHEDULER: SchedulerState = {
  isRunning: true,
  intervalMinutes: 60,
  lastRunAt: '2026-08-16T17:00:00Z',
  nextRunAt: '2026-08-16T18:00:00Z',
  totalRunsCompleted: 142,
  activeSourcesCount: 36,
  lastExecutionDurationSeconds: 4.8,
  logs: [
    {
      id: 'log-101',
      timestamp: '2026-08-16T17:00:00Z',
      sourceId: 'src-comprasnet-01',
      sourceName: 'ComprasNet Gov.br',
      sourceType: 'API',
      status: 'SUCCESS',
      message: 'Sincronização API executada. 2 novos editais detectados para NCM 9506.91.00.',
      itemsFound: 2,
      latencyMs: 142
    },
    {
      id: 'log-102',
      timestamp: '2026-08-16T17:01:15Z',
      sourceId: 'src-pm-fw',
      sourceName: 'Prefeitura de Frederico Westphalen/RS',
      sourceType: 'SCRAPER',
      status: 'SUCCESS',
      message: 'Varredura de portal municipal concluída. Retificação nº 01 indexada.',
      itemsFound: 1,
      latencyMs: 310
    },
    {
      id: 'log-103',
      timestamp: '2026-08-16T17:02:40Z',
      sourceId: 'src-sesc-rs-01',
      sourceName: 'SESC Regional Rio Grande do Sul',
      sourceType: 'SCRAPER',
      status: 'SUCCESS',
      message: 'Raspagem de portal do Sistema S concluída. 1 edital de academia ao ar livre capturado.',
      itemsFound: 1,
      latencyMs: 278
    }
  ]
};
