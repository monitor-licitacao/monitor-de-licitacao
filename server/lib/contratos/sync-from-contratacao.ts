/**
 * Sincroniza tenant_contract vinculados a uma contratação a partir do histórico/PNCP.
 */
import { getComprasGovSql } from '../sourceLayer.js';

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function backfillContractFromContratacao(contractId: string): Promise<boolean> {
  const sql = getComprasGovSql();
  const rows = await sql<
    {
      id: string;
      contratacao_id: string | null;
      valor_global: string | null;
      data_vigencia_inicio: string | null;
      data_vigencia_fim: string | null;
    }[]
  >`
    SELECT id, contratacao_id, valor_global, data_vigencia_inicio, data_vigencia_fim
    FROM tenant_contract
    WHERE id = ${contractId}::uuid
    LIMIT 1
  `;
  const contract = rows[0];
  if (!contract?.contratacao_id) return false;

  const metaRows = await sql<{ valor_estimado: string | null }[]>`
    SELECT valor_estimado
    FROM contratacao
    WHERE id = ${contract.contratacao_id}::uuid
    LIMIT 1
  `;
  const meta = metaRows[0];
  if (!meta) return false;

  const valorAtual = parseNumeric(contract.valor_global);
  const valorEstimado = parseNumeric(meta.valor_estimado);
  const nextValor = valorAtual ?? valorEstimado;

  const pncpVigencia = await sql<
    { data_vigencia_inicio: string | null; data_vigencia_fim: string | null }[]
  >`
    SELECT data_vigencia_inicio, data_vigencia_fim
    FROM tenant_contract
    WHERE contratacao_id = ${contract.contratacao_id}::uuid
      AND origem = 'pncp'
      AND data_vigencia_fim IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const vigenciaInicio =
    contract.data_vigencia_inicio ??
    pncpVigencia[0]?.data_vigencia_inicio ??
    null;
  const vigenciaFim =
    contract.data_vigencia_fim ??
    pncpVigencia[0]?.data_vigencia_fim ??
    null;

  const changed =
    (nextValor != null && nextValor !== valorAtual) ||
    (vigenciaInicio && !contract.data_vigencia_inicio) ||
    (vigenciaFim && !contract.data_vigencia_fim);

  if (!changed) return false;

  await sql`
    UPDATE tenant_contract
    SET
      valor_global = COALESCE(${nextValor}, valor_global),
      data_vigencia_inicio = COALESCE(${vigenciaInicio}, data_vigencia_inicio),
      data_vigencia_fim = COALESCE(${vigenciaFim}, data_vigencia_fim),
      updated_at = now()
    WHERE id = ${contractId}::uuid
  `;
  return true;
}

export async function syncLinkedContracts(contratacaoId: string): Promise<number> {
  const sql = getComprasGovSql();
  const contracts = await sql<{ id: string }[]>`
    SELECT id FROM tenant_contract
    WHERE contratacao_id = ${contratacaoId}::uuid
  `;

  let updated = 0;
  for (const c of contracts) {
    const ok = await backfillContractFromContratacao(c.id);
    if (ok) updated += 1;
  }
  return updated;
}

export async function applyPncpVigenciaToLinkedManual(input: {
  contratacaoId: string;
  dataVigenciaInicio?: string | null;
  dataVigenciaFim?: string | null;
  valorGlobal?: number | null;
}): Promise<number> {
  const sql = getComprasGovSql();
  const inicio = toDateOnly(input.dataVigenciaInicio);
  const fim = toDateOnly(input.dataVigenciaFim);
  const valor = input.valorGlobal != null && input.valorGlobal > 0 ? input.valorGlobal : null;

  if (!inicio && !fim && valor == null) return 0;

  const rows = await sql<{ id: string }[]>`
    UPDATE tenant_contract
    SET
      data_vigencia_inicio = COALESCE(data_vigencia_inicio, ${inicio}),
      data_vigencia_fim = COALESCE(data_vigencia_fim, ${fim}),
      valor_global = COALESCE(
        CASE WHEN valor_global IS NULL OR valor_global = 0 THEN ${valor} ELSE valor_global END,
        valor_global
      ),
      updated_at = now()
    WHERE contratacao_id = ${input.contratacaoId}::uuid
    RETURNING id
  `;
  return rows.length;
}
