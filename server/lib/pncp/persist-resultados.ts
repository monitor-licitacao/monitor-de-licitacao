import { getComprasGovSql, upsertSourceRecord } from '../compras-gov/persist.js';
import { canonizeUnidade } from './unidade-canonica.js';
import type { PncpItemDto, PncpItemResultadoDto } from './types.js';

export const PNCP_RESULTADOS_SOURCE = 'pncp';
export const PNCP_RESULTADOS_PROCESSOR = 'pncp-resultados-ingest';
export const PNCP_RESULTADOS_PROCESSOR_VERSION = '1.0.0';

export type CatalogHierarchy = {
  codigoPdm?: number | null;
  codigoClasse?: number | null;
  codigoGrupo?: number | null;
};

function parseCatalogType(catalogo: string | null | undefined): 'CATMAT' | 'CATSER' | null {
  const t = catalogo?.toUpperCase() ?? '';
  if (t.includes('CATSER') || t === 'S') return 'CATSER';
  if (t.includes('CATMAT') || t === 'M') return 'CATMAT';
  return null;
}

function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function inferTipoDocumento(ni: string, tipoPessoa?: string | null): string {
  if (tipoPessoa === 'PF') return 'CPF';
  if (tipoPessoa === 'PJ') return 'CNPJ';
  const digits = ni.replace(/\D/g, '');
  return digits.length === 11 ? 'CPF' : 'CNPJ';
}

export async function upsertFornecedor(
  ni: string,
  razaoSocial: string | null,
  tipoPessoa?: string | null,
): Promise<string> {
  const sql = getComprasGovSql();
  const tipoDocumento = inferTipoDocumento(ni, tipoPessoa);

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM fornecedor WHERE documento = ${ni} LIMIT 1
  `;
  if (existing[0]) {
    await sql`
      UPDATE fornecedor SET
        razao_social = COALESCE(${razaoSocial}, razao_social),
        tipo_documento = COALESCE(${tipoDocumento}, tipo_documento),
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO fornecedor (documento, tipo_documento, razao_social, updated_at)
    VALUES (${ni}, ${tipoDocumento}, ${razaoSocial}, now())
    RETURNING id
  `;
  return inserted[0]!.id;
}

export async function lookupCatalogHierarchy(
  codigoCatalogo: number | null,
  catalogType: 'CATMAT' | 'CATSER' | null,
): Promise<CatalogHierarchy> {
  if (codigoCatalogo == null || codigoCatalogo <= 0) {
    return {};
  }
  const sql = getComprasGovSql();
  const rows = await sql<
    { codigo_pdm: number | null; codigo_classe: number | null; codigo_grupo: number | null }[]
  >`
    SELECT codigo_pdm, codigo_classe, codigo_grupo
    FROM catalog_item
    WHERE codigo_item = ${codigoCatalogo}
      AND (${catalogType}::text IS NULL OR catalog_type = ${catalogType})
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return {};
  return {
    codigoPdm: row.codigo_pdm,
    codigoClasse: row.codigo_classe,
    codigoGrupo: row.codigo_grupo,
  };
}

