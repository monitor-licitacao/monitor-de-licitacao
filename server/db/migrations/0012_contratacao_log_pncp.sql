CREATE TABLE IF NOT EXISTS contratacao_log_pncp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratacao_id uuid NOT NULL REFERENCES contratacao(id) ON DELETE CASCADE,
  tipo_log_nome text NOT NULL,
  categoria_nome text NOT NULL,
  evento_label text NOT NULL,
  documento_titulo text,
  documento_tipo text,
  documento_sequencial integer,
  item_numero integer,
  justificativa text,
  usuario_nome text,
  occurred_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'pncp_sync'
    CHECK (source IN ('pncp_sync', 'pncp_ingest')),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contratacao_log_pncp_dedupe_idx
  ON contratacao_log_pncp (
    contratacao_id,
    occurred_at,
    categoria_nome,
    COALESCE(documento_sequencial, -1),
    COALESCE(item_numero, -1)
  );

CREATE INDEX IF NOT EXISTS contratacao_log_pncp_contratacao_idx
  ON contratacao_log_pncp (contratacao_id, occurred_at DESC);
