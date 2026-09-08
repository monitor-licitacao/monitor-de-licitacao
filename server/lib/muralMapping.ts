/**
 * Explicit card field mapping for raw mislabeled dump keys
 * Task: Explicit card field mapping (dump keys were MISLABELED)
 *
 * MAPPING TABLE:
 * - codigo             ← CÓDIGO
 * - numero_processo    ← Chamamento público
 * - unidade_compradora ← PROCESSO
 * - objeto             ← Linha de fornecimento
 * - modalidade         ← Edital
 * - inicio_propostas   ← UNIDADE COMPRADORA (mislabel — it's a datetime)
 * - termino_propostas  ← OBJETO (mislabel — it's a datetime)
 * - inicio_inscricoes  ← Início das inscrições
 */

import { CANONICAL_SISTEMA_S_URLS, isRejectedSistemaSUrl } from './sistemaSUrls.js';

export const RAW_DUMP_FIELD_MAPPING = {
  codigo: 'CÓDIGO',
  numero_processo: 'Chamamento público',
  unidade_compradora: 'PROCESSO',
  objeto: 'Linha de fornecimento',
  modalidade: 'Edital',
  inicio_propostas: 'UNIDADE COMPRADORA',
  termino_propostas: 'OBJETO',
  inicio_inscricoes: 'Início das inscrições',
} as const;

export const FIELD_MAPPING_DOCUMENTATION = [
  { canonicalField: 'codigo', rawDumpKey: 'CÓDIGO', note: 'Identificador numérico do item no mural (ex: 76)' },
  { canonicalField: 'numero_processo', rawDumpKey: 'Chamamento público', note: 'Número oficial do processo (ex: 000010901-2/2026)' },
  { canonicalField: 'unidade_compradora', rawDumpKey: 'PROCESSO', note: 'Unidade compradora responsável (ex: B 077 - SEST - MARABA/PA)' },
  { canonicalField: 'objeto', rawDumpKey: 'Linha de fornecimento', note: 'Descrição do objeto / linha de fornecimento licitada' },
  { canonicalField: 'modalidade', rawDumpKey: 'Edital', note: 'Modalidade da contratação (ex: Pregão Eletrônico, Concorrência)' },
  { canonicalField: 'inicio_propostas', rawDumpKey: 'UNIDADE COMPRADORA', note: 'MISLABEL no dump HTML: contém data/hora de início das propostas' },
  { canonicalField: 'termino_propostas', rawDumpKey: 'OBJETO', note: 'MISLABEL no dump HTML: contém data/hora de término das propostas' },
  { canonicalField: 'inicio_inscricoes', rawDumpKey: 'Início das inscrições', note: 'Data de início das inscrições (quando aplicável)' },
] as const;

export interface CanonicalMuralProcess {
  codigo: string;
  numero_processo: string;
  unidade_compradora: string;
  objeto: string;
  modalidade: string;
  inicio_propostas: string | null;
  termino_propostas: string | null;
  inicio_inscricoes: string | null;
  status_bruto?: string | null;
  status_normalizado?: {
    code: string;
    label: string;
    family: string;
  } | null;
  link_canonico: string;
  fonte?: string;
  raw_keys_received?: Record<string, any>;
}

export interface MuralCardMVP {
  codigo: string;
  numero_processo: string;
  unidade: string;
  objeto_curto: string;
  objeto_completo: string;
  modalidade: string;
  datas: {
    inicio_propostas: string | null;
    termino_propostas: string | null;
    inicio_inscricoes: string | null;
  };
  status_normalizado: {
    code: string;
    label: string;
    family: string;
    is_valid: boolean;
  };
  link_canonico: string;
  fonte_confirmada: boolean;
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowEntries = Object.entries(row);
  const normalizedKeyMap = new Map<string, any>();
  for (const [k, v] of rowEntries) {
    normalizedKeyMap.set(normalizeKey(k), v);
  }

  for (const key of possibleKeys) {
    if (key in row && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
    const norm = normalizeKey(key);
    if (normalizedKeyMap.has(norm)) {
      return normalizedKeyMap.get(norm);
    }
  }
  return null;
}

/**
 * Truncate long object description to 2 lines max (~140 chars) for card MVP
 */
export function toShortObject(text: string, maxLength: number = 140): string {
  if (!text) return '—';
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) {
    return clean;
  }
  return clean.slice(0, maxLength - 1).trim() + '…';
}

/**
 * Maps a single raw dump row (with mislabeled keys) to the canonical structure
 */
