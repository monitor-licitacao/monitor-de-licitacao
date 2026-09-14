import type { ComprasGovCatmatItemDto, ComprasGovContratacao14133Dto, ComprasGovPgcDetalheDto } from './types.js';
import { extractIdCompraFromLink } from './compare-pncp.js';
import { normalizeCatmatItem } from './normalize-catalog.js';
import { normalizePgcDfd } from './normalize-pgc.js';

export {
  closeComprasGovPersistPool,
  getComprasGovSql,
  hashPayload,
  recordSourceHealth,
  upsertEntitySnapshot,
  upsertSourceRecord,
} from '../sourceLayer.js';
import { getComprasGovSql } from '../sourceLayer.js';

export const CG_SOURCE = 'compras_gov_dados_abertos';

export async function persistContratacaoIdCompra(
  numeroControlePncp: string,
  comprasGov: ComprasGovContratacao14133Dto,
  sourceRecordId?: string,
): Promise<{ updated: boolean; idCompra: string | null }> {
  const sql = getComprasGovSql();
  const idCompra =
    comprasGov.idCompra ?? extractIdCompraFromLink(comprasGov.linkSistemaOrigem) ?? null;

  const rows = await sql<{ id: string }[]>`
    UPDATE contratacao
    SET
      id_compra = COALESCE(${idCompra}, id_compra),
      updated_at = now()
    WHERE numero_controle_pncp = ${numeroControlePncp}
    RETURNING id
  `;

  if (rows.length === 0) {
    return { updated: false, idCompra };
  }

  if (sourceRecordId) {
    await sql`
      UPDATE contratacao
      SET derived_from_source_record_id = ${sourceRecordId}
      WHERE id = ${rows[0].id}
        AND derived_from_source_record_id IS NULL
    `;
  }

  return { updated: true, idCompra };
}

export async function persistCatalogItem(
  dto: ComprasGovCatmatItemDto,
  sourceRecordId?: string,
): Promise<{ id: string; codigoItem: number }> {
  const sql = getComprasGovSql();
  const row = normalizeCatmatItem(dto);

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO catalog_item (
      catalog_type, codigo_item, descricao_item,
      codigo_grupo, nome_grupo, codigo_classe, nome_classe,
      codigo_pdm, nome_pdm, codigo_ncm,
      source_record_id, raw_json, updated_at
    )
    VALUES (
      ${row.catalogType},
      ${row.codigoItem},
      ${row.descricaoItem},
      ${row.codigoGrupo},
      ${row.nomeGrupo},
      ${row.codigoClasse},
      ${row.nomeClasse},
      ${row.codigoPdm},
      ${row.nomePdm},
      ${row.codigoNcm},
      ${sourceRecordId ?? null},
      ${sql.json(row.rawJson as import('postgres').JSONValue)},
      now()
    )
    ON CONFLICT (catalog_type, codigo_item) DO UPDATE SET
      descricao_item = EXCLUDED.descricao_item,
      codigo_grupo = EXCLUDED.codigo_grupo,
      nome_grupo = EXCLUDED.nome_grupo,
      codigo_classe = EXCLUDED.codigo_classe,
      nome_classe = EXCLUDED.nome_classe,
      codigo_pdm = EXCLUDED.codigo_pdm,
      nome_pdm = EXCLUDED.nome_pdm,
      codigo_ncm = EXCLUDED.codigo_ncm,
      source_record_id = COALESCE(EXCLUDED.source_record_id, catalog_item.source_record_id),
      raw_json = EXCLUDED.raw_json,
      updated_at = now()
    RETURNING id
  `;

  return { id: inserted[0].id, codigoItem: row.codigoItem };
}

export async function persistPgcDfdBatch(
  dfds: ComprasGovPgcDetalheDto[],
  sourceRecordId?: string,
): Promise<number> {
  const sql = getComprasGovSql();
  let count = 0;

  for (const dto of dfds) {
    const row = normalizePgcDfd(dto);
    await sql`
      INSERT INTO pgc_dfd (
        source_record_id, orgao_cnpj, ano, numero_artifacto, ordem_dfd,
        codigo_uasg, nome_uasg, descricao_objeto_dfd, tipo_item,
        codigo_item_catalogo, catalog_type, valor_total_item,
        data_prevista_formalizacao, raw_json, updated_at
      )
      VALUES (
        ${sourceRecordId ?? null},
        ${row.orgaoCnpj},
        ${row.ano},
        ${row.numeroArtifacto},
        ${row.ordemDfd},
        ${row.codigoUasg},
        ${row.nomeUasg},
        ${row.descricaoObjetoDfd},
        ${row.tipoItem},
        ${row.codigoItemCatalogo},
        ${row.catalogType},
        ${row.valorTotalItem},
        ${row.dataPrevistaFormalizacao},
        ${sql.json(row.rawJson as import('postgres').JSONValue)},
        now()
      )
      ON CONFLICT (orgao_cnpj, ano, numero_artifacto, ordem_dfd) DO UPDATE SET
        descricao_objeto_dfd = EXCLUDED.descricao_objeto_dfd,
        valor_total_item = EXCLUDED.valor_total_item,
        source_record_id = COALESCE(EXCLUDED.source_record_id, pgc_dfd.source_record_id),
        raw_json = EXCLUDED.raw_json,
        updated_at = now()
    `;
    count++;
  }

  return count;
}

export async function getCatalogItemByCodigo(
  catalogType: 'CATMAT' | 'CATSER',
  codigoItem: number,
): Promise<{ codigoItem: number; descricaoItem: string | null; nomePdm: string | null } | null> {
  const sql = getComprasGovSql();
  const rows = await sql<
    { codigo_item: number; descricao_item: string | null; nome_pdm: string | null }[]
  >`
    SELECT codigo_item, descricao_item, nome_pdm
    FROM catalog_item
    WHERE catalog_type = ${catalogType} AND codigo_item = ${codigoItem}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    codigoItem: row.codigo_item,
    descricaoItem: row.descricao_item,
    nomePdm: row.nome_pdm,
  };
}

