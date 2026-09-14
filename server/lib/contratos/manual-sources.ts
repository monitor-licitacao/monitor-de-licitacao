import { getComprasGovSql } from '../sourceLayer.js';
import { buildNumerosSugeridos } from './map-contratacao-items.js';
import type { ManualContractSource } from './types.js';

export async function listManualContractSources(
  limit = 100,
  pinId?: string,
): Promise<ManualContractSource[]> {
  const sql = getComprasGovSql();
  const pin = pinId?.trim();
  const rows = await sql<
    {
      id: string;
      numero_controle_pncp: string;
      objeto: string | null;
      cnpj_orgao: string;
      uf: string | null;
      numero_processo: string | null;
      numero_compra: string | null;
      unidade_nome: string | null;
    }[]
  >`
    SELECT
      c.id,
      c.numero_controle_pncp,
      c.objeto,
      c.cnpj_orgao,
      c.uf,
      c.numero_processo,
      c.numero_compra,
      COALESCE(
        c.raw_json->'unidadeOrgao'->>'nomeUnidade',
        NULLIF(TRIM(CONCAT(c.municipio, ' ', c.uf)), '')
      ) AS unidade_nome
    FROM contratacao c
    ORDER BY
      CASE WHEN ${pin ?? null}::uuid IS NOT NULL AND c.id = ${pin ?? null}::uuid THEN 0 ELSE 1 END,
      c.data_publicacao DESC NULLS LAST,
      c.updated_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    numero_controle_pncp: r.numero_controle_pncp,
    objeto: r.objeto,
    cnpj_orgao: r.cnpj_orgao,
    uf: r.uf,
    orgao_razao_social: r.unidade_nome,
    numeros_sugeridos: buildNumerosSugeridos({
      numero_controle_pncp: r.numero_controle_pncp,
      numero_processo: r.numero_processo,
      edital: r.numero_compra,
      numero_compra: r.numero_compra,
    }),
  }));
}
