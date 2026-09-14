/**
 * Sync PNCP contratos/atas do tenant — filtra por CNPJ em tenant_party.
 */
import { getComprasGovSql } from '../sourceLayer.js';
import { upsertSourceRecord } from '../sourceLayer.js';
import { listTenantPartyCnpjs, stripCnpj, upsertPncpContract } from './persist.js';

const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta';
const PNCP_API = 'https://pncp.gov.br/api/pncp/v1';

export type PncpSyncOptions = {
  tenantId: number;
  dataInicial?: string;
  dataFinal?: string;
  fetchFn?: typeof fetch;
};

export type PncpSyncResult = {
  scanned: number;
  persisted: number;
  skipped: number;
  errors: string[];
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parsePncpDate(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  if (value.length >= 10 && value.includes('-')) return value.slice(0, 10);
  if (value.length === 8) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return null;
}

function extractFornecedorCnpj(row: Record<string, unknown>): string | null {
  const keys = [
    'niFornecedor',
    'niFornecedorSubContratado',
    'cnpjFornecedor',
    'fornecedorCnpj',
    'ni_fornecedor',
  ];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && stripCnpj(v).length === 14) return stripCnpj(v);
  }
  return null;
}

export function shouldPersistForTenant(
  fornecedorCnpj: string | null,
  tenantCnpjs: Set<string>,
): boolean {
  if (!fornecedorCnpj) return false;
  return tenantCnpjs.has(fornecedorCnpj);
}

export function normalizePncpListHit(
  row: Record<string, unknown>,
  tipo: 'contrato' | 'ata',
): {
  numeroControlePncp: string;
  orgaoCnpj: string;
  fornecedorCnpj: string;
  orgaoRazaoSocial: string | null;
  fornecedorRazaoSocial: string | null;
  ufSigla: string | null;
  numeroContrato: string | null;
  objeto: string | null;
  valorGlobal: number | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
} | null {
  const numeroControle =
    (row.numeroControlePNCP as string) ??
    (row.numeroControlePncp as string) ??
    (row.numeroControle as string);
  if (!numeroControle) return null;

  const orgaoCnpj = stripCnpj(
    (row.orgaoEntidade as { cnpj?: string })?.cnpj ??
      (row.cnpjOrgao as string) ??
      (row.orgaoCnpj as string) ??
      '',
  );
  const fornecedorCnpj = extractFornecedorCnpj(row);
  if (orgaoCnpj.length !== 14 || !fornecedorCnpj) return null;

  return {
    numeroControlePncp: numeroControle,
    orgaoCnpj,
    fornecedorCnpj,
    orgaoRazaoSocial:
      (row.orgaoEntidade as { razaoSocial?: string })?.razaoSocial ??
      (row.nomeOrgao as string) ??
      null,
    fornecedorRazaoSocial:
      (row.nomeRazaoSocialFornecedor as string) ??
      (row.nomeFornecedor as string) ??
      null,
    ufSigla: (row.uf as string) ?? (row.ufSigla as string) ?? null,
    numeroContrato:
      (row.numeroContratoEmpenho as string) ??
      (row.numeroContrato as string) ??
      null,
    objeto: (row.objetoContrato as string) ?? (row.objeto as string) ?? null,
    valorGlobal:
      row.valorGlobal != null
        ? Number(row.valorGlobal)
        : row.valorInicial != null
          ? Number(row.valorInicial)
          : null,
    vigenciaInicio: parsePncpDate(row.dataVigenciaInicio ?? row.vigenciaInicio),
    vigenciaFim: parsePncpDate(row.dataVigenciaFim ?? row.vigenciaFim),
  };
}

async function fetchPaged(
  path: string,
  params: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas && pagina <= 50) {
    const qs = new URLSearchParams({ ...params, pagina: String(pagina), tamanhoPagina: '100' });
    const res = await fetchFn(`${PNCP_CONSULTA}${path}?${qs.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Monitor-Contratos/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`PNCP ${path} HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: Record<string, unknown>[];
      totalPaginas?: number;
    };
    all.push(...(body.data ?? []));
    totalPaginas = body.totalPaginas ?? 1;
    pagina += 1;
  }
  return all;
}

