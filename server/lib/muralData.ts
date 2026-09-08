/**
 * Mural Data Store and Golden Process 000010901-2/2026 Support
 * Task: Golden process support (Processo 000010901-2/2026 / codigo 76)
 */

import { CANONICAL_SISTEMA_S_URLS } from './sistemaSUrls.js';
import {
  CanonicalMuralProcess,
  MuralCardMVP,
  mapRawDumpToCanonical,
  toCardMVP,
} from './muralMapping.js';
import { statusCatalogRepository } from './statusCatalog.js';

export interface MuralProcessItem {
  numero_item: number;
  descricao: string;
  marca?: string;
  quantidade: number;
  unidade: string;
  valor_unitario?: number | null;
  valor_total?: number | null;
  situacao: string;
  ranking?: {
    posicao: number;
    empresa: string;
    cnpj: string;
    valor: number;
    data_proposta?: string;
  }[];
}

export interface MuralProcessAnexo {
  id: string;
  nome: string;
  tipo: string;
  grupo: 'Processo' | 'Proposta' | 'Habilitação';
  data_publicacao: string;
  tamanho?: string;
  url_download?: string;
}

export interface MuralProcessHistorico {
  data_hora: string;
  evento: string;
  descricao?: string;
  responsavel?: string;
}

export interface MuralProcessDetail {
  resumo: {
    codigo: string;
    numero_processo: string;
    edital: string;
    modalidade: string;
    fase: string;
    situacao: string;
    unidade: string;
    unidade_compradora: string;
    email_contato?: string | null;
    inicio_propostas: string | null;
    termino_propostas: string | null;
    data_homologacao?: string | null;
    objeto: string;
    objeto_curto: string;
    valor_estimado?: number | null;
    total_homologado?: number | null;
    link_canonico: string;
    fonte: string;
    status_normalizado: {
      code: string;
      label: string;
      family: string;
      is_valid: boolean;
    };
  };
  itens: MuralProcessItem[];
  anexos: MuralProcessAnexo[];
  historico: MuralProcessHistorico[];
}

/**
 * GOLDEN PROCESS: Processo 000010901-2/2026 / Mural Código 76
 * SEST SENAT Unidade B 077 - Marabá/PA
 * Real extracted data from SEI edital, technical review despacho, and Sport Mania realigned proposal
 */
