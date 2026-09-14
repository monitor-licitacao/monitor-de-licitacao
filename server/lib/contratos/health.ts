import type {
  ActionPrioridade,
  ActionTipo,
  ContractAction,
  ContractAlert,
  ContractAnalysis,
  ContractHealth,
  DashboardPayload,
  HealthStatus,
  TenantContractRow,
  VigenciaExpectativa,
} from './types.js';
import { vigenciaPendente } from './vigencia-policy.js';

export const HEALTH_ENGINE_VERSION = 'v1';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function diasAteVigenciaFim(
  dataVigenciaFim: string | Date | null | undefined,
  refDate: Date = new Date(),
): number | null {
  const fim = toDateOnly(dataVigenciaFim);
  if (!fim) return null;
  const ref = new Date(refDate);
  ref.setHours(12, 0, 0, 0);
  const diffMs = fim.getTime() - ref.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function scoreTempoRestante(dias: number | null): number {
  if (dias == null) return 50;
  if (dias > 180) return 100;
  if (dias >= 91) return 80;
  if (dias >= 31) return 50;
  if (dias >= 1) return 25;
  if (dias === 0) return 10;
  return 0;
}

export function classificarScore(score: number): HealthStatus {
  if (score >= 80) return 'saudavel';
  if (score >= 50) return 'atencao';
  return 'critico';
}

export function scoreRiscoInstitucional(input: {
  orgaoCnpj: string;
  diasRestantes: number | null;
  hasOficioRenovacaoOuEncerramento: boolean;
  orgaoContractCount: number;
}): number {
  let score = 70;
  if (input.orgaoContractCount > 1) score += 10;
  if (input.diasRestantes != null && input.diasRestantes < 0 && !input.hasOficioRenovacaoOuEncerramento) {
    score -= 20;
  }
  return clamp(score, 0, 100);
}

export function scoreValorVsMercado(desvioPercentual: number | null): number {
  if (desvioPercentual == null || Number.isNaN(desvioPercentual)) return 50;
  const d = desvioPercentual;
  if (Math.abs(d) <= 5) return 100;
  if (d > 15) return 70;
  if (d > 5) return 85;
  if (d < -15) return 30;
  if (d < -5) return 55;
  return 50;
}

export function computeHealthScore(input: {
  tempoRestante: number;
  riscoInstitucional: number;
  valorVsMercado: number;
}): number {
  return Math.round(
    0.5 * input.tempoRestante +
      0.25 * input.riscoInstitucional +
      0.25 * input.valorVsMercado,
  );
}

export function buildContractHealth(input: {
  dataVigenciaFim: string | null;
  orgaoCnpj: string;
  orgaoContractCount: number;
  hasOficioRenovacaoOuEncerramento: boolean;
  desvioPercentual: number | null;
  vigenciaExpectativa?: VigenciaExpectativa;
  refDate?: Date;
}): ContractHealth {
  const dias = diasAteVigenciaFim(input.dataVigenciaFim, input.refDate);
  const expectativa = input.vigenciaExpectativa ?? (dias != null ? 'preenchida' : 'aguardando_contrato');
  const tempoScore = scoreTempoRestante(dias);
  const riscoScore = scoreRiscoInstitucional({
    orgaoCnpj: input.orgaoCnpj,
    diasRestantes: dias,
    hasOficioRenovacaoOuEncerramento: input.hasOficioRenovacaoOuEncerramento,
    orgaoContractCount: input.orgaoContractCount,
  });
  const valorScore = scoreValorVsMercado(input.desvioPercentual);
  const healthScore = computeHealthScore({
    tempoRestante: tempoScore,
    riscoInstitucional: riscoScore,
    valorVsMercado: valorScore,
  });

  return {
    health_score: healthScore,
    status: classificarScore(healthScore),
    vigencia_expectativa: expectativa,
    fatores: {
      tempo_restante: {
        score: tempoScore,
        classificacao: classificarScore(tempoScore),
        dias_restantes: dias,
      },
      risco_institucional: {
        score: riscoScore,
        classificacao: classificarScore(riscoScore),
      },
      valor_vs_mercado: {
        score: valorScore,
        classificacao: classificarScore(valorScore),
        desvio_percentual: input.desvioPercentual,
      },
    },
    explicacao: `Motor ${HEALTH_ENGINE_VERSION}: prazo ${dias ?? 'pendente'}d, risco ${riscoScore}, preço ${valorScore}`,
  };
}

function prioridadeFrom(status: HealthStatus, dias: number | null): ActionPrioridade {
  if (status === 'critico' || (dias != null && dias < 0)) return 'critica';
  if (status === 'atencao' || (dias != null && dias >= 0 && dias <= 30)) return 'alta';
  if (dias != null && dias <= 90) return 'media';
  return 'baixa';
}

export function buildRecommendedActions(input: {
  row: TenantContractRow;
  health: ContractHealth;
  hasOficio: boolean;
}): ContractAction[] {
  const dias = input.health.fatores.tempo_restante.dias_restantes;
  const desvio = input.health.fatores.valor_vs_mercado.desvio_percentual;
  const actions: ContractAction[] = [];
  const base = {
    contrato_id: input.row.id,
    contrato_tipo: input.row.tipo,
    contrato_numero: input.row.numero_contrato_empenho ?? input.row.numero_controle_pncp,
    contrato_objeto: input.row.objeto,
  };

  if (dias != null && dias < 0) {
    actions.push({
      id: `${input.row.id}-encerramento`,
      tipo: 'encerramento',
      prioridade: 'critica',
      titulo: 'Contrato vencido — avaliar encerramento ou renovação',
      descricao: 'A vigência já encerrou. Defina encerramento formal ou proposta de renovação.',
      fatores_considerados: ['vigência vencida'],
      prazo_recomendado: null,
      ...base,
    });
  } else if (dias != null && dias >= 1 && dias <= 90) {
    actions.push({
      id: `${input.row.id}-renovacao`,
      tipo: 'renovacao',
      prioridade: prioridadeFrom(input.health.status, dias),
      titulo: 'Vigência próxima — preparar renovação',
      descricao: `Faltam ${dias} dias para o fim da vigência.`,
      fatores_considerados: ['prazo de vigência'],
      prazo_recomendado: input.row.data_vigencia_fim,
      ...base,
    });
  }

  if (desvio != null && desvio < -15) {
    actions.push({
      id: `${input.row.id}-preco`,
      tipo: 'revisar_preco',
      prioridade: 'alta',
      titulo: 'Preço abaixo da mediana de mercado',
      descricao: `Desvio de ${Math.abs(desvio).toFixed(0)}% abaixo da mediana — risco de margem.`,
      fatores_considerados: ['valor vs mercado'],
      prazo_recomendado: null,
      ...base,
    });
  }

  if (input.health.status === 'critico' && !input.hasOficio) {
    actions.push({
      id: `${input.row.id}-docs`,
      tipo: 'preparar_documentacao',
      prioridade: 'alta',
      titulo: 'Organizar documentação e ofício',
      descricao: 'Saúde crítica sem ofício registrado — prepare a documentação de renovação ou encerramento.',
      fatores_considerados: ['saúde crítica', 'sem ofício'],
      prazo_recomendado: null,
      ...base,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: `${input.row.id}-monitorar`,
      tipo: 'monitorar',
      prioridade: 'baixa',
      titulo: 'Acompanhar execução',
      descricao: 'Contrato dentro dos parâmetros esperados.',
      fatores_considerados: ['saúde estável'],
      prazo_recomendado: null,
      ...base,
    });
  }

  return actions;
}

export function buildAlerts(health: ContractHealth, row: TenantContractRow): ContractAlert[] {
  const alertas: ContractAlert[] = [];
  const dias = health.fatores.tempo_restante.dias_restantes;

  if (vigenciaPendente(health.vigencia_expectativa ?? 'preenchida') && dias == null) {
    alertas.push({
      id: `${row.id}-vigencia-pendente`,
      severidade: 'warning',
      titulo: 'Vigência pendente',
      descricao:
        health.vigencia_expectativa === 'aguardando_ata'
          ? 'Aguardando publicação da ata no PNCP.'
          : 'Aguardando publicação do contrato no PNCP.',
    });
  }

  if (dias != null && dias < 0) {
    alertas.push({
      id: `${row.id}-vencido`,
      severidade: 'critical',
      titulo: 'Contrato vencido',
      descricao: `Vencido há ${Math.abs(dias)} dias`,
    });
  } else if (dias != null && dias <= 30) {
    alertas.push({
      id: `${row.id}-vencendo`,
      severidade: 'critical',
      titulo: 'Vigência crítica',
      descricao: dias === 0 ? 'Vence hoje' : `Faltam ${dias} dias`,
    });
  }

  const desvio = health.fatores.valor_vs_mercado.desvio_percentual;
  if (desvio != null && desvio < -15) {
    alertas.push({
      id: `${row.id}-preco`,
      severidade: 'warning',
      titulo: 'Preço abaixo do mercado',
      descricao: `${Math.abs(desvio).toFixed(0)}% abaixo da mediana`,
    });
  }

  return alertas;
}

export function rowToContractView(row: TenantContractRow) {
  return {
    id: row.id,
    tipo: row.tipo,
    origem: row.origem,
    numero_controle_pncp: row.numero_controle_pncp,
    numero_contrato_empenho: row.numero_contrato_empenho,
    objeto: row.objeto,
    orgao_razao_social: row.orgao_razao_social,
    orgao_cnpj: row.orgao_cnpj,
    fornecedor_razao_social: row.fornecedor_razao_social,
    fornecedor_cnpj: row.fornecedor_cnpj,
    uf_sigla: row.uf_sigla,
    valor_global: row.valor_global != null ? Number(row.valor_global) : null,
    data_vigencia_inicio: row.data_vigencia_inicio,
    data_vigencia_fim: row.data_vigencia_fim,
  };
}

export function buildAnalysis(input: {
  row: TenantContractRow;
  health: ContractHealth;
  hasOficio: boolean;
}): ContractAnalysis {
  return {
    contrato: rowToContractView(input.row),
    health: input.health,
    alertas: buildAlerts(input.health, input.row),
    acoes_recomendadas: buildRecommendedActions(input),
  };
}

export function isVencendo(dias: number | null): boolean {
  return dias != null && dias > 0 && dias <= 90;
}

export function isVencido(dias: number | null): boolean {
  return dias != null && dias < 0;
}

export function isOportunidadeRenovacao(dias: number | null, tempoScore: number): boolean {
  return dias != null && dias >= 31 && dias <= 90 && tempoScore >= 50;
}

export function needsAction(analysis: ContractAnalysis): boolean {
  return (
    analysis.health.status === 'atencao' ||
    analysis.health.status === 'critico' ||
    analysis.alertas.length > 0
  );
}

export function sortAnalyses(
  items: ContractAnalysis[],
  orderBy: 'health_score' | 'vencimento' | 'valor' | 'risco' = 'health_score',
): ContractAnalysis[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const da = a.health.fatores.tempo_restante.dias_restantes;
    const db = b.health.fatores.tempo_restante.dias_restantes;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    if (da != null && db != null && da > 0 && db <= 0) return -1;
    if (da != null && db != null && da <= 0 && db > 0) return 1;
    switch (orderBy) {
      case 'vencimento':
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      case 'valor':
        return (b.contrato.valor_global ?? 0) - (a.contrato.valor_global ?? 0);
      case 'risco':
        return (
          a.health.fatores.risco_institucional.score -
          b.health.fatores.risco_institucional.score
        );
      default:
        return a.health.health_score - b.health.health_score;
    }
  });
  return sorted;
}

