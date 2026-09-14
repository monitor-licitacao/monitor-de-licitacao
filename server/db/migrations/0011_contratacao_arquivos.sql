CREATE TABLE IF NOT EXISTS contratacao_arquivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratacao_id uuid NOT NULL REFERENCES contratacao(id) ON DELETE CASCADE,
  sequencial_documento integer NOT NULL,
  titulo text NOT NULL,
  tipo_documento_id integer,
  tipo_documento_nome text,
  tipo_documento_descricao text,
  url_download text NOT NULL,
  status_ativo boolean NOT NULL DEFAULT true,
  data_publicacao_pncp timestamptz,
  source text NOT NULL DEFAULT 'pncp_sync'
    CHECK (source IN ('pncp_sync', 'pncp_ingest')),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contratacao_id, sequencial_documento)
);

CREATE INDEX IF NOT EXISTS contratacao_arquivo_contratacao_idx
  ON contratacao_arquivo (contratacao_id, sequencial_documento);
