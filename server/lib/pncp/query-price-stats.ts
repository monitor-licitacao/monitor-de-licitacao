import { getComprasGovSql } from '../compras-gov/persist.js';
import {
  buildPriceJoinKey,
  computePriceStats,
  resolvePriceStatsFromObservations,
  type PrecoMercadoStats,
  type PriceJoinKey,
} from './price-cross.js';
import { canonizeUnidade } from './unidade-canonica.js';

const PERIODO_MESES = 24;

async function fetchObservations(
  filter: Record<string, unknown>,
): Promise<{ valorUnitarioHomologado: number; dataResultado: string | null }[]> {
  const sql = getComprasGovSql();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - PERIODO_MESES);

  if (filter.codigoCatalogo != null) {
    return sql<
      { valor_unitario_homologado: string; data_resultado: string | null }[]
    >`
      SELECT valor_unitario_homologado, data_resultado::text
      FROM price_observation
      WHERE codigo_catalogo = ${filter.codigoCatalogo as number}
        AND (${(filter.catalogType as string | null) ?? null}::text IS NULL OR catalog_type = ${(filter.catalogType as string | null) ?? null})
        AND (data_resultado IS NULL OR data_resultado >= ${cutoff.toISOString().slice(0, 10)}::date)
        AND valor_unitario_homologado > 0
    `.then((rows) =>
      rows.map((r) => ({
        valorUnitarioHomologado: Number(r.valor_unitario_homologado),
        dataResultado: r.data_resultado,
      })),
    );
  }

  if (filter.codigoPdm != null) {
    return sql<
      { valor_unitario_homologado: string; data_resultado: string | null }[]
    >`
      SELECT valor_unitario_homologado, data_resultado::text
      FROM price_observation
      WHERE codigo_pdm = ${filter.codigoPdm as number}
        AND (data_resultado IS NULL OR data_resultado >= ${cutoff.toISOString().slice(0, 10)}::date)
        AND valor_unitario_homologado > 0
    `.then((rows) =>
      rows.map((r) => ({
        valorUnitarioHomologado: Number(r.valor_unitario_homologado),
        dataResultado: r.data_resultado,
      })),
    );
  }

  if (filter.ncmNbs != null) {
    const unidade = filter.unidade as string | null;
    return sql<
      { valor_unitario_homologado: string; data_resultado: string | null }[]
    >`
      SELECT valor_unitario_homologado, data_resultado::text
      FROM price_observation
      WHERE ncm_nbs = ${filter.ncmNbs as string}
        AND (${unidade}::text IS NULL OR unidade_canonica = ${unidade})
        AND (data_resultado IS NULL OR data_resultado >= ${cutoff.toISOString().slice(0, 10)}::date)
        AND valor_unitario_homologado > 0
    `.then((rows) =>
      rows.map((r) => ({
        valorUnitarioHomologado: Number(r.valor_unitario_homologado),
        dataResultado: r.data_resultado,
      })),
    );
  }

  return [];
}

async function lookupPdmFromCatalog(codigoCatalogo: number): Promise<number | null> {
  const sql = getComprasGovSql();
  const rows = await sql<{ codigo_pdm: number | null }[]>`
    SELECT codigo_pdm FROM catalog_item WHERE codigo_item = ${codigoCatalogo} LIMIT 1
  `;
  return rows[0]?.codigo_pdm ?? null;
}

export async function queryPriceStatsForKey(key: PriceJoinKey): Promise<PrecoMercadoStats> {
  if (key.codigoCatalogo != null && key.codigoCatalogo > 0) {
    const obs = await fetchObservations({
      codigoCatalogo: key.codigoCatalogo,
      catalogType: key.catalogType,
    });
    if (obs.length > 0) {
      return resolvePriceStatsFromObservations(obs, key, { periodoMeses: PERIODO_MESES });
    }
  }

  let codigoPdm = key.codigoPdm;
  if (codigoPdm == null && key.codigoCatalogo != null) {
    codigoPdm = await lookupPdmFromCatalog(key.codigoCatalogo);
  }

  if (codigoPdm != null && codigoPdm > 0) {
    const obs = await fetchObservations({ codigoPdm });
    return computePriceStats(
      obs.map((o) => o.valorUnitarioHomologado),
      {
        joinLevel: 'PDM',
        confidence: 'MEDIUM',
        periodoMeses: PERIODO_MESES,
        label: `PDM ${codigoPdm}`,
      },
    );
  }

  const ncm = key.ncmNbs?.trim();
  if (ncm && ncm.length >= 4) {
    const obs = await fetchObservations({
      ncmNbs: ncm,
      unidade: key.unidade ?? null,
    });
    return resolvePriceStatsFromObservations(
      obs,
      { ...key, ncmNbs: ncm },
      { periodoMeses: PERIODO_MESES },
    );
  }

  return {
    status: 'INSUFICIENTE',
    confidence: null,
    join_level: null,
    n: 0,
    mediana: null,
    p25: null,
    p75: null,
    periodo_meses: PERIODO_MESES,
    label: null,
  };
}

export async function queryPriceStatsForItem(input: {
  codigoCatalogo?: number | string | null;
  catalogoTipo?: string | null;
  ncmNbs?: string | null;
  unidade?: string | null;
}): Promise<PrecoMercadoStats> {
  const key = buildPriceJoinKey({
    codigoCatalogo: input.codigoCatalogo,
    catalogoTipo: input.catalogoTipo,
    ncmNbs: input.ncmNbs,
    unidade: canonizeUnidade(input.unidade),
  });
  return queryPriceStatsForKey(key);
}
