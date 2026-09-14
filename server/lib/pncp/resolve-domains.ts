/**
 * Issue #82 — extrai só IDs explícitos do payload PNCP.
 * Sem matching por nome, valor, objeto ou modalidade presumida.
 */
import type { PncpCompraDto } from './types.js';

export type PncpDomainKeys = {
  modalidadePncpId: number | null;
  instrumentoPncpId: number | null;
  amparoPncpId: number | null;
};

function asPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number.parseInt(value, 10);
    return n > 0 ? n : null;
  }
  return null;
}

export function extractDomainKeys(compra: PncpCompraDto): PncpDomainKeys {
  return {
    modalidadePncpId: asPositiveInt(compra.modalidadeId),
    instrumentoPncpId: asPositiveInt(compra.tipoInstrumentoConvocatorioCodigo),
    amparoPncpId: asPositiveInt(compra.amparoLegal?.codigo),
  };
}
