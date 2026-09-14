import { parseNumeroControlePncp } from '../pncp/resolve-controle.js';
import type { ContratacaoSnapshotSource, PipelineSnapshotInput } from './types.js';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function stripCnpj(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function buildSnapshotFromContratacao(
  row: ContratacaoSnapshotSource,
): PipelineSnapshotInput | { error: string } {
  const numero = row.numero_controle_pncp?.trim();
  if (!numero) {
    return { error: 'Contratação sem número de controle PNCP.' };
  }

  const parsed = parseNumeroControlePncp(numero);
  const orgaoCnpj = stripCnpj(row.cnpj_orgao || parsed?.cnpj || '');
  if (orgaoCnpj.length !== 14) {
    return { error: 'CNPJ do órgão inválido na contratação.' };
  }

  return {
    contratacao_id: row.id,
    numero_controle_pncp: numero,
    portal: 'PNCP',
    orgao_cnpj: orgaoCnpj,
    orgao_razao_social: row.orgao_razao_social ?? null,
    objeto_compra: row.objeto ?? null,
    modalidade_nome: row.modalidade_nome ?? null,
    valor_total_estimado: toNumber(row.valor_estimado),
    data_abertura_proposta: toIso(row.data_inicio_propostas),
    data_encerramento_proposta: toIso(row.data_fim_propostas),
    uf_sigla: row.uf ?? null,
    source_record_id: row.source_record_id ?? null,
  };
}
