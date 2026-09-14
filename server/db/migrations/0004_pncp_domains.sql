-- Domain Registry PNCP (issue #81)
-- Tabelas oficiais de domínio. Inativo != DELETE. Datas da fonte ≠ datas internas.

CREATE TABLE IF NOT EXISTS pncp_modalidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pncp_id integer NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  irp boolean,
  status_ativo boolean NOT NULL DEFAULT true,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw_json jsonb,
  payload_hash text,
  source_record_id uuid REFERENCES source_record(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pncp_instrumento_convocatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pncp_id integer NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  obrigatoriedade_abertura_proposta text,
  obrigatoriedade_encerramento_proposta text,
  status_ativo boolean NOT NULL DEFAULT true,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw_json jsonb,
  payload_hash text,
  source_record_id uuid REFERENCES source_record(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pncp_tipo_amparo_legal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pncp_id integer NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  status_ativo boolean NOT NULL DEFAULT true,
  raw_json jsonb,
  payload_hash text,
  source_record_id uuid REFERENCES source_record(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pncp_amparo_legal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pncp_id integer NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  tipo_amparo_legal_id uuid REFERENCES pncp_tipo_amparo_legal(id),
  status_ativo boolean NOT NULL DEFAULT true,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  raw_json jsonb,
  payload_hash text,
  source_record_id uuid REFERENCES source_record(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pncp_modalidade_status_idx
  ON pncp_modalidade (status_ativo);

CREATE INDEX IF NOT EXISTS pncp_instrumento_status_idx
  ON pncp_instrumento_convocatorio (status_ativo);

CREATE INDEX IF NOT EXISTS pncp_amparo_status_idx
  ON pncp_amparo_legal (status_ativo);

CREATE INDEX IF NOT EXISTS pncp_amparo_tipo_idx
  ON pncp_amparo_legal (tipo_amparo_legal_id);
