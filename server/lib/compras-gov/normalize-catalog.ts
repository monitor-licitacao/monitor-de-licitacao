import type { ComprasGovCatmatItemDto } from './types.js';

export type CatalogItemRow = {
  catalogType: 'CATMAT' | 'CATSER';
  codigoItem: number;
  descricaoItem: string | null;
  codigoGrupo: number | null;
  nomeGrupo: string | null;
  codigoClasse: number | null;
  nomeClasse: string | null;
  codigoPdm: number | null;
  nomePdm: string | null;
  codigoNcm: string | null;
  rawJson: ComprasGovCatmatItemDto;
};

export function normalizeCatmatItem(dto: ComprasGovCatmatItemDto): CatalogItemRow {
  return {
    catalogType: 'CATMAT',
    codigoItem: dto.codigoItem,
    descricaoItem: dto.descricaoItem ?? null,
    codigoGrupo: dto.codigoGrupo ?? null,
    nomeGrupo: dto.nomeGrupo ?? null,
    codigoClasse: dto.codigoClasse ?? null,
    nomeClasse: dto.nomeClasse ?? null,
    codigoPdm: dto.codigoPdm ?? null,
    nomePdm: dto.nomePdm ?? null,
    codigoNcm: dto.codigo_ncm ?? null,
    rawJson: dto,
  };
}
