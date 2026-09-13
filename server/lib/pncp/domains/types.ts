/** DTOs públicos do PNCP — Domain Registry (issue #81). Sem interpretação jurídica. */

export const PNCP_DOMAIN_SOURCE = 'pncp';

export type PncpDomainKind = 'modalidade' | 'instrumento' | 'amparo';

export type PncpTipoAmparoLegalDto = {
  id: number;
  nome: string;
  descricao?: string | null;
  statusAtivo?: boolean | null;
};

export type PncpModalidadeDto = {
  id: number;
  nome: string;
  descricao?: string | null;
  dataInclusao?: string | null;
  dataAtualizacao?: string | null;
  statusAtivo?: boolean | null;
  irp?: boolean | null;
};

export type PncpInstrumentoDto = {
  id: number;
  nome: string;
  descricao?: string | null;
  obrigatoriedadeDataAberturaPropostaNome?: string | null;
  obrigatoriedadeDataEncerramentoPropostaNome?: string | null;
  dataInclusao?: string | null;
  dataAtualizacao?: string | null;
  statusAtivo?: boolean | null;
};

export type PncpAmparoLegalDto = {
  id: number;
  nome: string;
  descricao?: string | null;
  tipoAmparoLegal?: PncpTipoAmparoLegalDto | null;
  dataInclusao?: string | null;
  dataAtualizacao?: string | null;
  statusAtivo?: boolean | null;
};

export type NormalizedTipoAmparo = {
  pncpId: number;
  nome: string;
  descricao: string | null;
  statusAtivo: boolean;
  rawJson: Record<string, unknown>;
  payloadHash: string;
};

export type NormalizedModalidade = {
  pncpId: number;
  nome: string;
  descricao: string | null;
  irp: boolean | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  rawJson: Record<string, unknown>;
  payloadHash: string;
};

export type NormalizedInstrumento = {
  pncpId: number;
  nome: string;
  descricao: string | null;
  obrigatoriedadeAberturaProposta: string | null;
  obrigatoriedadeEncerramentoProposta: string | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  rawJson: Record<string, unknown>;
  payloadHash: string;
};

export type NormalizedAmparo = {
  pncpId: number;
  nome: string;
  descricao: string | null;
  tipo: NormalizedTipoAmparo | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  rawJson: Record<string, unknown>;
  payloadHash: string;
};

export type DomainListFilters = {
  statusAtivo?: boolean;
  tipo?: number;
  q?: string;
};

export type ModalidadeApiRow = {
  id: string;
  pncpId: number;
  nome: string;
  descricao: string | null;
  irp: boolean | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  rawJson: Record<string, unknown> | null;
};

export type InstrumentoApiRow = {
  id: string;
  pncpId: number;
  nome: string;
  descricao: string | null;
  obrigatoriedadeAberturaProposta: string | null;
  obrigatoriedadeEncerramentoProposta: string | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  rawJson: Record<string, unknown> | null;
};

export type TipoAmparoApiRow = {
  id: string;
  pncpId: number;
  nome: string;
  descricao: string | null;
  statusAtivo: boolean;
};

export type AmparoApiRow = {
  id: string;
  pncpId: number;
  nome: string;
  descricao: string | null;
  statusAtivo: boolean;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  rawJson: Record<string, unknown> | null;
  tipoAmparoLegal: TipoAmparoApiRow | null;
};

export type DomainSyncSlice = {
  ok: boolean;
  recordCount?: number;
  changedRecords?: number;
  inactiveCount?: number;
  statusCode?: number;
  durationMs?: number;
  payloadHash?: string;
  error?: string;
};

export type SyncPncpDomainsResult = {
  ok: boolean;
  domains: {
    modalidade: DomainSyncSlice;
    instrumento: DomainSyncSlice;
    amparo: DomainSyncSlice;
  };
};
