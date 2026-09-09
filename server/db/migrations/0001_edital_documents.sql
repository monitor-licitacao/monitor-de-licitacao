-- Additive only. Do not DROP or rename editais.s3_storage_key.
-- Apply on a Neon branch first (docs/NEON_RULES.md). Do not treat fixture
-- s3://editais-vault/... keys as stored vault objects.

CREATE UNIQUE INDEX IF NOT EXISTS editais_id_tenant_uidx
  ON editais (id, tenant_id);

CREATE TABLE IF NOT EXISTS edital_documents (
  id text PRIMARY KEY,
  edital_id text NOT NULL,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  storage_provider text NOT NULL,
  storage_key text NOT NULL,
  sha256_hash text NOT NULL,
  file_size_bytes integer,
  content_type text DEFAULT 'application/pdf',
  source_url text,
  captured_at timestamp,
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  error_message text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  uploaded_by text,
  CONSTRAINT edital_documents_edital_tenant_fk
    FOREIGN KEY (edital_id, tenant_id) REFERENCES editais (id, tenant_id),
  CONSTRAINT edital_documents_status_chk
    CHECK (status IN ('pending', 'uploading', 'stored', 'failed')),
  CONSTRAINT edital_documents_provider_chk
    CHECK (storage_provider IN ('gcs', 's3_legacy'))
);

CREATE UNIQUE INDEX IF NOT EXISTS edital_documents_edital_sha256_uidx
  ON edital_documents (edital_id, sha256_hash);

CREATE UNIQUE INDEX IF NOT EXISTS edital_documents_inflight_edital_uidx
  ON edital_documents (edital_id)
  WHERE status IN ('pending', 'uploading');

CREATE INDEX IF NOT EXISTS edital_documents_tenant_edital_idx
  ON edital_documents (tenant_id, edital_id);

CREATE INDEX IF NOT EXISTS edital_documents_tenant_status_idx
  ON edital_documents (tenant_id, status);
