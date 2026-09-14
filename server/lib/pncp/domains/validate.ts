import type {
  PncpAmparoLegalDto,
  PncpDomainKind,
  PncpInstrumentoDto,
  PncpModalidadeDto,
  PncpTipoAmparoLegalDto,
} from './types.js';

export class PncpDomainSchemaError extends Error {
  readonly kind: PncpDomainKind;
  constructor(message: string, kind: PncpDomainKind) {
    super(message);
    this.name = 'PncpDomainSchemaError';
    this.kind = kind;
  }
}

export class PncpDomainHttpError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PncpDomainHttpError';
    this.statusCode = statusCode;
  }
}

function asRecord(value: unknown, kind: PncpDomainKind, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PncpDomainSchemaError(`${label} não é objeto`, kind);
  }
  return value as Record<string, unknown>;
}

function asList(payload: unknown, kind: PncpDomainKind): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: unknown[] }).data;
  }
  throw new PncpDomainSchemaError('payload não é lista', kind);
}

function requireNumber(row: Record<string, unknown>, key: string, kind: PncpDomainKind): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PncpDomainSchemaError(`campo obrigatório '${key}' ausente ou com tipo inválido`, kind);
  }
  return value;
}

function requireString(row: Record<string, unknown>, key: string, kind: PncpDomainKind): string {
  const value = row[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PncpDomainSchemaError(`campo obrigatório '${key}' ausente ou com tipo inválido`, kind);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseTipo(value: unknown, kind: PncpDomainKind): PncpTipoAmparoLegalDto | null {
  if (value == null) return null;
  const row = asRecord(value, kind, 'tipoAmparoLegal');
  return {
    id: requireNumber(row, 'id', kind),
    nome: requireString(row, 'nome', kind),
    descricao: optionalString(row.descricao),
    statusAtivo: optionalBoolean(row.statusAtivo),
  };
}

export function validateModalidadeList(payload: unknown): PncpModalidadeDto[] {
  return asList(payload, 'modalidade').map((item, index) => {
    const row = asRecord(item, 'modalidade', `modalidade[${index}]`);
    return {
      id: requireNumber(row, 'id', 'modalidade'),
      nome: requireString(row, 'nome', 'modalidade'),
      descricao: optionalString(row.descricao),
      dataInclusao: optionalString(row.dataInclusao),
      dataAtualizacao: optionalString(row.dataAtualizacao),
      statusAtivo: optionalBoolean(row.statusAtivo),
      irp: optionalBoolean(row.irp),
    };
  });
}

export function validateInstrumentoList(payload: unknown): PncpInstrumentoDto[] {
  return asList(payload, 'instrumento').map((item, index) => {
    const row = asRecord(item, 'instrumento', `instrumento[${index}]`);
    return {
      id: requireNumber(row, 'id', 'instrumento'),
      nome: requireString(row, 'nome', 'instrumento'),
      descricao: optionalString(row.descricao),
      obrigatoriedadeDataAberturaPropostaNome: optionalString(row.obrigatoriedadeDataAberturaPropostaNome),
      obrigatoriedadeDataEncerramentoPropostaNome: optionalString(row.obrigatoriedadeDataEncerramentoPropostaNome),
      dataInclusao: optionalString(row.dataInclusao),
      dataAtualizacao: optionalString(row.dataAtualizacao),
      statusAtivo: optionalBoolean(row.statusAtivo),
    };
  });
}

export function validateAmparoList(payload: unknown): PncpAmparoLegalDto[] {
  return asList(payload, 'amparo').map((item, index) => {
    const row = asRecord(item, 'amparo', `amparo[${index}]`);
    return {
      id: requireNumber(row, 'id', 'amparo'),
      nome: requireString(row, 'nome', 'amparo'),
      descricao: optionalString(row.descricao),
      tipoAmparoLegal: parseTipo(row.tipoAmparoLegal, 'amparo'),
      dataInclusao: optionalString(row.dataInclusao),
      dataAtualizacao: optionalString(row.dataAtualizacao),
      statusAtivo: optionalBoolean(row.statusAtivo),
    };
  });
}
