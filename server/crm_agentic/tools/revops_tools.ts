import { db } from '../../db/index';
import * as schema from '../../db/schema';
import { eq, and, sql, gte, lte, or, desc } from 'drizzle-orm';

/**
 * Calcula a Taxa de Vitória (Win Rate)
 * Fórmula: Vitórias / (Vitórias + Perdas) em um período de tempo.
 * Indicador: Lagging
 */
export async function calculateWinRate(tenantId: number, startDate: Date, endDate: Date) {
  const deals = await db.select().from(schema.crmDeals).where(
    and(
      eq(schema.crmDeals.tenantId, tenantId),
      gte(schema.crmDeals.closedAt, startDate),
      lte(schema.crmDeals.closedAt, endDate),
      or(
        eq(schema.crmDeals.status, 'WON'),
        eq(schema.crmDeals.status, 'LOST')
      )
    )
  );

  const won = deals.filter(d => d.status === 'WON').length;
  const lost = deals.filter(d => d.status === 'LOST').length;
  const totalClosed = won + lost;

  const winRate = totalClosed > 0 ? won / totalClosed : 0;

  return {
    indicator: 'LAGGING',
    metric: 'Win Rate',
    won,
    lost,
    totalClosed,
    winRate: (winRate * 100).toFixed(2) + '%'
  };
}

/**
 * Calcula a Taxa de Conversão da Coorte (Cohort Conversion Rate)
 * Fórmula: Vendas no período / Total do Pipeline Criado no período.
 * Indicador: Current / Pipeline Health
 */
export async function calculateConversionRate(tenantId: number, cohortStartDate: Date, cohortEndDate: Date) {
  // Pega todas as oportunidades criadas na coorte
  const cohortDeals = await db.select().from(schema.crmDeals).where(
    and(
      eq(schema.crmDeals.tenantId, tenantId),
      gte(schema.crmDeals.createdAt, cohortStartDate),
      lte(schema.crmDeals.createdAt, cohortEndDate)
    )
  );

  const totalCohort = cohortDeals.length;
  const wonFromCohort = cohortDeals.filter(d => d.status === 'WON').length;
  
  const conversionRate = totalCohort > 0 ? wonFromCohort / totalCohort : 0;

  return {
    indicator: 'PIPELINE_HEALTH',
    metric: 'Cohort Conversion Rate',
    cohortSize: totalCohort,
    wonFromCohort,
    conversionRate: (conversionRate * 100).toFixed(2) + '%'
  };
}

/**
 * Análise de Higiene do Pipeline (Pipeline Hygiene)
 * Busca oportunidades travadas sem movimentação por um número 'slaDays' de dias.
 * Indicador: Operacional
 */
export async function analyzePipelineHygiene(tenantId: number, slaDays: number = 30) {
  const slaThreshold = new Date();
  slaThreshold.setDate(slaThreshold.getDate() - slaDays);

  const staleDeals = await db.select().from(schema.crmDeals).where(
    and(
      eq(schema.crmDeals.tenantId, tenantId),
      eq(schema.crmDeals.status, 'OPEN'),
      lte(schema.crmDeals.updatedAt, slaThreshold)
    )
  ).orderBy(desc(schema.crmDeals.updatedAt));

  return {
    indicator: 'OPERATIONAL_RISK',
    metric: 'Stale Pipeline Deals (Ervas Daninhas)',
    slaDays,
    staleCount: staleDeals.length,
    staleDeals: staleDeals.map(d => ({
      id: d.id,
      editalId: d.editalId,
      stageId: d.stageId,
      daysStagnant: Math.floor((new Date().getTime() - (d.updatedAt ? new Date(d.updatedAt).getTime() : new Date(d.createdAt!).getTime())) / (1000 * 3600 * 24)),
      lastUpdate: d.updatedAt
    }))
  };
}
