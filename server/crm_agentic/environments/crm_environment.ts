import { db } from '../../db/index';
import * as schema from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

export class CRMEnvironment {
  async createDeal(tenantId: string, editalId: string, title: string, value: string): Promise<string> {
    const dealId = `deal_${Date.now()}`;
    await db.insert(schema.crmDeals).values({
      id: dealId,
      tenantId: parseInt(tenantId, 10),
      editalId,
      stageId: 'new', // First stage
      title,
      value,
      status: 'OPEN',
    });
    
    await this.logAction(dealId, 'system', 'create_deal', { editalId });
    return dealId;
  }

  async moveStage(dealId: string, actor: string, newStage: string, reason?: string) {
    await db.update(schema.crmDeals)
      .set({ stageId: newStage, updatedAt: new Date() })
      .where(eq(schema.crmDeals.id, dealId));
    
    await this.logAction(dealId, actor, 'move_stage', { newStage, reason });
  }

  async setStatus(dealId: string, actor: string, status: 'OPEN' | 'WON' | 'LOST', reason?: string) {
    await db.update(schema.crmDeals)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.crmDeals.id, dealId));
    
    await this.logAction(dealId, actor, `status_${status.toLowerCase()}`, { reason });
  }

  async addNote(dealId: string, actor: string, note: string) {
    const [deal] = await db.select().from(schema.crmDeals).where(eq(schema.crmDeals.id, dealId));
    const updatedNotes = deal.notes ? `${deal.notes}\n\n[${new Date().toISOString()}] ${actor}: ${note}` : `[${new Date().toISOString()}] ${actor}: ${note}`;
    
    await db.update(schema.crmDeals)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(schema.crmDeals.id, dealId));

    await this.logAction(dealId, actor, 'add_note', { note });
  }

  private async logAction(dealId: string, actor: string, action: string, details: any) {
    await db.insert(schema.crmLogs).values({
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      dealId,
      actor,
      action,
      details,
    });
  }

  async getDealDetails(dealId: string) {
    const [deal] = await db.select().from(schema.crmDeals).where(eq(schema.crmDeals.id, dealId));
    const [edital] = await db.select().from(schema.editais).where(eq(schema.editais.id, deal.editalId));
    const history = await db.select().from(schema.crmLogs).where(eq(schema.crmLogs.dealId, dealId)).orderBy(desc(schema.crmLogs.timestamp));
    
    return { deal, edital, history };
  }
}