export async function persistResultadoBundle(input: {
  numeroControlePncp: string;
  numeroItem: number;
  item: PncpItemDto;
  resultado: PncpItemResultadoDto;
  uf: string | null;
  sourceRecordId: string;
}): Promise<{ resultadoItemId: string; priceObservationId: string }> {
  const sql = getComprasGovSql();
  const { resultado, item, numeroControlePncp, numeroItem, uf, sourceRecordId } = input;

  const ni = resultado.niFornecedor?.trim();
  const sequencial = resultado.sequencialResultado ?? 1;
  if (!ni) {
    throw new Error(`Resultado sem niFornecedor: item ${numeroItem}`);
  }

  const fornecedorId = await upsertFornecedor(
    ni,
    resultado.nomeRazaoSocialFornecedor ?? null,
    resultado.tipoPessoa,
  );

  const codigoCatalogo = item.catalogoCodigoItem ?? null;
  const catalogType = parseCatalogType(item.catalogo) ?? (codigoCatalogo != null ? 'CATMAT' : null);
  const hierarchy = await lookupCatalogHierarchy(codigoCatalogo, catalogType);
  const unidadeCanonica = canonizeUnidade(item.unidadeMedida);
  const ncm = item.ncmNbsCodigo?.trim() || null;

  const resultadoRows = await sql<{ id: string }[]>`
    INSERT INTO resultado_item (
      numero_controle_pncp, numero_item, sequencial_resultado, ni_fornecedor,
      fornecedor_id, valor_unitario_homologado, valor_total_homologado,
      quantidade_homologada, percentual_desconto, data_resultado, situacao_nome,
      source_record_id, raw_json, updated_at
    )
    VALUES (
      ${numeroControlePncp},
      ${numeroItem},
      ${sequencial},
      ${ni},
      ${fornecedorId},
      ${resultado.valorUnitarioHomologado ?? null},
      ${resultado.valorTotalHomologado ?? null},
      ${resultado.quantidadeHomologada ?? null},
      ${resultado.percentualDesconto ?? null},
      ${parseDate(resultado.dataResultado)},
      ${resultado.situacaoCompraItemResultadoNome ?? null},
      ${sourceRecordId},
      ${sql.json(resultado as unknown as import('postgres').JSONValue)},
      now()
    )
    ON CONFLICT (numero_controle_pncp, numero_item, ni_fornecedor, sequencial_resultado) DO UPDATE SET
      valor_unitario_homologado = EXCLUDED.valor_unitario_homologado,
      valor_total_homologado = EXCLUDED.valor_total_homologado,
      quantidade_homologada = EXCLUDED.quantidade_homologada,
      percentual_desconto = EXCLUDED.percentual_desconto,
      data_resultado = EXCLUDED.data_resultado,
      situacao_nome = EXCLUDED.situacao_nome,
      raw_json = EXCLUDED.raw_json,
      updated_at = now()
    RETURNING id
  `;

  const resultadoItemId = resultadoRows[0]!.id;
  const valorUnit = resultado.valorUnitarioHomologado;
  if (valorUnit == null || !Number.isFinite(valorUnit) || valorUnit <= 0) {
    return { resultadoItemId, priceObservationId: '' };
  }

  const priceRows = await sql<{ id: string }[]>`
    INSERT INTO price_observation (
      codigo_catalogo, catalog_type, codigo_pdm, codigo_classe, codigo_grupo,
      ncm_nbs, unidade_canonica, valor_unitario_homologado, data_resultado, uf,
      fonte, source_record_id, numero_controle_pncp, numero_item, ni_fornecedor,
      sequencial_resultado, resultado_item_id
    )
    VALUES (
      ${codigoCatalogo},
      ${catalogType},
      ${hierarchy.codigoPdm ?? null},
      ${hierarchy.codigoClasse ?? null},
      ${hierarchy.codigoGrupo ?? null},
      ${ncm},
      ${unidadeCanonica},
      ${valorUnit},
      ${parseDate(resultado.dataResultado)},
      ${uf},
      'pncp_resultado',
      ${sourceRecordId},
      ${numeroControlePncp},
      ${numeroItem},
      ${ni},
      ${sequencial},
      ${resultadoItemId}
    )
    ON CONFLICT (numero_controle_pncp, numero_item, ni_fornecedor, sequencial_resultado) DO UPDATE SET
      codigo_catalogo = EXCLUDED.codigo_catalogo,
      catalog_type = EXCLUDED.catalog_type,
      codigo_pdm = EXCLUDED.codigo_pdm,
      codigo_classe = EXCLUDED.codigo_classe,
      codigo_grupo = EXCLUDED.codigo_grupo,
      ncm_nbs = EXCLUDED.ncm_nbs,
      unidade_canonica = EXCLUDED.unidade_canonica,
      valor_unitario_homologado = EXCLUDED.valor_unitario_homologado,
      data_resultado = EXCLUDED.data_resultado,
      uf = EXCLUDED.uf,
      resultado_item_id = EXCLUDED.resultado_item_id
    RETURNING id
  `;

  return { resultadoItemId, priceObservationId: priceRows[0]?.id ?? '' };
}

export async function createResultadosSourceRecord(
  numeroControlePncp: string,
  numeroItem: number,
  payload: unknown,
): Promise<string> {
  return upsertSourceRecord({
    source: PNCP_RESULTADOS_SOURCE,
    entityType: 'pncp_item_resultado',
    identifier: `${numeroControlePncp}#${numeroItem}`,
    sourceUrl: `https://pncp.gov.br/app/editais/${numeroControlePncp}`,
    rawPayload: payload,
  });
}
