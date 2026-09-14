/** Normaliza unidade de medida PNCP para join de preço (UN/UNIDADE/UND → UN). */
export function canonizeUnidade(unidade: string | null | undefined): string | null {
  if (!unidade) return null;
  const u = unidade.trim().toUpperCase().replace(/\./g, '');
  if (!u) return null;
  if (u === 'UN' || u === 'UNIDADE' || u === 'UNID' || u === 'UND') return 'UN';
  if (u === 'KG' || u === 'QUILOGRAMA') return 'KG';
  if (u === 'L' || u === 'LITRO') return 'L';
  if (u === 'M' || u === 'METRO') return 'M';
  if (u === 'M2' || u === 'M²') return 'M2';
  return u.slice(0, 20);
}