export async function syncFromResultadoItems(tenantId: number): Promise<number> {
  const sql = getComprasGovSql();
  const party = await listTenantPartyCnpjs(tenantId);
  if (party.length === 0) return 0;

  const rows = await sql<
    {
      numero_controle_pncp: string;
      cnpj_orgao: string;
      ano: number;
      sequencial_compra: number;
    }[]
  >`
    SELECT DISTINCT c.numero_controle_pncp, c.cnpj_orgao, c.ano, c.sequencial_compra
    FROM resultado_item ri
    JOIN contratacao c ON c.numero_controle_pncp = ri.numero_controle_pncp
    WHERE ri.ni_fornecedor = ANY(${party})
    LIMIT 200
  `;

  let count = 0;
  for (const row of rows) {
    try {
      const url = `${PNCP_API}/orgaos/${row.cnpj_orgao}/contratos/contratacao/${row.ano}/${row.sequencial_compra}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>[];
      for (const hit of data ?? []) {
        const norm = normalizePncpListHit(hit, 'contrato');
        if (!norm || !party.includes(norm.fornecedorCnpj)) continue;
        await upsertPncpContract({
          tenantId,
          tipo: 'contrato',
          numeroControlePncp: norm.numeroControlePncp,
          orgaoCnpj: norm.orgaoCnpj,
          orgaoRazaoSocial: norm.orgaoRazaoSocial,
          ufSigla: norm.ufSigla,
          fornecedorCnpj: norm.fornecedorCnpj,
          fornecedorRazaoSocial: norm.fornecedorRazaoSocial,
          numeroContratoEmpenho: norm.numeroContrato,
          objeto: norm.objeto,
          valorGlobal: norm.valorGlobal,
          dataVigenciaInicio: norm.vigenciaInicio,
          dataVigenciaFim: norm.vigenciaFim,
          rawJson: hit,
        });
        count += 1;
      }
    } catch {
      // skip individual failures
    }
  }
  return count;
}

export async function syncPncpContractsForTenant(
  options: PncpSyncOptions,
): Promise<PncpSyncResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const partyList = await listTenantPartyCnpjs(options.tenantId);
  const partySet = new Set(partyList);
  if (partySet.size === 0) {
    return { scanned: 0, persisted: 0, skipped: 0, errors: ['Nenhum CNPJ em tenant_party'] };
  }

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 24);
  const dataInicial = options.dataInicial ?? formatDate(start);
  const dataFinal = options.dataFinal ?? formatDate(end);

  const result: PncpSyncResult = { scanned: 0, persisted: 0, skipped: 0, errors: [] };

  for (const [path, tipo] of [
    ['/v1/contratos', 'contrato'],
    ['/v1/atas', 'ata'],
  ] as const) {
    try {
      const hits = await fetchPaged(
        path,
        { dataInicial, dataFinal },
        fetchFn,
      );
      result.scanned += hits.length;

      for (const hit of hits) {
        const norm = normalizePncpListHit(hit, tipo);
        if (!norm) {
          result.skipped += 1;
          continue;
        }
        if (!shouldPersistForTenant(norm.fornecedorCnpj, partySet)) {
          result.skipped += 1;
          continue;
        }

        const sourceRecordId = await upsertSourceRecord({
          source: 'pncp',
          entityType: tipo === 'ata' ? 'ata' : 'contrato',
          identifier: norm.numeroControlePncp,
          rawPayload: hit,
        });

        await upsertPncpContract({
          tenantId: options.tenantId,
          tipo,
          numeroControlePncp: norm.numeroControlePncp,
          orgaoCnpj: norm.orgaoCnpj,
          orgaoRazaoSocial: norm.orgaoRazaoSocial,
          ufSigla: norm.ufSigla,
          fornecedorCnpj: norm.fornecedorCnpj,
          fornecedorRazaoSocial: norm.fornecedorRazaoSocial,
          numeroContratoEmpenho: norm.numeroContrato,
          objeto: norm.objeto,
          valorGlobal: norm.valorGlobal,
          dataVigenciaInicio: norm.vigenciaInicio,
          dataVigenciaFim: norm.vigenciaFim,
          sourceRecordId,
          rawJson: hit,
        });
        result.persisted += 1;
      }
    } catch (err) {
      result.errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    const fromResultados = await syncFromResultadoItems(options.tenantId);
    result.persisted += fromResultados;
  } catch (err) {
    result.errors.push(`resultado_item: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}
