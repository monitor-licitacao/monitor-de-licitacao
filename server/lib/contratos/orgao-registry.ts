import { getComprasGovSql } from '../sourceLayer.js';
import { lookupCnpj as lookupCnpjExternal, stripCnpj } from './cnpj-lookup.js';
import type { CnpjLookupResult } from './types.js';

export type OrgaoResolveSource = 'registry' | 'contratacao' | 'brasilapi' | 'receitaws';

export type OrgaoResolved = CnpjLookupResult & {
  fonte: OrgaoResolveSource;
};

export async function lookupOrgaoRegistry(cnpjRaw: string): Promise<OrgaoResolved | null> {
  const cnpj = stripCnpj(cnpjRaw);
  if (cnpj.length !== 14) return null;

  const sql = getComprasGovSql();
  const rows = await sql<
    { razao_social: string; uf_sigla: string | null; municipio_nome: string | null; fonte: string }[]
  >`
    SELECT razao_social, uf_sigla, municipio_nome, fonte
    FROM orgao_registry
    WHERE cnpj = ${cnpj}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.razao_social?.trim()) return null;

  return {
    cnpj,
    razao_social: row.razao_social.trim(),
    uf: row.uf_sigla ?? undefined,
    municipio: row.municipio_nome ?? undefined,
    fonte: 'registry',
  };
}

export async function upsertOrgaoRegistry(
  input: OrgaoResolved,
): Promise<void> {
  const cnpj = stripCnpj(input.cnpj);
  if (cnpj.length !== 14 || !input.razao_social.trim()) return;

  const fonte =
    input.fonte === 'registry'
      ? 'contratacao'
      : input.fonte === 'receitaws'
        ? 'receitaws'
        : input.fonte === 'brasilapi'
          ? 'brasilapi'
          : 'contratacao';

  const sql = getComprasGovSql();
  await sql`
    INSERT INTO orgao_registry (cnpj, razao_social, uf_sigla, municipio_nome, fonte, updated_at)
    VALUES (
      ${cnpj},
      ${input.razao_social.trim()},
      ${input.uf ?? null},
      ${input.municipio ?? null},
      ${fonte},
      now()
    )
    ON CONFLICT (cnpj) DO UPDATE SET
      razao_social = EXCLUDED.razao_social,
      uf_sigla = COALESCE(EXCLUDED.uf_sigla, orgao_registry.uf_sigla),
      municipio_nome = COALESCE(EXCLUDED.municipio_nome, orgao_registry.municipio_nome),
      fonte = EXCLUDED.fonte,
      updated_at = now()
  `;
}

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
  const fromRegistry = await lookupOrgaoRegistry(cnpjRaw);
  if (fromRegistry) return fromRegistry;

  const fromContratacao = await lookupOrgaoFromContratacao(cnpjRaw);
  if (fromContratacao) {
    await upsertOrgaoRegistry(fromContratacao);
    return fromContratacao;
  }

  const external = await lookupCnpjExternal(cnpjRaw, fetchFn);
  if (!external) return null;

  const resolved: OrgaoResolved = {
    ...external,
    fonte: external.provider === 'receitaws' ? 'receitaws' : 'brasilapi',
  };
  await upsertOrgaoRegistry(resolved);
  return resolved;
}
