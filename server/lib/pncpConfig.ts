import type { Request, Response } from 'express';
import { db, isDatabaseConfigured } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptSecret } from './crypto.js';
import { getAuthenticatedTenantId, validateTenantAccess } from './tenantAuth.js';

export interface PncpTenantConfig {
  certificatePath?: string;
  certificatePassword?: string;
  isActive?: boolean;
}

export interface PncpConfigResponse {
  certificatePath: string;
  isActive: boolean;
  hasPassword: boolean;
}

// In-memory fallback store for tenant configs (useful in tests and when DB is not configured)
export const inMemoryTenantConfigs = new Map<number, { tenantId: number; pncpConfig?: PncpTenantConfig }>();

/**
 * Gets the PNCP configuration for a specific tenant.
 * Passwords are NEVER returned (only hasPassword boolean indicator).
 */
export async function getPncpConfigForTenant(tenantId: number): Promise<PncpConfigResponse> {
  let pncpConfig: PncpTenantConfig | undefined;

  if (isDatabaseConfigured) {
    try {
      const configs = await db
        .select()
        .from(schema.tenantConfigs)
        .where(eq(schema.tenantConfigs.tenantId, tenantId));
      if (configs.length > 0) {
        pncpConfig = configs[0].pncpConfig || {};
      }
    } catch (err) {
      console.warn('⚠️ DB query failed for tenantConfigs, checking in-memory store:', (err as Error).message);
    }
  }

  if (!pncpConfig && inMemoryTenantConfigs.has(tenantId)) {
    pncpConfig = inMemoryTenantConfigs.get(tenantId)?.pncpConfig;
  }

  return {
    certificatePath: pncpConfig?.certificatePath || '',
    isActive: pncpConfig?.isActive || false,
    hasPassword: !!pncpConfig?.certificatePassword,
  };
}

/**
 * Updates or creates the PNCP configuration for a specific tenant.
 * Empty password means "retain existing password" if one exists.
 */
export async function updatePncpConfigForTenant(
  tenantId: number,
  data: {
    certificatePath?: string;
    certificatePassword?: string;
    isActive?: boolean;
  }
): Promise<PncpConfigResponse> {
  let existingPncpConfig: PncpTenantConfig | undefined;
  let hasDbRecord = false;

  if (isDatabaseConfigured) {
    try {
      const existingConfigs = await db
        .select()
        .from(schema.tenantConfigs)
        .where(eq(schema.tenantConfigs.tenantId, tenantId));
      if (existingConfigs.length > 0) {
        hasDbRecord = true;
        existingPncpConfig = existingConfigs[0]?.pncpConfig || {};
      }
    } catch (err) {
      console.warn('⚠️ DB query failed for tenantConfigs, checking in-memory store:', (err as Error).message);
    }
  }

  if (!existingPncpConfig && inMemoryTenantConfigs.has(tenantId)) {
    existingPncpConfig = inMemoryTenantConfigs.get(tenantId)?.pncpConfig;
  }

  // Retain existing password if empty password supplied
  const encryptedPassword = data.certificatePassword
    ? encryptSecret(data.certificatePassword)
    : (existingPncpConfig?.certificatePassword || '');

  const newPncpConfig: PncpTenantConfig = {
    certificatePath: data.certificatePath || '',
    certificatePassword: encryptedPassword,
    isActive: data.isActive !== undefined ? data.isActive : false,
  };

  if (isDatabaseConfigured) {
    try {
      if (hasDbRecord) {
        await db
          .update(schema.tenantConfigs)
          .set({ pncpConfig: newPncpConfig })
          .where(eq(schema.tenantConfigs.tenantId, tenantId));
      } else {
        await db
          .insert(schema.tenantConfigs)
          .values({ tenantId, pncpConfig: newPncpConfig });
      }
    } catch (err) {
      console.warn('⚠️ DB write failed for tenantConfigs, falling back to in-memory store:', (err as Error).message);
    }
  }

  inMemoryTenantConfigs.set(tenantId, { tenantId, pncpConfig: newPncpConfig });

  return {
    certificatePath: newPncpConfig.certificatePath || '',
    isActive: newPncpConfig.isActive || false,
    hasPassword: !!newPncpConfig.certificatePassword,
  };
}

/**
 * Express handler for GET /api/config/tenant/pncp
 * Security: Always uses req.user.tenantId, rejects cross-tenant attempts with 403, fail-closed (401) on missing auth.
 */
export async function handleGetPncpConfig(req: Request, res: Response) {
  try {
    const tenantId = getAuthenticatedTenantId(req, res);
    if (tenantId === null) return;

    if (!validateTenantAccess(req, res, tenantId)) return;

    const result = await getPncpConfigForTenant(tenantId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar configuração do PNCP.' });
  }
}

/**
 * Express handler for PUT /api/config/tenant/pncp
 * Security: Always uses req.user.tenantId, rejects cross-tenant attempts with 403, fail-closed (401) on missing auth.
 */
export async function handlePutPncpConfig(req: Request, res: Response) {
  try {
    const tenantId = getAuthenticatedTenantId(req, res);
    if (tenantId === null) return;

    if (!validateTenantAccess(req, res, tenantId)) return;

    const { certificatePath, certificatePassword, isActive } = req.body || {};
    const result = await updatePncpConfigForTenant(tenantId, {
      certificatePath,
      certificatePassword,
      isActive,
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar configuração do PNCP.' });
  }
}
