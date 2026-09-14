-- Catálogo de eventos de histórico de contratação + persistência por contratação

CREATE TABLE IF NOT EXISTS contratacao_event_catalog (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  pncp_documento_tipo_id integer,
  implica_vigencia text NOT NULL DEFAULT 'nenhuma'
    CHECK (implica_vigencia IN ('nenhuma', 'contrato_pncp', 'ata_pncp')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratacao_id uuid NOT NULL REFERENCES contratacao(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES contratacao_event_catalog(code),
  occurred_at timestamptz NOT NULL,
  descricao text,
  responsavel text,
  source text NOT NULL CHECK (source IN ('pncp_ingest', 'pncp_sync', 'derived')),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contratacao_id, event_code, occurred_at)
);

CREATE INDEX IF NOT EXISTS contratacao_historico_contratacao_idx
  ON contratacao_historico (contratacao_id, occurred_at DESC);
