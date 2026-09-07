import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthenticatedTenantId,
  requireAdminRole,
  validateTenantAccess
} from './server/lib/tenantAuth.js';
import {
  handleGetPncpConfig,
  handlePutPncpConfig,
  getPncpConfigForTenant,
  updatePncpConfigForTenant,
  inMemoryTenantConfigs
} from './server/lib/pncpConfig.js';
import { decryptSecret } from './server/lib/crypto.js';

// Mock Express Response helper
function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// 1) ROLE & FAIL-OPEN TESTS (role null -> no admin; admin routes require explicit admin)
// ---------------------------------------------------------------------------

test('Authz Gap 1.1: requireAdminRole rejects user with role === null (no admin fail-open)', () => {
  const req: any = {
    user: {
      id: 'usr-1',
      tenantId: 10,
      role: null, // explicit null in auth context
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdminRole(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'role === null must NOT pass requireAdminRole');
  assert.equal(res.statusCode, 403, 'Must return 403 Forbidden');
  assert.ok(
    res.body?.error?.includes('Forbidden'),
    'Error message must indicate Forbidden'
  );
});

test('Authz Gap 1.2: requireAdminRole rejects user with missing/undefined role (no admin fail-open)', () => {
  const req: any = {
    user: {
      id: 'usr-2',
      tenantId: 10,
      // role omitted / undefined
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdminRole(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'Missing role must NOT pass requireAdminRole');
  assert.equal(res.statusCode, 403, 'Must return 403 Forbidden');
});

test('Authz Gap 1.3: requireAdminRole rejects regular user (role: "user")', () => {
  const req: any = {
    user: {
      id: 'usr-3',
      tenantId: 10,
      role: 'user',
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdminRole(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'role === "user" must NOT pass requireAdminRole');
  assert.equal(res.statusCode, 403);
});

test('Authz Gap 1.4: requireAdminRole rejects service principal (role: "service" from API key auth)', () => {
  const req: any = {
    user: {
      tenantId: 1,
      role: 'service', // Scoped API key auth principal
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdminRole(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'API key service principal must NOT have admin access');
  assert.equal(res.statusCode, 403, 'API key principal must receive 403 Forbidden on admin routes');
});

test('Authz Gap 1.5: requireAdminRole grants access ONLY when role is explicitly "admin"', () => {
  const req: any = {
    user: {
      id: 'usr-admin',
      tenantId: 10,
      role: 'admin',
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  requireAdminRole(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'role === "admin" must be granted access');
  assert.equal(res.statusCode, 200);
});

test('Authz Gap 1.6: requireAdminRole fails-closed (401) when user or tenantId is missing', () => {
  // Completely unauthenticated request
  const reqUnauth: any = {};
  const resUnauth = createMockRes();
  let unauthNextCalled = false;
  requireAdminRole(reqUnauth, resUnauth, () => {
    unauthNextCalled = true;
  });
  assert.equal(unauthNextCalled, false);
  assert.equal(resUnauth.statusCode, 401);

  // Missing tenantId
  const reqNoTenant: any = { user: { role: 'admin' } };
  const resNoTenant = createMockRes();
  let noTenantNextCalled = false;
  requireAdminRole(reqNoTenant, resNoTenant, () => {
    noTenantNextCalled = true;
  });
  assert.equal(noTenantNextCalled, false);
  assert.equal(resNoTenant.statusCode, 401);
});

test('Authz Gap 1.7: Login role mapping logic strictly ensures null/undefined role defaults to non-admin "user"', () => {
  // Simulating the login endpoint logic:
  // const role = dbUser.role === 'admin' ? 'admin' : (dbUser.role || 'user');
  function resolveLoginRole(dbRole: string | null | undefined): string {
    return dbRole === 'admin' ? 'admin' : (dbRole || 'user');
  }

  assert.equal(resolveLoginRole(null), 'user', 'null role must become "user", NEVER "admin"');
  assert.equal(resolveLoginRole(undefined), 'user', 'undefined role must become "user", NEVER "admin"');
  assert.equal(resolveLoginRole(''), 'user', 'empty string role must become "user", NEVER "admin"');
  assert.equal(resolveLoginRole('user'), 'user', '"user" role must remain "user"');
  assert.equal(resolveLoginRole('admin'), 'admin', '"admin" role remains "admin"');
});

// ---------------------------------------------------------------------------
// 2) PNCP CONFIG IDOR & CROSS-TENANT DENIAL TESTS
// ---------------------------------------------------------------------------

test('Authz Gap 2.1: Cross-tenant PNCP read denied (Tenant A cannot read Tenant B via query injection)', async () => {
  const TENANT_A = 1001;
  const TENANT_B = 2002;

  // Pre-seed Tenant B with a certificate
  await updatePncpConfigForTenant(TENANT_B, {
    certificatePath: '/certs/tenant_b_cert.pfx',
    certificatePassword: 'tenant-b-secret-pass',
    isActive: true,
  });

  // Tenant A attempts to read Tenant B's config by supplying ?tenantId=2002
  const reqCrossRead: any = {
    user: { tenantId: TENANT_A, role: 'user' },
    query: { tenantId: String(TENANT_B) },
    body: {},
  };
  const resCrossRead = createMockRes();

  await handleGetPncpConfig(reqCrossRead, resCrossRead);

  assert.equal(
    resCrossRead.statusCode,
    403,
    'Cross-tenant PNCP read MUST be denied with 403 Forbidden'
  );
  assert.ok(
    resCrossRead.body?.error?.includes('cross-tenant'),
    'Error response must state cross-tenant access denied'
  );
});

test('Authz Gap 2.2: Cross-tenant PNCP write denied (Tenant A cannot overwrite Tenant B via body injection)', async () => {
  const TENANT_A = 1001;
  const TENANT_B = 2002;

  // Tenant A attempts to overwrite Tenant B's config by supplying tenantId: 2002 in body
  const reqCrossWrite: any = {
    user: { tenantId: TENANT_A, role: 'user' },
    query: {},
    body: {
      tenantId: TENANT_B,
      certificatePath: '/malicious/cert.pfx',
      certificatePassword: 'hacked-pass',
      isActive: false,
    },
  };
  const resCrossWrite = createMockRes();

  await handlePutPncpConfig(reqCrossWrite, resCrossWrite);

  assert.equal(
    resCrossWrite.statusCode,
    403,
    'Cross-tenant PNCP write MUST be denied with 403 Forbidden'
  );
  assert.ok(
    resCrossWrite.body?.error?.includes('cross-tenant'),
    'Error response must state cross-tenant access denied'
  );

  // Verify Tenant B's config was NOT modified
  const configB = await getPncpConfigForTenant(TENANT_B);
  assert.equal(configB.certificatePath, '/certs/tenant_b_cert.pfx');
  assert.equal(configB.isActive, true);
});

test('Authz Gap 2.3: PNCP GET/PUT fail-closed if tenant authentication is missing or invalid', async () => {
  // 1. Missing user object
  const reqNoUser: any = { query: {}, body: {} };
  const resNoUser = createMockRes();
  await handleGetPncpConfig(reqNoUser, resNoUser);
  assert.equal(resNoUser.statusCode, 401, 'Unauthenticated GET must return 401');

  // 2. User object with null / undefined tenantId
  const reqNullTenant: any = { user: { tenantId: null }, query: {}, body: {} };
  const resNullTenant = createMockRes();
  await handleGetPncpConfig(reqNullTenant, resNullTenant);
  assert.equal(resNullTenant.statusCode, 401, 'User with null tenantId must return 401');

  // 3. User object with non-numeric tenantId
  const reqInvalidTenant: any = { user: { tenantId: 'not-a-number' }, query: {}, body: {} };
  const resInvalidTenant = createMockRes();
  await handlePutPncpConfig(reqInvalidTenant, resInvalidTenant);
  assert.equal(resInvalidTenant.statusCode, 401, 'User with invalid tenantId must return 401');
});

test('Authz Gap 2.4: PNCP always uses req.user.tenantId and isolates tenants cleanly', async () => {
  const TENANT_1 = 501;
  const TENANT_2 = 502;

  // 1. Tenant 1 saves config
  const reqPut1: any = {
    user: { tenantId: TENANT_1, role: 'user' },
    query: {},
    body: {
      certificatePath: '/certs/t1_cert.pfx',
      certificatePassword: 'pass-tenant-1',
      isActive: true,
    },
  };
  const resPut1 = createMockRes();
  await handlePutPncpConfig(reqPut1, resPut1);
  assert.equal(resPut1.statusCode, 200);
  assert.equal(resPut1.body.certificatePath, '/certs/t1_cert.pfx');
  assert.equal(resPut1.body.hasPassword, true);
  assert.equal(resPut1.body.certificatePassword, undefined, 'Password MUST NOT be returned');

  // 2. Tenant 2 saves different config
  const reqPut2: any = {
    user: { tenantId: TENANT_2, role: 'user' },
    query: {},
    body: {
      certificatePath: '/certs/t2_cert.pfx',
      certificatePassword: 'pass-tenant-2',
      isActive: false,
    },
  };
  const resPut2 = createMockRes();
  await handlePutPncpConfig(reqPut2, resPut2);
  assert.equal(resPut2.statusCode, 200);
  assert.equal(resPut2.body.certificatePath, '/certs/t2_cert.pfx');

  // 3. Tenant 1 reads their config without query param
  const reqGet1: any = {
    user: { tenantId: TENANT_1, role: 'user' },
    query: {},
    body: {},
  };
  const resGet1 = createMockRes();
  await handleGetPncpConfig(reqGet1, resGet1);
  assert.equal(resGet1.statusCode, 200);
  assert.equal(resGet1.body.certificatePath, '/certs/t1_cert.pfx');
  assert.equal(resGet1.body.isActive, true);

  // 4. Tenant 2 reads their config without query param
  const reqGet2: any = {
    user: { tenantId: TENANT_2, role: 'user' },
    query: {},
    body: {},
  };
  const resGet2 = createMockRes();
  await handleGetPncpConfig(reqGet2, resGet2);
  assert.equal(resGet2.statusCode, 200);
  assert.equal(resGet2.body.certificatePath, '/certs/t2_cert.pfx');
  assert.equal(resGet2.body.isActive, false);

  // 5. Tenant 1 supplying matching ?tenantId=501 succeeds and uses authenticated tenant
  const reqGet1Matching: any = {
    user: { tenantId: TENANT_1, role: 'user' },
    query: { tenantId: '501' },
    body: {},
  };
  const resGet1Matching = createMockRes();
  await handleGetPncpConfig(reqGet1Matching, resGet1Matching);
  assert.equal(resGet1Matching.statusCode, 200);
  assert.equal(resGet1Matching.body.certificatePath, '/certs/t1_cert.pfx');
});

test('Authz Gap 2.5: validateTenantAccess helper correctly detects mismatch and allows match/omission', () => {
  const AUTH_TENANT = 42;

  // 1. Mismatched query parameter -> rejected
  const resQueryMismatch = createMockRes();
  const reqQueryMismatch: any = { query: { tenantId: '99' }, body: {} };
  const allowedQueryMismatch = validateTenantAccess(reqQueryMismatch, resQueryMismatch, AUTH_TENANT);
  assert.equal(allowedQueryMismatch, false);
  assert.equal(resQueryMismatch.statusCode, 403);

  // 2. Mismatched body parameter -> rejected
  const resBodyMismatch = createMockRes();
  const reqBodyMismatch: any = { query: {}, body: { tenantId: 99 } };
  const allowedBodyMismatch = validateTenantAccess(reqBodyMismatch, resBodyMismatch, AUTH_TENANT);
  assert.equal(allowedBodyMismatch, false);
  assert.equal(resBodyMismatch.statusCode, 403);

  // 3. Matching query parameter -> allowed
  const resQueryMatch = createMockRes();
  const reqQueryMatch: any = { query: { tenantId: '42' }, body: {} };
  const allowedQueryMatch = validateTenantAccess(reqQueryMatch, resQueryMatch, AUTH_TENANT);
  assert.equal(allowedQueryMatch, true);

  // 4. Matching body parameter -> allowed
  const resBodyMatch = createMockRes();
  const reqBodyMatch: any = { query: {}, body: { tenantId: 42 } };
  const allowedBodyMatch = validateTenantAccess(reqBodyMatch, resBodyMatch, AUTH_TENANT);
  assert.equal(allowedBodyMatch, true);

  // 5. Omitted parameters -> allowed
  const resOmitted = createMockRes();
  const reqOmitted: any = { query: {}, body: {} };
  const allowedOmitted = validateTenantAccess(reqOmitted, resOmitted, AUTH_TENANT);
  assert.equal(allowedOmitted, true);
});
