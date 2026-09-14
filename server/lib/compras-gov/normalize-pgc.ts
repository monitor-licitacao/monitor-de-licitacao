import type { ComprasGovPgcDetalheDto } from './types.js';

export type PgcDfdRow = {
  orgaoCnpj: string;
  ano: number;
  numeroArtifacto: number;
  ordemDfd: number;
  codigoUasg: string | null;
  nomeUasg: string | null;
  descricaoObjetoDfd: string | null;
  tipoItem: string | null;
  codigoItemCatalogo: number | null;
  catalogType: 'CATMAT' | 'CATSER' | null;
  valorTotalItem: number | null;
  dataPrevistaFormalizacao: string | null;
  rawJson: ComprasGovPgcDetalheDto;
};

export function inferCatalogTypeFromPgc(dto: ComprasGovPgcDetalheDto): 'CATMAT' | 'CATSER' | null {
  if (dto.tipoItem === 'M') return 'CATMAT';
  if (dto.tipoItem === 'S') return 'CATSER';
  return null;
}

export function normalizePgcDfd(dto: ComprasGovPgcDetalheDto): PgcDfdRow {
  const codigoItemCatalogo = dto.codigoItemCatalogo
    ? Number.parseInt(String(dto.codigoItemCatalogo), 10)
    : null;

  return {
    orgaoCnpj: dto.orgao,
    ano: dto.anoArtefato,
    numeroArtifacto: dto.numeroArtefato,
    ordemDfd: dto.ordemDfd,
    codigoUasg: dto.codigoUasg ?? null,
    nomeUasg: dto.nomeUasg ?? null,
    descricaoObjetoDfd: dto.descricaoObjetoDfd ?? null,
    tipoItem: dto.tipoItem ?? null,
    codigoItemCatalogo: Number.isFinite(codigoItemCatalogo) ? codigoItemCatalogo : null,
    catalogType: inferCatalogTypeFromPgc(dto),
    valorTotalItem: dto.valorTotalItem ?? null,
    dataPrevistaFormalizacao: dto.dataPrevistaFormalizacaoDemanda ?? null,
    rawJson: dto,
  };
}
