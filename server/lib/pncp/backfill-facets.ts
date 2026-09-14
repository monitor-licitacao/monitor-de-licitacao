/**
 * Reprocessa parsed_facets a partir de raw_json/descricao já persistidos.
 */
import { getComprasGovSql } from '../compras-gov/persist.js';
import { parsePncpFacets, resolveCatalogMatchMethod } from './parse-pncp-facets.js';
import type { PncpItemDto } from './types.js';

export async function backfillParsedFacetsForContratacao(
  contratacaoId: string,
): Promise<{ updated: number }> {
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      id: string;
      numero_item: number;
      descricao: string;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT id, numero_item, descricao, raw_json
    FROM item
    WHERE contratacao_id = ${contratacaoId}
    ORDER BY numero_item
  `;

  let updated = 0;
  for (const row of rows) {
    const raw = (row.raw_json ?? {}) as Partial<PncpItemDto>;
    const descricao = row.descricao || raw.descricao || '';
    const facets = parsePncpFacets(descricao);
    const matchMethod = resolveCatalogMatchMethod({
      catalogoCodigoItem: raw.catalogoCodigoItem ?? null,
      ncmNbsCodigo: raw.ncmNbsCodigo ?? null,
      facets,
    });

    await sql`
      UPDATE item SET
        parsed_facets = ${sql.json(facets as import('postgres').JSONValue)},
        catalog_match_method = ${matchMethod},
        updated_at = now()
      WHERE id = ${row.id}
    `;
    updated++;
  }

  return { updated };
}

export async function backfillParsedFacetsByControle(
  numeroControlePncp: string,
): Promise<{ updated: number } | { error: string }> {
  const sql = getComprasGovSql();
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM contratacao WHERE numero_controle_pncp = ${numeroControlePncp} LIMIT 1
  `;
  if (!rows[0]) {
    return { error: `Contratação não encontrada: ${numeroControlePncp}` };
  }
  return backfillParsedFacetsForContratacao(rows[0].id);
}
