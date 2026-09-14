import { getComprasGovSql } from '../sourceLayer.js';
import { lookupCnpj as lookupCnpjExternal, stripCnpj } from './cnpj-lookup.js';
import type { CnpjLookupResult } from './types.js';

export type OrgaoResolveSource = 'contratacao' | 'registry' | 'brasilapi';

export type OrgaoResolved = CnpjLookupResult & {
  fonte: OrgaoResolveSource;
};

export async function lookupOrgaoFromContratacao(cnpjRaw: string): Promise<OrgaoResolved | null> {
  const cnpj = stripCnpj(cnpjRaw);
  if (cnpj.length !== 14) return null;

  const sql = getComprasGovSql();
  const rows = await sql<
    { razao_social: string | null; uf: string | null; municipio: string | null }[]
  >`
    SELECT
      COALESCE(
        raw_json->'unidadeOrgao'->>'nomeUnidade',
        NULLIF(TRIM(CONCAT(municipio, ' ', uf)), '')
      ) AS razao_social,
      uf,
      municipio
    FROM contratacao
    WHERE cnpj_orgao = ${cnpj}
    ORDER BY data_publicacao DESC NULLS LAST
    LIMIT 1
  `;

  const row = rows[0];
  if (!row?.razao_social?.trim()) return null;

  return {
    cnpj,
    razao_social: row.razao_social.trim(),
    uf: row.uf ?? undefined,
    municipio: row.municipio ?? undefined,
    fonte: 'contratacao',
  };
}

export async function resolveOrgaoCnpj(
  cnpjRaw: string,
  fetchFn?: typeof fetch,
): Promise<OrgaoResolved | null> {
  const fromContratacao = await lookupOrgaoFromContratacao(cnpjRaw);
  if (fromContratacao) return fromContratacao;

  const external = await lookupCnpjExternal(cnpjRaw, fetchFn);
  if (!external) return null;

  return { ...external, fonte: 'brasilapi' };
}
