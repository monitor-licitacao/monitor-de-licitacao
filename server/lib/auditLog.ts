import { db, isDatabaseConfigured } from '../db/index.js';
import * as schema from '../db/schema.js';

export interface AuditEventInput {
  tenantId: number;
  action: string;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persists audit events to Neon. Fail-open: logging failures must not block
 * the primary request flow (see docs/SNAPSHOT_DECISION.md).
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  if (!isDatabaseConfigured) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[AuditLog] DATABASE_URL missing in production — audit event dropped:', input.action);
    }
    return;
  }

  try {
    await db.insert(schema.auditLog).values({
      tenantId: input.tenantId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (error) {
    console.error('[AuditLog] Failed to persist audit event:', input.action, error);
  }
}
