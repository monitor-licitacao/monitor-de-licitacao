/**
 * Normaliza contratação PNCP → shape MuralProcessDetail (resumo/itens/anexos/historico).
 */
import { extractIdCompraFromLink } from './compare-pncp.js';
import type { ContratacaoEnrichmentResponse } from './enrichment-api.js';
import type { CatalogMatchMethod, PncpParsedFacets } from '../pncp/parse-pncp-facets.js';
import {
  buildGruposWithItens,
  normalizeContratacaoItem,
  type ContratacaoGrupo,
  type ContratacaoItemRico,
} from './normalize-contratacao-itens.js';

export type { ContratacaoGrupo, ContratacaoItemRico } from './normalize-contratacao-itens.js';

function buildPncpAppUrl(cnpj: string, ano: number, sequencial: number): string {
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
}

function buildComprasGovUrl(idCompra: string | null, urlOrigem: string | null): string | null {
  if (urlOrigem?.startsWith('http')) return urlOrigem;
  if (idCompra) {
    return `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${idCompra}`;
  }
  return extractIdCompraFromLink(urlOrigem)
    ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${extractIdCompraFromLink(urlOrigem)}`
    : null;
}

export type ContratacaoDetailItem = {
  numero_item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  situacao: string;
};

export type ContratacaoDetailAnexo = {
  id: string;
  nome: string;
  tipo: string;
  grupo: string;
  data_publicacao: string;
  url_download?: string;
};

export type ContratacaoDetailHistorico = {
  data_hora: string;
  evento: string;
  descricao?: string;
  responsavel?: string;
};

export type ContratacaoDetailResumo = {
  codigo: string;
  numero_processo: string;
  edital: string;
  modalidade: string;
  fase: string;
  situacao: string;
  unidade: string;
  unidade_compradora: string;
  inicio_propostas: string | null;
  termino_propostas: string | null;
  objeto: string;
  objeto_curto: string;
  valor_estimado: number | null;
  total_homologado: number | null;
  link_canonico: string;
  link_pncp: string;
  link_compras_gov: string | null;
  fonte: string;
  numero_controle_pncp: string;
  status_normalizado: {
    code: string;
    label: string;
    family: string;
    is_valid: boolean;
  };
};

export type ContratacaoDetailResponse = {
  resumo: ContratacaoDetailResumo;
  itens: ContratacaoDetailItem[];
  grupos: ContratacaoGrupo[];
  itens_avulsos: ContratacaoItemRico[];
  anexos: ContratacaoDetailAnexo[];
  historico: ContratacaoDetailHistorico[];
  enriquecimento: Omit<ContratacaoEnrichmentResponse, 'contratacaoId'> & { contratacao_id: string };
};

function formatDateTimeBR(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function resolveStatusFamily(modalidade: string | null): string {
  const m = (modalidade ?? '').toLowerCase();
  if (m.includes('pregão') || m.includes('pregao')) return 'PregaoEletronico';
  if (m.includes('dispensa')) return 'CompraDireta';
  if (m.includes('concorrência') || m.includes('concorrencia')) return 'ProcessoDeContratacao';
  return 'ProcessoDeContratacao';
}

function buildHistorico(input: {
  dataPublicacao: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  situacao: string | null;
}): ContratacaoDetailHistorico[] {
  const events: ContratacaoDetailHistorico[] = [];
  const pub = formatDateTimeBR(input.dataPublicacao);
  if (pub) {
    events.push({
      data_hora: pub,
      evento: 'Publicação no PNCP',
      descricao: 'Contratação divulgada no Portal Nacional de Contratações Públicas.',
      responsavel: 'PNCP',
    });
  }
  const inicio = formatDateTimeBR(input.dataInicio);
  if (inicio) {
    events.push({
      data_hora: inicio,
      evento: 'Início do recebimento de propostas',
      responsavel: 'Sistema PNCP',
    });
  }
  const fim = formatDateTimeBR(input.dataFim);
  if (fim) {
    events.push({
      data_hora: fim,
      evento: 'Encerramento de propostas',
      responsavel: 'Sistema PNCP',
    });
  }
  if (input.situacao?.toLowerCase().includes('anulada')) {
    events.unshift({
      data_hora: fim ?? pub ?? '—',
      evento: 'Contratação anulada',
      descricao: input.situacao,
      responsavel: 'Órgão contratante',
    });
  }
  return events.sort((a, b) => {
    const parse = (s: string) => {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
      if (!m) return 0;
      return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
    };
    return parse(b.data_hora) - parse(a.data_hora);
  });
}

function buildAnexos(raw: Record<string, unknown>, linkPncp: string): ContratacaoDetailAnexo[] {
  const arquivos = raw.arquivos;
  if (!Array.isArray(arquivos)) return [];
  return arquivos
    .map((a, idx) => {
      const file = a as Record<string, unknown>;
      const url = typeof file.url === 'string' ? file.url : linkPncp;
      const nome =
        (typeof file.titulo === 'string' && file.titulo) ||
        (typeof file.tipoDocumentoNome === 'string' && file.tipoDocumentoNome) ||
        `Documento ${idx + 1}`;
      return {
        id: `anx-pncp-${idx + 1}`,
        nome,
        tipo: typeof file.tipoDocumentoNome === 'string' ? file.tipoDocumentoNome : 'PDF',
        grupo: 'Processo',
        data_publicacao: '—',
        url_download: url,
      };
    })
    .filter((a) => Boolean(a.url_download));
}

export function buildContratacaoDetail(input: {
  id: string;
  numeroControlePncp: string;
  cnpjOrgao: string;
  ano: number;
  sequencialCompra: number;
  numeroCompra: string | null;
  numeroProcesso: string | null;
  modalidadeNome: string | null;
  modoDisputa: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  objeto: string | null;
  valorEstimado: number | null;
  dataPublicacao: Date | null;
  dataInicioPropostas: Date | null;
  dataFimPropostas: Date | null;
  urlOrigem: string | null;
  rawJson: Record<string, unknown> | null;
  itens: Array<{
    numero_item: number;
    descricao: string;
    quantidade: number | null;
    unidade_medida: string | null;
    valor_unitario_estimado: number | null;
    valor_total_estimado: number | null;
    situacao: string | null;
    codigo_catalogo: string | number | null;
    catalogo_tipo: string | null;
    ncm_nbs?: string | null;
    parsed_facets?: PncpParsedFacets | null;
    catalog_match_method?: CatalogMatchMethod | null;
    criterio_julgamento: string | null;
    beneficio_me_epp: string | null;
    raw_json: Record<string, unknown> | null;
  }>;
  enrichment: ContratacaoEnrichmentResponse;
}): ContratacaoDetailResponse {
  const raw = input.rawJson ?? {};
  const unidadeOrgao = raw.unidadeOrgao as Record<string, unknown> | undefined;
  const unidade =
    (typeof unidadeOrgao?.nomeUnidade === 'string' && unidadeOrgao.nomeUnidade) ||
    `${input.municipio ?? ''} ${input.uf ?? ''}`.trim() ||
    '—';

  const objeto = input.objeto ?? 'Objeto não informado';
  const objetoCurto = objeto.length > 100 ? `${objeto.slice(0, 97)}...` : objeto;
  const linkPncp = buildPncpAppUrl(input.cnpjOrgao, input.ano, input.sequencialCompra);
  const linkCg = buildComprasGovUrl(input.enrichment.idCompra, input.urlOrigem);

  const situacao = input.situacao ?? 'Não informada';
  const modalidade = input.modalidadeNome ?? '—';

  const resumo: ContratacaoDetailResumo = {
    codigo: String(input.sequencialCompra),
    numero_processo: input.numeroProcesso ?? input.numeroControlePncp,
    edital: input.numeroCompra ?? '—',
    modalidade,
    fase: input.modoDisputa ?? situacao,
    situacao,
    unidade,
    unidade_compradora: unidade,
    inicio_propostas: formatDateTimeBR(input.dataInicioPropostas),
    termino_propostas: formatDateTimeBR(input.dataFimPropostas),
    objeto,
    objeto_curto: objetoCurto,
    valor_estimado: input.valorEstimado,
    total_homologado: null,
    link_canonico: linkCg ?? linkPncp,
    link_pncp: linkPncp,
    link_compras_gov: linkCg,
    fonte: 'PNCP — Portal Nacional de Contratações Públicas',
    numero_controle_pncp: input.numeroControlePncp,
    status_normalizado: {
      code: situacao.toUpperCase().replace(/\s+/g, '_').slice(0, 40),
      label: situacao,
      family: resolveStatusFamily(modalidade),
      is_valid: true,
    },
  };

  const itensRicos: ContratacaoItemRico[] = input.itens.map((i) =>
    normalizeContratacaoItem({
      numero_item: i.numero_item,
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade_medida: i.unidade_medida,
      valor_unitario_estimado: i.valor_unitario_estimado,
      valor_total_estimado: i.valor_total_estimado,
      situacao: i.situacao,
      codigo_catalogo: i.codigo_catalogo,
      catalogo_tipo: i.catalogo_tipo,
      ncm_nbs: i.ncm_nbs,
      parsed_facets: i.parsed_facets,
      catalog_match_method: i.catalog_match_method,
      criterio_julgamento: i.criterio_julgamento,
      beneficio_me_epp: i.beneficio_me_epp,
      raw_json: i.raw_json,
    }),
  );

  const itens: ContratacaoDetailItem[] = itensRicos.map((i) => ({
    numero_item: i.numero_item,
    descricao: i.descricao_detalhada,
    quantidade: i.quantidade,
    unidade: i.unidade,
    valor_unitario: i.valor_unitario,
    valor_total: i.valor_total,
    situacao: i.situacao,
  }));

  const { grupos, itens_avulsos } = buildGruposWithItens(input.numeroControlePncp, itensRicos);

  const { contratacaoId, ...enrichmentRest } = input.enrichment;

  return {
    resumo,
    itens,
    grupos,
    itens_avulsos,
    anexos: buildAnexos(raw, linkPncp),
    historico: buildHistorico({
      dataPublicacao: input.dataPublicacao,
      dataInicio: input.dataInicioPropostas,
      dataFim: input.dataFimPropostas,
      situacao: input.situacao,
    }),
    enriquecimento: {
      contratacao_id: contratacaoId,
      ...enrichmentRest,
    },
  };
}
