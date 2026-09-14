/**
 * Cruzamento de preço histórico — funções puras (sem rede/DB).
 */
export type PriceJoinLevel = 'CATMAT' | 'CATSER' | 'PDM' | 'NCM';

export type PriceJoinKey = {
  codigoCatalogo?: number | null;
  catalogType?: 'CATMAT' | 'CATSER' | null;
  codigoPdm?: number | null;
  ncmNbs?: string | null;
  unidade?: string | null;
};

export type PriceObservationRow = {
  valorUnitarioHomologado: number;
  dataResultado?: string | null;
};

export type PrecoMercadoStats = {
  status: 'OK' | 'INSUFICIENTE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  join_level: PriceJoinLevel | null;
  n: number;
  mediana: number | null;
  p25: number | null;
  p75: number | null;
  periodo_meses: number;
  label: string | null;
};

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function computePriceStats(
  values: number[],
  opts: {
    joinLevel: PriceJoinLevel;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    periodoMeses?: number;
    label?: string;
  },
): PrecoMercadoStats {
  if (values.length === 0) {
    return {
      status: 'INSUFICIENTE',
      confidence: null,
      join_level: null,
      n: 0,
      mediana: null,
      p25: null,
      p75: null,
      periodo_meses: opts.periodoMeses ?? 24,
      label: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  return {
    status: 'OK',
    confidence: opts.confidence,
    join_level: opts.joinLevel,
    n: sorted.length,
    mediana: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    periodo_meses: opts.periodoMeses ?? 24,
    label: opts.label ?? null,
  };
}

export function resolvePriceStatsFromObservations(
  observations: PriceObservationRow[],
  key: PriceJoinKey,
  opts?: { periodoMeses?: number },
): PrecoMercadoStats {
  const periodoMeses = opts?.periodoMeses ?? 24;
  const values = observations
    .map((o) => o.valorUnitarioHomologado)
    .filter((v) => Number.isFinite(v) && v > 0);

  if (key.codigoCatalogo != null && key.codigoCatalogo > 0) {
    const type = key.catalogType ?? 'CATMAT';
    return computePriceStats(values, {
      joinLevel: type,
      confidence: 'HIGH',
      periodoMeses,
      label: `${type} ${key.codigoCatalogo}`,
    });
  }

  if (key.codigoPdm != null && key.codigoPdm > 0) {
    return computePriceStats(values, {
      joinLevel: 'PDM',
      confidence: 'MEDIUM',
      periodoMeses,
      label: `PDM ${key.codigoPdm}`,
    });
  }

  const ncm = key.ncmNbs?.trim();
  if (ncm && ncm.length >= 4) {
    const unidade = key.unidade ? ` · ${key.unidade}` : '';
    return computePriceStats(values, {
      joinLevel: 'NCM',
      confidence: 'MEDIUM',
      periodoMeses,
      label: `NCM ${ncm}${unidade}`,
    });
  }

  return {
    status: 'INSUFICIENTE',
    confidence: null,
    join_level: null,
    n: 0,
    mediana: null,
    p25: null,
    p75: null,
    periodo_meses: periodoMeses,
    label: null,
  };
}

/** Extrai chaves de join a partir de metadados do item PNCP. */
export function buildPriceJoinKey(input: {
  codigoCatalogo?: number | string | null;
  catalogoTipo?: string | null;
  ncmNbs?: string | null;
  unidade?: string | null;
  codigoPdm?: number | null;
}): PriceJoinKey {
  const codigoRaw = input.codigoCatalogo;
  const codigoCatalogo =
    codigoRaw != null && codigoRaw !== ''
      ? Number.parseInt(String(codigoRaw), 10)
      : null;

  let catalogType: 'CATMAT' | 'CATSER' | null = null;
  const tipo = input.catalogoTipo?.toUpperCase() ?? '';
  if (tipo.includes('CATSER') || tipo === 'S') catalogType = 'CATSER';
  else if (tipo.includes('CATMAT') || tipo === 'M') catalogType = 'CATMAT';
  else if (codigoCatalogo != null) catalogType = 'CATMAT';

  return {
    codigoCatalogo: Number.isFinite(codigoCatalogo) ? codigoCatalogo : null,
    catalogType,
    codigoPdm: input.codigoPdm ?? null,
    ncmNbs: input.ncmNbs?.trim() || null,
    unidade: input.unidade?.trim() || null,
  };
}
