-- Telemetry idempotency audit table (Neon Postgres / Drizzle).
-- Apply on a Neon branch first (docs/NEON_RULES.md).

CREATE TABLE IF NOT EXISTS telemetry_event_idempotency (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  idempotency_key text NOT NULL,
  collection_batch_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL,
  amplitude_event_id text,
  retry_attempt integer NOT NULL DEFAULT 0,
  actor_user_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp,
  CONSTRAINT telemetry_event_idempotency_status_chk
    CHECK (status IN ('pending', 'sending', 'sent', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_event_idempotency_tenant_key_uidx
  ON telemetry_event_idempotency (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS telemetry_event_idempotency_tenant_status_idx
  ON telemetry_event_idempotency (tenant_id, status);
