/**
 * PNCP Portais & Fontes de Licitação Catalog
 * Tipos, dados curados e utilitários para integração das fontes mapeadas ao backend do Monitor.
 */

export interface PncpCuratedPortal {
  idPncp: number;
  nome: string;
  cnpj: string;
  dataInclusaoPncp: string;
  categoriaInstituicao: string;
  esfera: 'Federal' | 'Estadual' | 'Municipal' | 'Multi-esfera / Nacional' | 'Multi-esfera / Municipal' | 'Estadual / Municipal';
  uf: string;
  plataformaTecnologia: string;
  urlPortalAcesso: string;
  endpointConsultaPncp: string;
  estrategiaConector: 'API_REST_OFICIAL' | 'PNCP_API_CONSULTA' | 'WEB_PORTAL / API' | 'ERP_GOVTECH_API' | 'API_XHR / SCRAPER' | 'SISTEMA_CONTROLE' | 'PORTAL_JUDICIARIO' | 'WEB_PORTAL';
  grauReaproveitamento: string;
}

export const TOP_TIER_PNCP_PORTALS: PncpCuratedPortal[] = [
  {
    idPncp: 3,
    nome: 'COMPRAS.GOV.BR',
    cnpj: '00.394.460/0001-41',
    dataInclusaoPncp: '2021-08-05',
    categoriaInstituicao: 'Governo Federal',
    esfera: 'Federal',
    uf: 'Nacional',
    plataformaTecnologia: 'SIASG / Compras.gov.br API',
    urlPortalAcesso: 'https://compras.gov.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=00394460000141',
    estrategiaConector: 'API_REST_OFICIAL',
    grauReaproveitamento: 'Altíssimo (Federal + centenas de municípios)',
  },
  {
    idPncp: 5,
    nome: 'PORTAL DE COMPRAS PÚBLICAS (ECUSTOMIZE)',
    cnpj: '09.397.355/0001-30',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'Portal de Compras Públicas (Ecustomize)',
    urlPortalAcesso: 'https://www.portaldecompraspublicas.com.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=09397355000130',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Mais de 2.000 municípios)',
  },
  {
    idPncp: 6,
    nome: 'BLL COMPRAS',
    cnpj: '10.508.843/0002-38',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'BLL Compras (Bolsa de Licitações e Leilões)',
    urlPortalAcesso: 'https://bllcompras.com',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=10508843000238',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Mais de 3.000 municípios)',
  },
  {
    idPncp: 7,
    nome: 'BOLSA BRASILEIRA DE MERCADORIAS - BBMNET LICITAÇÕES',
    cnpj: '05.342.088/0001-43',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'BBMNet Licitações (Bolsa Brasileira de Mercadorias)',
    urlPortalAcesso: 'https://bbmnetlicitacoes.com.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=05342088000143',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Nacional)',
  },
  {
    idPncp: 12,
    nome: 'BOLSA NACIONAL DE COMPRAS - BNC',
    cnpj: '25.099.967/0001-01',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'Bolsa Nacional de Compras (BNC)',
    urlPortalAcesso: 'https://bnc.org.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=25099967000101',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Nacional)',
  },
  {
    idPncp: 13,
    nome: 'LICITAR DIGITAL - PLATAFORMA DE LICITAÇÕES ONLINE',
    cnpj: '35.125.567/0001-79',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'Licitar Digital',
    urlPortalAcesso: 'https://www.licitardigital.com.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=35125567000179',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Nacional)',
  },
  {
    idPncp: 14,
    nome: 'PORTAL DE COMPRAS PÚBLICAS DO ESTADO DO RIO DE JANEIRO',
    cnpj: '15.829.998/0001-09',
    dataInclusaoPncp: '2021-08-09',
    categoriaInstituicao: 'Governo Estadual / Secretaria Central',
    esfera: 'Estadual',
    uf: 'RJ',
    plataformaTecnologia: 'Portal de Compras RJ (SIGA / Struts2 / Solr)',
    urlPortalAcesso: 'https://www.compras.rj.gov.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=15829998000109',
    estrategiaConector: 'API_XHR / SCRAPER',
    grauReaproveitamento: 'Alto (Estado do Rio de Janeiro)',
  },
  {
    idPncp: 42,
    nome: 'LICITAÇÕES-E BB',
    cnpj: '00.000.000/0001-91',
    dataInclusaoPncp: '2021-08-27',
    categoriaInstituicao: 'Plataforma / Bolsa de Compras Privada',
    esfera: 'Multi-esfera / Nacional',
    uf: 'Nacional',
    plataformaTecnologia: 'Licitações-e (Banco do Brasil)',
    urlPortalAcesso: 'https://www.licitacoes-e.com.br',
    endpointConsultaPncp: 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=00000000000191',
    estrategiaConector: 'WEB_PORTAL / API',
    grauReaproveitamento: 'Altíssimo (Nacional)',
  },
];

export const COMPRAS_RJ_CANONICAL_ENDPOINTS = {
  SEARCH_PAGINATE: 'https://www.compras.rj.gov.br/EditaisLicitacoes/paginate.action',
  LICITACAO_DETALHAR: 'https://www.compras.rj.gov.br/EditaisLicitacoes/detalhar.action',
  CATALOGO_PAGINATE: 'https://www.compras.rj.gov.br/Catalogo/paginate.action',
  CATALOGO_CARREGA_FAMILIA: 'https://www.compras.rj.gov.br/Catalogo/carregaFamilia.action',
  CATALOGO_DETALHAR: 'https://www.compras.rj.gov.br/Catalogo/detalhar.action',
  ATAS_REGISTRO_PRECO: 'https://www.compras.rj.gov.br/AtaRegistroPreco/buscar.action',
  COMPRA_DIRETA: 'https://www.compras.rj.gov.br/CompraDireta/buscar.action',
  DISPENSA_ELETRONICA: 'https://www.compras.rj.gov.br/ProcessoEletronicoDispensa/buscar.action',
  SUPORTE_ATENDIMENTO: 'https://www.compras.rj.gov.br/Noticias/listarSuporteUsuario',
} as const;

/**
 * Normaliza o CNPJ removendo pontuação e caracteres não numéricos.
 */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Gera URL de consulta do PNCP para qualquer CNPJ participante.
 */
export function buildPncpQueryEndpoint(cnpj: string, dataPublicacao?: string): string {
  const clean = normalizeCnpj(cnpj);
  let base = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?cnpj=${clean}`;
  if (dataPublicacao) {
    base += `&dataPublicacao=${encodeURIComponent(dataPublicacao)}`;
  }
  return base;
}
