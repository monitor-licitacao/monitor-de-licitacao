-- Audit trail + persisted rate-limit counters (Neon Postgres / Drizzle).
-- Apply on a Neon branch first (docs/NEON_RULES.md).

CREATE TABLE IF NOT EXISTS audit_log (
  id serial PRIMARY KEY,
  tenant_id integer REFERENCES tenants(id),
  action text NOT NULL,
  actor_user_id text,
  resource_type text,
  resource_id text,
  metadata jsonb,
  ip_address text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON audit_log (action);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  bucket text NOT NULL,
  identifier text NOT NULL DEFAULT 'default',
  window_start timestamp NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_counters_tenant_bucket_window_uidx
  ON rate_limit_counters (tenant_id, bucket, identifier, window_start);

CREATE INDEX IF NOT EXISTS rate_limit_counters_tenant_bucket_idx
  ON rate_limit_counters (tenant_id, bucket);
