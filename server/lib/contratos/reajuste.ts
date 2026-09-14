/** Índices de reajuste via BCB SGS (IPCA 433, IGP-M 189). */

export type IndiceCodigo = 'ipca' | 'igpm';

const SERIES: Record<IndiceCodigo, number> = {
  ipca: 433,
  igpm: 189,
};

export type IndicePoint = { data: string; valor: number };

export async function fetchIndiceSerie(
  codigo: IndiceCodigo,
  desde?: string,
  fetchFn: typeof fetch = fetch,
): Promise<IndicePoint[]> {
  const serie = SERIES[codigo];
  const params = new URLSearchParams({ formato: 'json' });
  if (desde) params.set('dataInicial', formatBcbDate(desde));
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?${params.toString()}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BCB SGS HTTP ${res.status}`);
  const data = (await res.json()) as { data: string; valor: string }[];
  return data.map((row) => ({
    data: parseBcbDate(row.data),
    valor: Number.parseFloat(row.valor.replace(',', '.')),
  }));
}

function formatBcbDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function parseBcbDate(br: string): string {
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

export function computeReajusteFactor(points: IndicePoint[]): number {
  if (points.length < 2) return 1;
  let factor = 1;
  for (let i = 1; i < points.length; i++) {
    factor *= 1 + points[i].valor / 100;
  }
  return factor;
}

export function applyReajuste(valorBase: number, factor: number): number {
  return Math.round(valorBase * factor * 100) / 100;
}

/** Fixture para testes offline. */
export const FIXTURE_IPCA: IndicePoint[] = [
  { data: '2025-01-01', valor: 0.5 },
  { data: '2025-02-01', valor: 0.4 },
  { data: '2025-03-01', valor: 0.3 },
];

export async function getIndiceSerieOrFixture(
  codigo: IndiceCodigo,
  desde?: string,
  fetchFn?: typeof fetch,
): Promise<IndicePoint[]> {
  if (process.env.CONTRATOS_REAJUSTE_FIXTURE === '1') {
    return FIXTURE_IPCA;
  }
  return fetchIndiceSerie(codigo, desde, fetchFn);
}
