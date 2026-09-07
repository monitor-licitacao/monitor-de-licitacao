import type { Request, Response, NextFunction } from 'express';

/**
 * Resolves the authenticated tenantId strictly from req.user.tenantId (JWT claims or service API key).
 * Never accepts tenantId from req.query or req.body for authorization.
 * Returns null and responds 401 fail-closed if tenantId is missing or invalid.
 */
export function getAuthenticatedTenantId(req: Request, res: Response): number | null {
  const tenantId = req.user?.tenantId;
  if (typeof tenantId !== 'number' || isNaN(tenantId)) {
    res.status(401).json({
      error: 'Unauthorized: Autenticação de tenant obrigatória (fail-closed).'
    });
    return null;
  }
  return tenantId;
}

/**
 * Gate for administrative mutations on tenant resources (e.g. Status Catalog CRUD writes).
 * Enforces explicit req.user.role === 'admin'.
 *
 * Security Policy:
 * - Missing or null role must NOT become admin (fail-closed).
 * - Regular users (role: 'user') are rejected with 403 Forbidden.
 * - Service principals (e.g. API keys with role: 'service') are rejected with 403 Forbidden.
 * - Unauthenticated requests receive 401 Unauthorized.
 */
export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId;
  if (typeof tenantId !== 'number' || isNaN(tenantId)) {
    return res.status(401).json({
      error: 'Unauthorized: Autenticação de tenant obrigatória (fail-closed).'
    });
  }

  // Explicit admin role required - fail-closed: missing/null/undefined role is NOT admin
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: Operação restrita a administradores do tenant (role admin requerido).'
    });
  }

  next();
}

/**
 * Validates that an incoming request query or body does not attempt to specify a mismatched tenantId (cross-tenant access / IDOR injection).
 * If a client supplies a tenantId that differs from the authenticated tenantId, returns 403 Forbidden.
 */
export function validateTenantAccess(req: Request, res: Response, authenticatedTenantId: number): boolean {
  // Query param check
  if (req.query?.tenantId !== undefined) {
    const queryTid = typeof req.query.tenantId === 'number'
      ? req.query.tenantId
      : parseInt(String(req.query.tenantId), 10);
    if (!isNaN(queryTid) && queryTid !== authenticatedTenantId) {
      res.status(403).json({
        error: 'Forbidden: cross-tenant access denied.'
      });
      return false;
    }
  }

  // Body param check
  if (req.body?.tenantId !== undefined) {
    const bodyTid = typeof req.body.tenantId === 'number'
      ? req.body.tenantId
      : parseInt(String(req.body.tenantId), 10);
    if (!isNaN(bodyTid) && bodyTid !== authenticatedTenantId) {
      res.status(403).json({
        error: 'Forbidden: cross-tenant access denied.'
      });
      return false;
    }
  }

  return true;
}
