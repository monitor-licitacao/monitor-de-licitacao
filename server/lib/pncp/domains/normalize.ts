import { hashPayload } from '../../sourceLayer.js';
import type {
  NormalizedAmparo,
  NormalizedInstrumento,
  NormalizedModalidade,
  NormalizedTipoAmparo,
  PncpAmparoLegalDto,
  PncpInstrumentoDto,
  PncpModalidadeDto,
  PncpTipoAmparoLegalDto,
} from './types.js';

export function parseSourceDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRaw(dto: object): Record<string, unknown> {
  return { ...dto } as Record<string, unknown>;
}

export function normalizeTipoAmparo(dto: PncpTipoAmparoLegalDto): NormalizedTipoAmparo {
  return {
    pncpId: dto.id,
    nome: dto.nome,
    descricao: dto.descricao ?? null,
    statusAtivo: dto.statusAtivo ?? true,
    rawJson: asRaw(dto),
    payloadHash: hashPayload(dto),
  };
}

export function normalizeModalidade(dto: PncpModalidadeDto): NormalizedModalidade {
  return {
    pncpId: dto.id,
    nome: dto.nome,
    descricao: dto.descricao ?? null,
    irp: dto.irp ?? null,
    statusAtivo: dto.statusAtivo ?? true,
    sourceCreatedAt: parseSourceDate(dto.dataInclusao),
    sourceUpdatedAt: parseSourceDate(dto.dataAtualizacao),
    rawJson: asRaw(dto),
    payloadHash: hashPayload(dto),
  };
}

export function normalizeInstrumento(dto: PncpInstrumentoDto): NormalizedInstrumento {
  return {
    pncpId: dto.id,
    nome: dto.nome,
    descricao: dto.descricao ?? null,
    obrigatoriedadeAberturaProposta: dto.obrigatoriedadeDataAberturaPropostaNome ?? null,
    obrigatoriedadeEncerramentoProposta: dto.obrigatoriedadeDataEncerramentoPropostaNome ?? null,
    statusAtivo: dto.statusAtivo ?? true,
    sourceCreatedAt: parseSourceDate(dto.dataInclusao),
    sourceUpdatedAt: parseSourceDate(dto.dataAtualizacao),
    rawJson: asRaw(dto),
    payloadHash: hashPayload(dto),
  };
}

export function normalizeAmparo(dto: PncpAmparoLegalDto): NormalizedAmparo {
  return {
    pncpId: dto.id,
    nome: dto.nome,
    descricao: dto.descricao ?? null,
    tipo: dto.tipoAmparoLegal ? normalizeTipoAmparo(dto.tipoAmparoLegal) : null,
    statusAtivo: dto.statusAtivo ?? true,
    sourceCreatedAt: parseSourceDate(dto.dataInclusao),
    sourceUpdatedAt: parseSourceDate(dto.dataAtualizacao),
    rawJson: asRaw(dto),
    payloadHash: hashPayload(dto),
  };
}