export type ContratacaoEnrichmentContext = {
  contratacaoId: string;
  numeroControlePncp: string;
  cnpjOrgao: string;
  idCompra: string | null;
  urlOrigem: string | null;
  pncpItemCount: number;
  items: Array<{
    codigoCatalogo: number | null;
    valorUnitarioEstimado: number | null;
    valorTotalEstimado: number | null;
    orcamentoSigiloso: boolean | null;
  }>;
  rawJson: Record<string, unknown> | null;
};

export async function getContratacaoEnrichmentContext(
  numeroControlePncp: string,
): Promise<ContratacaoEnrichmentContext | null> {
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      cnpj_orgao: string;
      id_compra: string | null;
      url_origem: string | null;
      raw_json: Record<string, unknown> | null;
    }[]
  >`
    SELECT id, numero_controle_pncp, cnpj_orgao, id_compra, url_origem, raw_json
    FROM contratacao
    WHERE numero_controle_pncp = ${numeroControlePncp}
    LIMIT 1
  `;
  const c = rows[0];
  if (!c) return null;

  const itemRows = await sql<
    {
      codigo_catalogo: number | null;
      valor_unitario_estimado: string | null;
      valor_total_estimado: string | null;
    }[]
  >`
    SELECT codigo_catalogo, valor_unitario_estimado, valor_total_estimado
    FROM item
    WHERE contratacao_id = ${c.id}
  `;

  const items = itemRows.map((i) => ({
    codigoCatalogo: i.codigo_catalogo,
    valorUnitarioEstimado: i.valor_unitario_estimado != null ? Number(i.valor_unitario_estimado) : null,
    valorTotalEstimado: i.valor_total_estimado != null ? Number(i.valor_total_estimado) : null,
    orcamentoSigiloso: null as boolean | null,
  }));

  return {
    contratacaoId: c.id,
    numeroControlePncp: c.numero_controle_pncp,
    cnpjOrgao: c.cnpj_orgao,
    idCompra: c.id_compra,
    urlOrigem: c.url_origem,
    pncpItemCount: items.length,
    items,
    rawJson: c.raw_json,
  };
}

