/**
 * Ingest PNCP resultados homologados → fornecedor + resultado_item + price_observation.
 */
import { createHttpIngestAdapter } from './ingest.js';
import { parseNumeroControlePncp } from './resolve-controle.js';
import {
  createResultadosSourceRecord,
  persistResultadoBundle,
} from './persist-resultados.js';
import { createResultadosClient, type PncpResultadosClient } from './resultados-client.js';
import type { IngestResultadosResult, PncpItemDto, PncpItemResultadoDto } from './types.js';
import { getComprasGovSql } from '../compras-gov/persist.js';

export type IngestResultadosAdapter = {
  fetchItens: (cnpj: string, ano: number, sequencial: number) => Promise<PncpItemDto[]>;
  fetchItemResultados: (
    cnpj: string,
    ano: number,
    sequencial: number,
    numeroItem: number,
  ) => Promise<PncpItemResultadoDto[]>;
};

export function createHttpResultadosAdapter(): IngestResultadosAdapter {
  const ingest = createHttpIngestAdapter();
  const resultados = createResultadosClient();
  return {
    fetchItens: ingest.fetchItens.bind(ingest),
    fetchItemResultados: resultados.fetchItemResultados.bind(resultados),
  };
}

export function createFixtureResultadosAdapter(fixtures: {
  itens: PncpItemDto[];
  resultadosByItem: Map<number, PncpItemResultadoDto[]>;
}): IngestResultadosAdapter {
  return {
    async fetchItens() {
      return fixtures.itens;
    },
    async fetchItemResultados(_cnpj, _ano, _sequencial, numeroItem) {
      return fixtures.resultadosByItem.get(numeroItem) ?? [];
    },
  };
}

async function resolveUf(numeroControlePncp: string): Promise<string | null> {
  const sql = getComprasGovSql();
  const rows = await sql<{ uf: string | null }[]>`
    SELECT uf FROM contratacao WHERE numero_controle_pncp = ${numeroControlePncp} LIMIT 1
  `;
  return rows[0]?.uf ?? null;
}

export async function ingestContratacaoResultados(
  numeroControlePncp: string,
  adapter: IngestResultadosAdapter,
): Promise<IngestResultadosResult> {
  const parsed = parseNumeroControlePncp(numeroControlePncp);
  if (!parsed) {
    return { ok: false, error: `numeroControlePNCP inválido: ${numeroControlePncp}` };
  }

  try {
    const itens = await adapter.fetchItens(parsed.cnpj, parsed.ano, parsed.sequencial);
    const uf = await resolveUf(numeroControlePncp);
    let resultadosIngeridos = 0;
    let priceObservations = 0;
    let skipped = 0;

    for (const item of itens) {
      const temResultado = item.temResultado === true;
      if (!temResultado) {
        skipped++;
        continue;
      }

      const resultados = await adapter.fetchItemResultados(
        parsed.cnpj,
        parsed.ano,
        parsed.sequencial,
        item.numeroItem,
      );

      if (resultados.length === 0) {
        skipped++;
        continue;
      }

      const sourceRecordId = await createResultadosSourceRecord(
        numeroControlePncp,
        item.numeroItem,
        { item, resultados },
      );

      for (const resultado of resultados) {
        if (resultado.dataCancelamento) continue;
        const { priceObservationId } = await persistResultadoBundle({
          numeroControlePncp,
          numeroItem: item.numeroItem,
          item,
          resultado,
          uf,
          sourceRecordId,
        });
        resultadosIngeridos++;
        if (priceObservationId) priceObservations++;
      }
    }

    return {
      ok: true,
      numeroControlePncp,
      resultadosIngeridos,
      priceObservations,
      skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Persiste resultados a partir de fixture (testes offline). */
export async function ingestResultadosFromFixture(input: {
  numeroControlePncp: string;
  itens: PncpItemDto[];
  resultadosByItem: Map<number, PncpItemResultadoDto[]>;
  uf?: string | null;
}): Promise<IngestResultadosResult> {
  const parsed = parseNumeroControlePncp(input.numeroControlePncp);
  if (!parsed) {
    return { ok: false, error: `numeroControlePNCP inválido: ${input.numeroControlePncp}` };
  }

  let resultadosIngeridos = 0;
  let priceObservations = 0;
  let skipped = 0;

  for (const item of input.itens) {
    const resultados = input.resultadosByItem.get(item.numeroItem) ?? [];
    if (resultados.length === 0) {
      skipped++;
      continue;
    }

    const sourceRecordId = await createResultadosSourceRecord(
      input.numeroControlePncp,
      item.numeroItem,
      { item, resultados },
    );

    for (const resultado of resultados) {
      if (resultado.dataCancelamento) continue;
      const { priceObservationId } = await persistResultadoBundle({
        numeroControlePncp: input.numeroControlePncp,
        numeroItem: item.numeroItem,
        item,
        resultado,
        uf: input.uf ?? null,
        sourceRecordId,
      });
      resultadosIngeridos++;
      if (priceObservationId) priceObservations++;
    }
  }

  return {
    ok: true,
    numeroControlePncp: input.numeroControlePncp,
    resultadosIngeridos,
    priceObservations,
    skipped,
  };
}
