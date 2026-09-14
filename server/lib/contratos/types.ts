export type ContractTipo = 'contrato' | 'ata';
export type ContractOrigem = 'pncp' | 'manual';
export type HealthStatus = 'saudavel' | 'atencao' | 'critico';
export type HealthOverlay = 'vencido' | HealthStatus;

export type VigenciaExpectativa =
  | 'preenchida'
  | 'aguardando_contrato'
  | 'aguardando_ata'
  | 'nao_aplicavel';

export type ActionTipo =
  | 'monitorar'
  | 'preparar_documentacao'
  | 'revisar_preco'
  | 'relacionamento'
  | 'renovacao'
  | 'renegociacao'
  | 'encerramento';

export type ActionPrioridade = 'critica' | 'alta' | 'media' | 'baixa';

export type OficioTipo = 'renovacao' | 'reajuste' | 'encerramento';
export type OficioStatus = 'rascunho' | 'gerado' | 'enviado';

export type TenantContractRow = {
  id: string;
  tenant_id: number;
  tipo: ContractTipo;
  origem: ContractOrigem;
  numero_controle_pncp: string | null;
  numero_contrato_empenho: string | null;
  contratacao_id: string | null;
  orgao_cnpj: string;
  orgao_razao_social: string | null;
  uf_sigla: string | null;
  municipio_nome: string | null;
  fornecedor_cnpj: string;
  fornecedor_razao_social: string | null;
  objeto: string | null;
  valor_global: string | null;
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  indice_reajuste: string | null;
  valor_reajustado: string | null;
  reajustado_em: string | null;
  source_record_id: string | null;
  raw_json: unknown;
  created_at: string;
  updated_at: string;
};

export type TenantContractItemRow = {
  id: string;
  tenant_contract_id: string;
  descricao: string | null;
  quantidade: string | null;
  unidade_medida: string | null;
  unidade_canonica: string | null;
  valor_unitario: string | null;
  valor_total: string | null;
  catalog_type: string | null;
  catalogo_codigo_item: number | null;
  ordem: number;
};

export type ManualContractInput = {
  orgao_cnpj?: string;
  orgao_razao_social?: string;
  uf_sigla?: string;
  municipio_nome?: string;
  numero_contrato_empenho?: string;
  objeto_contrato?: string;
  valor_global?: number;
  data_vigencia_inicio?: string;
  data_vigencia_fim?: string;
  itens?: ManualContractItemInput[];
  /** v2 — origem contratação PNCP ingerida */
  contratacao_id?: string;
  numero_tipo?: 'pncp' | 'processo' | 'edital' | 'compra';
  item_numeros?: number[];
};

export type ManualContractSource = {
  id: string;
  numero_controle_pncp: string;
  objeto: string | null;
  cnpj_orgao: string;
  uf: string | null;
  orgao_razao_social: string | null;
  numeros_sugeridos: Array<{
    tipo: 'pncp' | 'processo' | 'edital' | 'compra';
    label: string;
    valor: string;
  }>;
};

export type ManualContractItemInput = {
  descricao?: string;
  quantidade?: number;
  unidade_medida?: string;
  valor_unitario?: number;
  valor_total?: number;
  catalogo_codigo_item?: number;
  catalogo_id?: string;
  material_ou_servico?: 'material' | 'servico';
};

export type HealthFactor = {
  score: number;
  classificacao: HealthStatus;
  dias_restantes?: number | null;
  desvio_percentual?: number | null;
};

export type ContractHealth = {
  health_score: number;
  status: HealthStatus;
  vigencia_expectativa?: VigenciaExpectativa;
  fatores: {
    tempo_restante: HealthFactor & { dias_restantes: number | null };
    risco_institucional: HealthFactor;
    valor_vs_mercado: HealthFactor & { desvio_percentual: number | null };
  };
  explicacao?: string;
};

export type ContractAlert = {
  id: string;
  severidade: 'critical' | 'warning' | 'info';
  titulo: string;
  descricao?: string;
};

export type ContractAction = {
  id: string;
  tipo: ActionTipo;
  prioridade: ActionPrioridade;
  titulo: string;
  descricao?: string;
  fatores_considerados: string[];
  prazo_recomendado?: string | null;
  contrato_id?: string;
  contrato_tipo?: ContractTipo;
  contrato_numero?: string | null;
  contrato_objeto?: string | null;
};

export type ContractAnalysis = {
  contrato: {
    id: string;
    tipo: ContractTipo;
    origem: ContractOrigem;
    numero_controle_pncp: string | null;
    numero_contrato_empenho: string | null;
    numero_item?: number | null;
    quantidade?: number | null;
    unidade_medida?: string | null;
    objeto: string | null;
    orgao_razao_social: string | null;
    orgao_cnpj: string;
    fornecedor_razao_social: string | null;
    fornecedor_cnpj: string;
    uf_sigla: string | null;
    valor_global: number | null;
    data_vigencia_inicio: string | null;
    data_vigencia_fim: string | null;
  };
  health: ContractHealth;
  alertas: ContractAlert[];
  acoes_recomendadas: ContractAction[];
};

export type DashboardPayload = {
  resumo: {
    total_contratos: number;
    total_atas: number;
    contratos_saudaveis: number;
    contratos_atencao: number;
    contratos_criticos: number;
    valor_total: number;
    valor_contratos: number;
    valor_atas: number;
    alertas_ativos: number;
  };
  contratos: ContractAnalysis[];
  atas: ContractAnalysis[];
  contratos_criticos: ContractAnalysis[];
  contratos_precisam_acao: ContractAnalysis[];
  contratos_vencendo: ContractAnalysis[];
  oportunidades_renovacao: ContractAnalysis[];
  acoes_prioritarias: ContractAction[];
  distribuicao_saude: { saudavel: number; atencao: number; critico: number };
  distribuicao_por_tipo: {
    contratos: { saudavel: number; atencao: number; critico: number };
    atas: { saudavel: number; atencao: number; critico: number };
  };
};

export type ListContractsQuery = {
  page?: number;
  limit?: number;
  status?: HealthStatus | '';
  orderBy?: 'health_score' | 'vencimento' | 'valor' | 'risco';
  vencimento?: 'vencendo' | 'vencido';
  tipo?: ContractTipo;
  fornecedorCnpj?: string;
};

export type CatalogHit = {
  id: string;
  tipo: 'material' | 'servico';
  codigo: number;
  descricao: string;
  unidade: string | null;
  classe: string | null;
};

export type CnpjLookupResult = {
  cnpj: string;
  razao_social: string;
  uf?: string;
  municipio?: string;
};
