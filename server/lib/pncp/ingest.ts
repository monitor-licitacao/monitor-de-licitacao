/**
 * Ingest PNCP Classe A+B → contratacao + item (Fase D).
 */
import { extractIdCompraFromLink } from '../compras-gov/compare-pncp.js';
import {
  getComprasGovSql,
  upsertSourceRecord,
  type ContratacaoEnrichmentContext,
  getContratacaoEnrichmentContext,
} from '../compras-gov/persist.js';
import { parsePncpFacets, resolveCatalogMatchMethod } from './parse-pncp-facets.js';
import { parseNumeroControlePncp } from './resolve-controle.js';
import { extractDomainKeys } from './resolve-domains.js';
import { syncPncpDocumentos } from './sync-documentos.js';
import type { IngestContratacaoResult, PncpCompraDto, PncpItemDto } from './types.js';

export const PNCP_SOURCE = 'pncp';
export const PNCP_PROCESSOR = 'pncp-ingest';
export const PNCP_PROCESSOR_VERSION = '1.0.0';

export type IngestClientAdapter = {
  fetchCompra: (cnpj: string, ano: number, sequencial: number) => Promise<PncpCompraDto | null>;
  fetchItens: (cnpj: string, ano: number, sequencial: number) => Promise<PncpItemDto[]>;
};

