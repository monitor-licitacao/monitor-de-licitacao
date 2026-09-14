import type { PncpSearchHit } from './types.js';

export type ParsedNumeroControle = {
  cnpj: string;
  ano: number;
  sequencial: number;
  numeroControlePncp: string;
};

/** Parse `{cnpj}-1-{sequencial}/{ano}` */
export function parseNumeroControlePncp(numeroControle: string): ParsedNumeroControle | null {
  const match = /^(\d{14})-1-(\d+)\/(\d{4})$/.exec(numeroControle.trim());
  if (!match) return null;
  return {
    cnpj: match[1],
    sequencial: Number.parseInt(match[2], 10),
    ano: Number.parseInt(match[3], 10),
    numeroControlePncp: numeroControle.trim(),
  };
}

function padSequencial(n: number): string {
  return String(n).padStart(6, '0');
}

function buildNumeroControle(cnpj: string, sequencial: number, ano: number): string {
  return `${cnpj}-1-${padSequencial(sequencial)}/${ano}`;
}

/**
 * Extrai numeroControlePNCP de um hit de publicação.
 * Fallback: monta a partir de CNPJ + sequencial + ano quando ausente.
 */
export function resolveControleFromSearchHit(hit: PncpSearchHit): ParsedNumeroControle | null {
  if (hit.numeroControlePNCP) {
    return parseNumeroControlePncp(hit.numeroControlePNCP);
  }

  const cnpj = hit.orgaoEntidade?.cnpj?.replace(/\D/g, '');
  const ano = hit.anoCompra ?? hit.anoContratacao;
  const sequencial = hit.sequencialCompra ?? hit.numeroContratacao;

  if (!cnpj || cnpj.length !== 14 || ano == null || sequencial == null) {
    return null;
  }

  const numeroControlePncp = buildNumeroControle(cnpj, Number(sequencial), Number(ano));
  return { cnpj, ano: Number(ano), sequencial: Number(sequencial), numeroControlePncp };
}
