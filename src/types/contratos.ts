export type ContractTipo = 'contrato' | 'ata';
export type HealthStatus = 'saudavel' | 'atencao' | 'critico';

export type VigenciaExpectativa =
  | 'preenchida'
  | 'aguardando_contrato'
  | 'aguardando_ata'
  | 'nao_aplicavel';

export type ContractHealth = {
  health_score: number;
  status: HealthStatus;
  vigencia_expectativa?: VigenciaExpectativa;
  fatores: {
    tempo_restante: { score: number; dias_restantes: number | null; classificacao: HealthStatus };
    risco_institucional: { score: number; classificacao: HealthStatus };
    valor_vs_mercado: { score: number; classificacao: HealthStatus; desvio_percentual: number | null };
  };
};

export type ContractAction = {
  id: string;
  tipo: string;
  prioridade: string;
  titulo: string;
  descricao?: string;
  contrato_id?: string;
};

export type ContractAnalysis = {
  contrato: {
    id: string;
    tipo: ContractTipo;
    numero_controle_pncp: string | null;
    numero_contrato_empenho: string | null;
    objeto: string | null;
    orgao_razao_social: string | null;
    orgao_cnpj: string;
    fornecedor_razao_social: string | null;
    uf_sigla: string | null;
    valor_global: number | null;
    data_vigencia_inicio: string | null;
    data_vigencia_fim: string | null;
  };
  health: ContractHealth;
  alertas: { id: string; severidade: string; titulo: string }[];
  acoes_recomendadas: ContractAction[];
};

export type DashboardData = {
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
};

export type UnidadeMedida = { sigla: string; nome: string };

export type CatalogHit = {
  id: string;
  tipo: 'material' | 'servico';
  codigo: number;
  descricao: string;
  unidade: string | null;
  classe: string | null;
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

export type ManualItemPreview = {
  numero_item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  orcamento_sigiloso: boolean;
};

export type ContractDetail = ContractAnalysis & {
  itens: {
    id: string;
    descricao: string | null;
    quantidade: string | null;
    unidade_medida: string | null;
    valor_unitario: string | null;
    valor_total: string | null;
  }[];
  oficios: {
    id: string;
    tipo: string;
    assunto: string;
    status: string;
    created_at: string;
  }[];
};

export type ContratoTab =
  | 'dashboard'
  | 'contratos'
  | 'atas'
  | 'criticos'
  | 'vencendo'
  | 'vencidos';