export function filterByStatus(
  items: ContractAnalysis[],
  status?: HealthStatus | '',
): ContractAnalysis[] {
  if (!status) return items;
  return items.filter((i) => i.health.status === status);
}

export function filterByVencimento(
  items: ContractAnalysis[],
  vencimento?: 'vencendo' | 'vencido',
): ContractAnalysis[] {
  if (!vencimento) return items;
  return items.filter((i) => {
    const dias = i.health.fatores.tempo_restante.dias_restantes;
    return vencimento === 'vencendo' ? isVencendo(dias) : isVencido(dias);
  });
}

export function aggregateDashboard(analyses: ContractAnalysis[]): {
  resumo: DashboardPayload['resumo'];
  distribuicao_saude: DashboardPayload['distribuicao_saude'];
  distribuicao_por_tipo: DashboardPayload['distribuicao_por_tipo'];
} {
  const contratos = analyses.filter((a) => a.contrato.tipo === 'contrato');
  const atas = analyses.filter((a) => a.contrato.tipo === 'ata');

  const countByStatus = (list: ContractAnalysis[]) => ({
    saudavel: list.filter((a) => a.health.status === 'saudavel').length,
    atencao: list.filter((a) => a.health.status === 'atencao').length,
    critico: list.filter((a) => a.health.status === 'critico').length,
  });

  const distContratos = countByStatus(contratos);
  const distAtas = countByStatus(atas);
  const distAll = countByStatus(analyses);

  const sumValor = (list: ContractAnalysis[]) =>
    list.reduce((acc, a) => acc + (a.contrato.valor_global ?? 0), 0);

  const alertasAtivos = analyses.reduce((acc, a) => acc + a.alertas.length, 0);

  return {
    resumo: {
      total_contratos: contratos.length,
      total_atas: atas.length,
      contratos_saudaveis: distAll.saudavel,
      contratos_atencao: distAll.atencao,
      contratos_criticos: distAll.critico,
      valor_total: sumValor(analyses),
      valor_contratos: sumValor(contratos),
      valor_atas: sumValor(atas),
      alertas_ativos: alertasAtivos,
    },
    distribuicao_saude: distAll,
    distribuicao_por_tipo: {
      contratos: distContratos,
      atas: distAtas,
    },
  };
}

export type { ActionTipo, ActionPrioridade };