export function createHttpIngestAdapter(options: { fetchFn?: typeof fetch; timeoutMs?: number } = {}): IngestClientAdapter {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    async fetchCompra(cnpj, ano, sequencial) {
      const url = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
      const res = await fetchFn(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Monitor-PNCP-Ingest/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      return (await res.json()) as PncpCompraDto;
    },
    async fetchItens(cnpj, ano, sequencial) {
      const all: PncpItemDto[] = [];
      let pagina = 1;
      while (pagina <= 20) {
        const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=${pagina}&tamanhoPagina=50`;
        const res = await fetchFn(url, {
          headers: { Accept: 'application/json', 'User-Agent': 'Monitor-PNCP-Ingest/1.0' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) break;
        const data = (await res.json()) as PncpItemDto[] | { data?: PncpItemDto[] };
        const batch = Array.isArray(data) ? data : (data.data ?? []);
        if (batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 50) break;
        pagina++;
      }
      return all;
    },
  };
}

function toTimestamp(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function upsertContratacaoFromPncp(
  compra: PncpCompraDto,
  sourceRecordId: string,
): Promise<{ id: string }> {
  const sql = getComprasGovSql();
  const numeroControle =
    compra.numeroControlePNCP ??
    (compra.orgaoEntidade?.cnpj && compra.anoCompra && compra.sequencialCompra
      ? `${compra.orgaoEntidade.cnpj}-1-${String(compra.sequencialCompra).padStart(6, '0')}/${compra.anoCompra}`
      : null);

  if (!numeroControle) {
    throw new Error('numeroControlePNCP ausente na compra PNCP');
  }

  const cnpj = compra.orgaoEntidade?.cnpj ?? '';
  const idCompra = extractIdCompraFromLink(compra.linkSistemaOrigem);
  const keys = extractDomainKeys(compra);

  const rows = await sql<{ id: string }[]>`
    INSERT INTO contratacao (
      numero_controle_pncp, cnpj_orgao, ano, sequencial_compra,
      numero_compra, numero_processo, modalidade_id, modalidade_nome,
      instrumento_convocatorio_codigo, amparo_legal_codigo,
      pncp_modalidade_id, pncp_instrumento_convocatorio_id, pncp_amparo_legal_id,
      modo_disputa, srp, objeto, informacao_complementar, valor_estimado,
      data_publicacao, data_inicio_propostas, data_fim_propostas, situacao,
      municipio, uf, url_origem, raw_json, id_compra,
      source_record_id, processor, processor_version, updated_at
    )
    VALUES (
      ${numeroControle},
      ${cnpj},
      ${compra.anoCompra ?? 0},
      ${compra.sequencialCompra ?? 0},
      ${compra.numeroCompra ?? null},
      ${compra.processo ?? null},
      ${keys.modalidadePncpId},
      ${compra.modalidadeNome ?? null},
      ${keys.instrumentoPncpId},
      ${keys.amparoPncpId},
      (SELECT id FROM pncp_modalidade WHERE pncp_id = ${keys.modalidadePncpId} LIMIT 1),
      (SELECT id FROM pncp_instrumento_convocatorio WHERE pncp_id = ${keys.instrumentoPncpId} LIMIT 1),
      (SELECT id FROM pncp_amparo_legal WHERE pncp_id = ${keys.amparoPncpId} LIMIT 1),
      ${compra.modoDisputaNome ?? null},
      ${compra.srp ?? null},
      ${compra.objetoCompra ?? null},
      ${compra.informacaoComplementar ?? null},
      ${compra.valorTotalEstimado ?? null},
      ${toTimestamp(compra.dataPublicacaoPncp)},
      ${toTimestamp(compra.dataAberturaProposta)},
      ${toTimestamp(compra.dataEncerramentoProposta)},
      ${compra.situacaoCompraNome ?? null},
      ${compra.unidadeOrgao?.municipioNome ?? null},
      ${compra.unidadeOrgao?.ufSigla ?? null},
      ${compra.linkSistemaOrigem ?? null},
      ${sql.json(compra as unknown as import('postgres').JSONValue)},
      ${idCompra},
      ${sourceRecordId},
      ${PNCP_PROCESSOR},
      ${PNCP_PROCESSOR_VERSION},
      now()
    )
    ON CONFLICT (numero_controle_pncp) DO UPDATE SET
      numero_compra = EXCLUDED.numero_compra,
      numero_processo = EXCLUDED.numero_processo,
      modalidade_id = EXCLUDED.modalidade_id,
      modalidade_nome = EXCLUDED.modalidade_nome,
      instrumento_convocatorio_codigo = EXCLUDED.instrumento_convocatorio_codigo,
      amparo_legal_codigo = EXCLUDED.amparo_legal_codigo,
      pncp_modalidade_id = EXCLUDED.pncp_modalidade_id,
      pncp_instrumento_convocatorio_id = EXCLUDED.pncp_instrumento_convocatorio_id,
      pncp_amparo_legal_id = EXCLUDED.pncp_amparo_legal_id,
      modo_disputa = EXCLUDED.modo_disputa,
      srp = EXCLUDED.srp,
      objeto = EXCLUDED.objeto,
      informacao_complementar = EXCLUDED.informacao_complementar,
      valor_estimado = EXCLUDED.valor_estimado,
      data_publicacao = EXCLUDED.data_publicacao,
      data_inicio_propostas = EXCLUDED.data_inicio_propostas,
      data_fim_propostas = EXCLUDED.data_fim_propostas,
      situacao = EXCLUDED.situacao,
      municipio = EXCLUDED.municipio,
      uf = EXCLUDED.uf,
      url_origem = COALESCE(EXCLUDED.url_origem, contratacao.url_origem),
      raw_json = EXCLUDED.raw_json,
      id_compra = COALESCE(EXCLUDED.id_compra, contratacao.id_compra),
      source_record_id = COALESCE(contratacao.source_record_id, EXCLUDED.source_record_id),
      processor = EXCLUDED.processor,
      processor_version = EXCLUDED.processor_version,
      updated_at = now()
    RETURNING id
  `;

  return { id: rows[0].id };
}

export async function upsertItensFromPncp(
  contratacaoId: string,
  itens: PncpItemDto[],
  sourceRecordId: string,
): Promise<number> {
  const sql = getComprasGovSql();
  let count = 0;

  for (const item of itens) {
    const parsedFacets = parsePncpFacets(item.descricao);
    const catalogMatchMethod = resolveCatalogMatchMethod({
      catalogoCodigoItem: item.catalogoCodigoItem ?? null,
      ncmNbsCodigo: item.ncmNbsCodigo ?? null,
      facets: parsedFacets,
    });

    await sql`
      INSERT INTO item (
        contratacao_id, numero_item, descricao, material_ou_servico,
        codigo_catalogo, catalogo_tipo, ncm_nbs, parsed_facets, catalog_match_method,
        unidade_medida, quantidade,
        valor_unitario_estimado, valor_total_estimado,
        criterio_julgamento, beneficio_me_epp, situacao,
        raw_json, derived_from_source_record_id,
        processor, processor_version, updated_at
      )
      VALUES (
        ${contratacaoId},
        ${item.numeroItem},
        ${item.descricao},
        ${item.materialOuServicoNome ?? item.materialOuServico ?? null},
        ${item.catalogoCodigoItem != null ? String(item.catalogoCodigoItem) : null},
        ${item.catalogo ?? null},
        ${item.ncmNbsCodigo?.trim() ?? null},
        ${sql.json(parsedFacets as unknown as import('postgres').JSONValue)},
        ${catalogMatchMethod},
        ${item.unidadeMedida?.trim() ?? null},
        ${item.quantidade ?? null},
        ${item.valorUnitarioEstimado ?? null},
        ${item.valorTotal ?? null},
        ${item.criterioJulgamentoNome ?? null},
        ${item.tipoBeneficioNome ?? null},
        ${item.situacaoCompraItemNome ?? null},
        ${sql.json(item as unknown as import('postgres').JSONValue)},
        ${sourceRecordId},
        ${PNCP_PROCESSOR},
        ${PNCP_PROCESSOR_VERSION},
        now()
      )
      ON CONFLICT (contratacao_id, numero_item) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        material_ou_servico = EXCLUDED.material_ou_servico,
        codigo_catalogo = EXCLUDED.codigo_catalogo,
        catalogo_tipo = EXCLUDED.catalogo_tipo,
        ncm_nbs = EXCLUDED.ncm_nbs,
        parsed_facets = EXCLUDED.parsed_facets,
        catalog_match_method = EXCLUDED.catalog_match_method,
        unidade_medida = EXCLUDED.unidade_medida,
        quantidade = EXCLUDED.quantidade,
        valor_unitario_estimado = EXCLUDED.valor_unitario_estimado,
        valor_total_estimado = EXCLUDED.valor_total_estimado,
        criterio_julgamento = EXCLUDED.criterio_julgamento,
        beneficio_me_epp = EXCLUDED.beneficio_me_epp,
        situacao = EXCLUDED.situacao,
        raw_json = EXCLUDED.raw_json,
        derived_from_source_record_id = COALESCE(item.derived_from_source_record_id, EXCLUDED.derived_from_source_record_id),
        processor = EXCLUDED.processor,
        processor_version = EXCLUDED.processor_version,
        updated_at = now()
    `;
    count++;
  }

  return count;
}

/** Ingest idempotente PNCP Classe A+B por numeroControlePNCP. */
export async function ingestContratacaoBundle(
  numeroControlePncp: string,
  adapter: IngestClientAdapter,
): Promise<IngestContratacaoResult> {
  const parsed = parseNumeroControlePncp(numeroControlePncp);
  if (!parsed) {
    return { ok: false, error: `numeroControlePNCP inválido: ${numeroControlePncp}` };
  }

  try {
    const compra = await adapter.fetchCompra(parsed.cnpj, parsed.ano, parsed.sequencial);
    if (!compra) {
      return { ok: false, error: `Compra PNCP não encontrada: ${numeroControlePncp}` };
    }

    const itens = await adapter.fetchItens(parsed.cnpj, parsed.ano, parsed.sequencial);
    const controle = compra.numeroControlePNCP ?? parsed.numeroControlePncp;

    const sourceId = await upsertSourceRecord({
      source: PNCP_SOURCE,
      entityType: 'pncp_compra',
      identifier: controle,
      sourceUrl: `https://pncp.gov.br/app/editais/${parsed.cnpj}/${parsed.ano}/${parsed.sequencial}`,
      rawPayload: { compra, itens },
    });

    const { id: contratacaoId } = await upsertContratacaoFromPncp(compra, sourceId);
    const itemCount = await upsertItensFromPncp(contratacaoId, itens, sourceId);

    await syncPncpDocumentos({
      contratacaoId,
      cnpj: parsed.cnpj,
      ano: parsed.ano,
      sequencial: parsed.sequencial,
      source: 'pncp_ingest',
    }).catch(() => undefined);

    return {
      ok: true,
      contratacaoId,
      numeroControlePncp: controle,
      itemCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function getIngestedContext(
  numeroControlePncp: string,
): Promise<ContratacaoEnrichmentContext | null> {
  return getContratacaoEnrichmentContext(numeroControlePncp);
}