export function mapRawDumpToCanonical(
  rawRow: Record<string, any>,
  defaults: {
    link_canonico?: string;
    fonte?: string;
    family?: string;
    status_normalizado?: { code: string; label: string; family: string } | null;
  } = {}
): CanonicalMuralProcess {
  // 1. codigo ← CÓDIGO
  const rawCodigo = findValue(rawRow, ['CÓDIGO', 'CODIGO', 'codigo', 'Código']);
  const codigo = rawCodigo ? String(rawCodigo).trim() : '—';

  // 2. numero_processo ← Chamamento público
  const rawNumero = findValue(rawRow, [
    'Chamamento público',
    'Chamamento publico',
    'chamamento_publico',
    'numero_processo',
    'Nº do processo',
    'Processo',
  ]);
  const numero_processo = rawNumero ? String(rawNumero).trim() : '—';

  // 3. unidade_compradora ← PROCESSO
  const rawUnidade = findValue(rawRow, [
    'PROCESSO',
    'processo',
    'Unidade compradora',
    'unidade_compradora',
    'Unidade',
  ]);
  const unidade_compradora = rawUnidade ? String(rawUnidade).trim() : '—';

  // 4. objeto ← Linha de fornecimento
  const rawObjeto = findValue(rawRow, [
    'Linha de fornecimento',
    'linha_de_fornecimento',
    'objeto',
    'Objeto',
    'Descrição',
    'Descricao',
  ]);
  const objeto = rawObjeto ? String(rawObjeto).trim() : '—';

  // 5. modalidade ← Edital
  const rawModalidade = findValue(rawRow, [
    'Edital',
    'edital',
    'modalidade',
    'Modalidade',
  ]);
  const modalidade = rawModalidade ? String(rawModalidade).trim() : '—';

  // 6. inicio_propostas ← UNIDADE COMPRADORA (mislabel: it is a datetime)
  const rawInicioPropostas = findValue(rawRow, [
    'UNIDADE COMPRADORA',
    'unidade compradora',
    'inicio_propostas',
    'Início das propostas',
    'Data/Hora inicial',
  ]);
  const inicio_propostas = rawInicioPropostas ? String(rawInicioPropostas).trim() : null;

  // 7. termino_propostas ← OBJETO (mislabel: it is a datetime)
  const rawTerminoPropostas = findValue(rawRow, [
    'OBJETO',
    'objeto',
    'termino_propostas',
    'Término das propostas',
    'Data/Hora final',
  ]);
  const termino_propostas = rawTerminoPropostas ? String(rawTerminoPropostas).trim() : null;

  // 8. inicio_inscricoes ← Início das inscrições
  const rawInicioInscricoes = findValue(rawRow, [
    'Início das inscrições',
    'Inicio das inscricoes',
    'inicio_inscricoes',
  ]);
  const inicio_inscricoes = rawInicioInscricoes ? String(rawInicioInscricoes).trim() : null;

  // Status & Link
  const status_bruto = findValue(rawRow, ['Situação', 'Situacao', 'status', 'Status']);
  const rawLink = findValue(rawRow, ['link_canonico', 'link', 'url', 'Url']);
  
  // Enforce canonical URL if mock or absent
  let link_canonico = rawLink ? String(rawLink).trim() : defaults.link_canonico || CANONICAL_SISTEMA_S_URLS.SEST_SENAT;
  const rejection = isRejectedSistemaSUrl(link_canonico);
  if (rejection.rejected && rejection.canonicalSuggestion) {
    link_canonico = rejection.canonicalSuggestion;
  }

  return {
    codigo,
    numero_processo,
    unidade_compradora,
    objeto,
    modalidade,
    inicio_propostas,
    termino_propostas,
    inicio_inscricoes,
    status_bruto: status_bruto ? String(status_bruto).trim() : null,
    status_normalizado: defaults.status_normalizado || null,
    link_canonico,
    fonte: defaults.fonte || 'SEST SENAT / Paradigma Mural',
    raw_keys_received: rawRow,
  };
}

/**
 * Transforms a canonical process into the Card MVP shape defined by Frontend Design spec
 */
export function toCardMVP(
  process: CanonicalMuralProcess,
  catalogStatus?: { code: string; label: string; family: string; active?: boolean } | null
): MuralCardMVP {
  const rejection = isRejectedSistemaSUrl(process.link_canonico);
  const isConfirmedCanonical =
    Boolean(process.link_canonico) &&
    !rejection.rejected &&
    (process.link_canonico.includes('paradigmabs.com.br') ||
      process.link_canonico.includes('compras.sestsenat.org.br'));

  const status_normalizado = catalogStatus
    ? {
        code: catalogStatus.code,
        label: catalogStatus.label,
        family: catalogStatus.family,
        is_valid: catalogStatus.active !== false,
      }
    : process.status_normalizado
    ? {
        code: process.status_normalizado.code,
        label: process.status_normalizado.label,
        family: process.status_normalizado.family,
        is_valid: true,
      }
    : {
        code: process.status_bruto || 'DESCONHECIDO',
        label: process.status_bruto || 'Status inválido',
        family: 'Desconhecida',
        is_valid: false,
      };

  return {
    codigo: process.codigo || '—',
    numero_processo: process.numero_processo || '—',
    unidade: process.unidade_compradora || '—',
    objeto_curto: toShortObject(process.objeto),
    objeto_completo: process.objeto || '—',
    modalidade: process.modalidade || '—',
    datas: {
      inicio_propostas: process.inicio_propostas,
      termino_propostas: process.termino_propostas,
      inicio_inscricoes: process.inicio_inscricoes,
    },
    status_normalizado,
    link_canonico: process.link_canonico,
    fonte_confirmada: isConfirmedCanonical,
  };
}