export const GOLDEN_PROCESS_76: MuralProcessDetail = {
  resumo: {
    codigo: '76',
    numero_processo: '000010901-2/2026',
    edital: 'PG 002/2026',
    modalidade: 'Pregão Eletrônico',
    fase: 'Homologação',
    situacao: 'Homologado',
    unidade: 'B 077 - SEST - MARABA/PA',
    unidade_compradora: 'B 077 - SEST - MARABA/PA',
    email_contato: 'licitacao.b077@sestsenat.org.br',
    inicio_propostas: '07/08/2026 09:30',
    termino_propostas: '14/08/2026 09:45',
    data_homologacao: '19/08/2026 08:18',
    objeto:
      'Contratação de empresa especializada no fornecimento de ACESSÓRIOS PARA EQUIPAMENTOS DE MUSCULAÇÃO destinados à estruturação do espaço físico para a prática de atividades físicas da Unidade Operacional do SEST SENAT B 077 em Marabá/PA, de acordo com as especificações deste Edital e seus Anexos.',
    objeto_curto:
      'Fornecimento de acessórios para equipamentos de musculação para o SEST SENAT Marabá/PA',
    valor_estimado: 6605.39,
    // Do not invent fake sums: reflect actual proposal payload if present
    total_homologado: null,
    link_canonico: CANONICAL_SISTEMA_S_URLS.SEST_SENAT,
    fonte: 'SEST SENAT — Portal de Compras Eletrônicas (Mural)',
    status_normalizado: {
      code: 'HOMOLOGADO',
      label: 'Homologado',
      family: 'PregaoEletronico',
      is_valid: true,
    },
  },
  itens: [
    {
      numero_item: 1,
      descricao:
        'KIT DE PUXADORES ANATÔMICOS COM 5 PEÇAS + SUPORTE. Produzido em aço carbono com revestimento emborrachado texturizado na cor preto.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 1,
      unidade: 'KIT',
      valor_unitario: 1651.0,
      valor_total: 1651.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 1651.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 2,
      descricao:
        'TORNOZELEIRAS PARA EXERCÍCIOS DE POLIA “COM ALÇA” NA SOLA. Fabricado em nylon e/ou Polipropileno com acolchoamento e ferragens metálicas.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 8,
      unidade: 'UNID.',
      valor_unitario: 83.0,
      valor_total: 664.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 664.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 3,
      descricao:
        'TORNOZELEIRAS PARA EXERCÍCIOS DE POLIA “SEM ALÇA”. Fabricado em nylon e/ou Polipropileno com acolchoamento e ferragens metálicas.',
      marca: 'XDFITNES',
      quantidade: 8,
      unidade: 'UNID.',
      valor_unitario: 64.0,
      valor_total: 212.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 212.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 4,
      descricao:
        'PUXADOR CORDA PARA TRÍCEPS. Confeccionada em polietileno ou nylon premium trançada com anel de metal para engate.',
      marca: 'SCALIBU',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 112.0,
      valor_total: 224.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 224.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 5,
      descricao:
        'PUXADOR TRIÂNGULO PARA REMADA COM PEGADA EMBORRACHADA. Fabricado em aço maciço cromado com solda MIG ultra resistente.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 190.0,
      valor_total: 380.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 380.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 6,
      descricao:
        'PUXADOR REMADA NEUTRA PULLEY TIPO D. Fabricado em aço cromado com solda MIG ultra resistente, manopla com giro total em PVC.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 271.0,
      valor_total: 542.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 542.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 7,
      descricao:
        'PUXADOR PULLEY TRICEPS PARA CROSSOVER COM GIRO - BARRA RETA CURTA. Tubo oco de aço 1020, manopla emborrachada.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 151.0,
      valor_total: 302.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 302.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 8,
      descricao:
        'PUXADOR PULLEY TRICEPS PARA CROSSOVER COM GIRO - BARRA RETA LONGA. Comprimento 1,0 metro, manopla emborrachada.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 211.0,
      valor_total: 422.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 422.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 9,
      descricao:
        'PUXADOR BARRA W COM GIRO. Tubo oco de aço 1020 com giro central e solda MIG reforçada.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 234.5,
      valor_total: 469.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 469.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 10,
      descricao:
        'PUXADOR BARRA PULLEY COSTAS CURVO. Tubo oco de aço 1020 com giro central, comprimento 120 cm.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 2,
      unidade: 'UNID.',
      valor_unitario: 217.5,
      valor_total: 435.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 435.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 11,
      descricao:
        'PAR DE PUXADOR ESTRIBO FECHADO. Produzido em aço maciço, cromado, pegada recartilhada giratória de 360°.',
      marca: 'ANILHAS DE FERRO',
      quantidade: 3,
      unidade: 'PAR',
      valor_unitario: 182.0,
      valor_total: 546.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 546.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
    {
      numero_item: 12,
      descricao:
        'MOSQUETÃO 8 x 80mm. Fabricado em aço carbono galvanizado, suporta até 230 kg.',
      marca: 'GRS CABOS',
      quantidade: 20,
      unidade: 'UNID.',
      valor_unitario: 22.0,
      valor_total: 440.0,
      situacao: 'Homologado',
      ranking: [
        {
          posicao: 1,
          empresa: 'SPORT MANIA COMÉRCIO, LOCAÇÕES E SERVIÇOS LTDA',
          cnpj: '13.721.423/0001-42',
          valor: 440.0,
          data_proposta: '17/08/2026',
        },
      ],
    },
  ],
  anexos: [
    {
      id: 'anx-0739773',
      nome: 'Edital de Licitação PG 002/2026 - Acessórios para Equipamentos de Musculação',
      tipo: 'PDF',
      grupo: 'Processo',
      data_publicacao: '07/08/2026',
      tamanho: '1.24 MB',
      url_download: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    },
    {
      id: 'anx-0757338',
      nome: 'Despacho - Resposta da Análise Técnica I (0757338)',
      tipo: 'PDF',
      grupo: 'Processo',
      data_publicacao: '14/08/2026',
      tamanho: '48.1 KB',
      url_download: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    },
    {
      id: 'anx-prop-realinhada',
      nome: 'PROPOSTA_COMERCIAL_REALINHADA_2.pdf',
      tipo: 'PDF',
      grupo: 'Proposta',
      data_publicacao: '17/08/2026',
      tamanho: '614 KB',
      url_download: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    },
    {
      id: 'anx-hab-01',
      nome: 'HABILITAÇÃO.rar',
      tipo: 'RAR',
      grupo: 'Habilitação',
      data_publicacao: '14/08/2026',
      tamanho: '15.3 MB',
      url_download: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    },
    {
      id: 'anx-hab-02',
      nome: 'ANEXO A, FOLDERS E DECLARAÇÃO DE AUSENCIA DE IMPEDIMENTOS.rar',
      tipo: 'RAR',
      grupo: 'Habilitação',
      data_publicacao: '14/08/2026',
      tamanho: '1.46 MB',
      url_download: 'https://compras.sestsenat.org.br/portal/Mural.aspx',
    },
  ],
  historico: [
    {
      data_hora: '19/08/2026 08:18',
      evento: 'Homologação do Processo',
      descricao: 'Processo licitatório homologado pela autoridade competente.',
      responsavel: 'SEST SENAT - Unidade B 077',
    },
    {
      data_hora: '17/08/2026 14:00',
      evento: 'Recebimento de Proposta Realinhada',
      descricao: 'Sport Mania Comércio apresentou proposta comercial realinhada.',
      responsavel: 'Comissão de Licitação',
    },
    {
      data_hora: '14/08/2026 15:32',
      evento: 'Despacho de Análise Técnica I',
      descricao: 'Análise de documentos técnicos favorável para os 12 itens.',
      responsavel: 'Adriele de Castro Almeida (Fisioterapeuta / Coordenadora)',
    },
    {
      data_hora: '14/08/2026 10:00',
      evento: 'Abertura da Sessão Pública',
      descricao: 'Início da sessão pública e disputa aberta de lances.',
      responsavel: 'Pregoeiro(a) / Equipe de Apoio',
    },
    {
      data_hora: '14/08/2026 09:45',
      evento: 'Término do Envio de Propostas',
      descricao: 'Encerramento do prazo para recebimento de propostas iniciais.',
      responsavel: 'Sistema Eletrônico',
    },
    {
      data_hora: '07/08/2026 09:30',
      evento: 'Publicação do Edital e Início das Propostas',
      descricao: 'Edital PG 002/2026 publicado no portal Mural.aspx.',
      responsavel: 'SEST SENAT - CRN II',
    },
  ],
};

/**
 * Collection of active Mural processes seeded with canonical mapping
 */
const MURAL_PROCESSES_STORE: Map<string, MuralProcessDetail> = new Map();
MURAL_PROCESSES_STORE.set('76', GOLDEN_PROCESS_76);
MURAL_PROCESSES_STORE.set('000010901-2/2026', GOLDEN_PROCESS_76);

// Additional sample processes with canonical URLs for SESC DN and SEST/SENAT
const SESC_DN_PROCESS_188: MuralProcessDetail = {
  resumo: {
    codigo: '188',
    numero_processo: 'PE 2026012000042',
    edital: 'PE 042/2026',
    modalidade: 'Pregão Eletrônico',
    fase: 'Em proposta',
    situacao: 'Em proposta',
    unidade: 'SESC - Departamento Nacional',
    unidade_compradora: 'SESC - Departamento Nacional',
    email_contato: 'licitacoes@sesc.com.br',
    inicio_propostas: '20/08/2026 10:00',
    termino_propostas: '10/09/2026 14:00',
    data_homologacao: null,
    objeto:
      'Aquisição de esteiras ergométricas profissionais e estações multifuncionais para modernização dos centros de cultura física do SESC.',
    objeto_curto:
      'Esteiras ergométricas e estações multifuncionais para o SESC Departamento Nacional',
    valor_estimado: 1850000.0,
    total_homologado: null,
    link_canonico: CANONICAL_SISTEMA_S_URLS.SESC_DN,
    fonte: 'SESC Departamento Nacional — Portal de Compras (Mural)',
    status_normalizado: {
      code: 'EM_PROPOSTA',
      label: 'Em proposta',
      family: 'PregaoEletronico',
      is_valid: true,
    },
  },
  itens: [], // Honest empty: no fake OCR or fake NCM items invented
  anexos: [
    {
      id: 'anx-sesc-042',
      nome: 'Edital de Pregão Eletrônico PE 042/2026 - Cultura Física',
      tipo: 'PDF',
      grupo: 'Processo',
      data_publicacao: '20/08/2026',
      tamanho: '2.4 MB',
      url_download: CANONICAL_SISTEMA_S_URLS.SESC_DN,
    },
  ],
  historico: [
    {
      data_hora: '20/08/2026 10:00',
      evento: 'Publicação do Edital',
      descricao: 'Edital publicado no portal Mural.aspx do SESC DN.',
      responsavel: 'SESC DN',
    },
  ],
};
MURAL_PROCESSES_STORE.set('188', SESC_DN_PROCESS_188);
MURAL_PROCESSES_STORE.set('PE 2026012000042', SESC_DN_PROCESS_188);

export async function getMuralProcessDetail(
  identifier: string
): Promise<MuralProcessDetail | null> {
  if (!identifier) return null;
  const clean = identifier.trim();
  let found = MURAL_PROCESSES_STORE.get(clean) || null;

  // Lookup by codigo or numero_processo
  if (!found) {
    for (const item of MURAL_PROCESSES_STORE.values()) {
      if (
        item.resumo.codigo === clean ||
        item.resumo.numero_processo.toLowerCase() === clean.toLowerCase()
      ) {
        found = item;
        break;
      }
    }
  }

  if (!found) return null;

  // Refresh status label from catalog if edited
  const catalogEntry = await statusCatalogRepository.getByFamilyAndCode(
    found.resumo.status_normalizado.family,
    found.resumo.status_normalizado.code
  );
  if (catalogEntry) {
    return {
      ...found,
      resumo: {
        ...found.resumo,
        status_normalizado: {
          ...found.resumo.status_normalizado,
          label: catalogEntry.label
        }
      }
    };
  }

  return found;
}

export async function listMuralCards(filters?: {
  family?: string;
  status?: string;
  search?: string;
}): Promise<MuralCardMVP[]> {
  const cards: MuralCardMVP[] = [];
  const seenCodes = new Set<string>();

  for (const item of MURAL_PROCESSES_STORE.values()) {
    if (seenCodes.has(item.resumo.codigo)) {
      continue;
    }
    seenCodes.add(item.resumo.codigo);

    // Dynamic catalog label lookup
    const catalogEntry = await statusCatalogRepository.getByFamilyAndCode(
      item.resumo.status_normalizado.family,
      item.resumo.status_normalizado.code
    );
    const liveStatus = catalogEntry ? {
      ...item.resumo.status_normalizado,
      label: catalogEntry.label
    } : item.resumo.status_normalizado;

    // Apply filters
    if (filters?.family && liveStatus.family !== filters.family) {
      continue;
    }
    if (
      filters?.status &&
      liveStatus.code.toLowerCase() !== filters.status.toLowerCase() &&
      liveStatus.label.toLowerCase() !== filters.status.toLowerCase()
    ) {
      continue;
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      const matched =
        item.resumo.codigo.toLowerCase().includes(q) ||
        item.resumo.numero_processo.toLowerCase().includes(q) ||
        item.resumo.unidade.toLowerCase().includes(q) ||
        item.resumo.objeto.toLowerCase().includes(q);
      if (!matched) {
        continue;
      }
    }

    const canonical: CanonicalMuralProcess = {
      codigo: item.resumo.codigo,
      numero_processo: item.resumo.numero_processo,
      unidade_compradora: item.resumo.unidade_compradora,
      objeto: item.resumo.objeto,
      modalidade: item.resumo.modalidade,
      inicio_propostas: item.resumo.inicio_propostas,
      termino_propostas: item.resumo.termino_propostas,
      inicio_inscricoes: null,
      status_bruto: item.resumo.situacao,
      status_normalizado: liveStatus,
      link_canonico: item.resumo.link_canonico,
      fonte: item.resumo.fonte,
    };

    cards.push(toCardMVP(canonical, liveStatus));
  }

  return cards;
}

/**
 * Register a new process into the mural store after mapping and status validation
 */
export async function registerMuralProcess(
  rawRow: Record<string, any>,
  family: string = 'PregaoEletronico'
): Promise<{ card: MuralCardMVP; detail: MuralProcessDetail }> {
  const canonical = mapRawDumpToCanonical(rawRow);

  // Validate status fail-closed
  const statusToValidate = canonical.status_bruto || 'AGENDADO_PUBLICADO';
  const validation = await statusCatalogRepository.validateStatusOnWrite(family, statusToValidate);
  if (!validation.valid) {
    throw new Error(
      `Falha de validação de status: ${validation.error || 'Status não catalogado'}`
    );
  }

  const status_normalizado = {
    code: validation.status!.code,
    label: validation.status!.label,
    family: validation.status!.family,
    is_valid: true,
  };

  const detail: MuralProcessDetail = {
    resumo: {
      codigo: canonical.codigo,
      numero_processo: canonical.numero_processo,
      edital: canonical.modalidade,
      modalidade: canonical.modalidade,
      fase: validation.status!.label,
      situacao: validation.status!.label,
      unidade: canonical.unidade_compradora,
      unidade_compradora: canonical.unidade_compradora,
      email_contato: null,
      inicio_propostas: canonical.inicio_propostas,
      termino_propostas: canonical.termino_propostas,
      data_homologacao: null,
      objeto: canonical.objeto,
      objeto_curto: toCardMVP(canonical, status_normalizado).objeto_curto,
      valor_estimado: null,
      total_homologado: null,
      link_canonico: canonical.link_canonico,
      fonte: canonical.fonte || 'Paradigma Mural',
      status_normalizado,
    },
    itens: [],
    anexos: [],
    historico: [],
  };

  MURAL_PROCESSES_STORE.set(canonical.codigo, detail);
  if (canonical.numero_processo && canonical.numero_processo !== '—') {
    MURAL_PROCESSES_STORE.set(canonical.numero_processo, detail);
  }

  const card = toCardMVP(canonical, status_normalizado);
  return { card, detail };
}
