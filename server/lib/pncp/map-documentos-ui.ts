import type { ContratacaoArquivoRow } from './persist-arquivos.js';
import type { ContratacaoLogPncpRow } from './persist-historico-pncp.js';

function formatDateTimeBR(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export type ContratacaoAnexoUi = {
  id: string;
  nome: string;
  tipo: string;
  grupo: string;
  data_publicacao: string;
  url_download?: string;
};

export type ContratacaoHistoricoPncpUi = {
  data_hora: string;
  evento: string;
  descricao?: string;
  responsavel?: string;
  documento_titulo?: string | null;
  item_numero?: number | null;
  justificativa?: string | null;
  source: 'pncp_log';
};

export function mapArquivosToAnexos(rows: ContratacaoArquivoRow[]): ContratacaoAnexoUi[] {
  return rows.map((row) => ({
    id: `arq-${row.sequencial_documento}`,
    nome: row.titulo,
    tipo: row.tipo_documento_nome ?? 'PDF',
    grupo: row.tipo_documento_nome ?? 'Processo',
    data_publicacao: formatDateTimeBR(row.data_publicacao_pncp) ?? '—',
    url_download: row.url_download,
  }));
}

export function mapHistoricoPncpToUi(rows: ContratacaoLogPncpRow[]): ContratacaoHistoricoPncpUi[] {
  return rows.map((row) => ({
    data_hora: formatDateTimeBR(row.occurred_at) ?? '—',
    evento: row.evento_label,
    descricao: row.documento_tipo ?? undefined,
    responsavel: row.usuario_nome ?? undefined,
    documento_titulo: row.documento_titulo,
    item_numero: row.item_numero,
    justificativa: row.justificativa,
    source: 'pncp_log' as const,
  }));
}
