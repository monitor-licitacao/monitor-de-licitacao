-- Tier 1.5 — Preço histórico PNCP (resultados homologados)

ALTER TABLE item
  ADD COLUMN IF NOT EXISTS ncm_nbs text;

-- fornecedor: tabela legada (documento, tipo_documento, razao_social) — não recriar

CREATE TABLE IF NOT EXISTS resultado_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_controle_pncp text NOT NULL,
  numero_item integer NOT NULL,
  sequencial_resultado integer NOT NULL,
  ni_fornecedor text NOT NULL,
  fornecedor_id uuid REFERENCES fornecedor(id),
  valor_unitario_homologado numeric,
  valor_total_homologado numeric,
  quantidade_homologada numeric,
  percentual_desconto numeric,
  data_resultado date,
  situacao_nome text,
  source_record_id uuid REFERENCES source_record(id),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero_controle_pncp, numero_item, ni_fornecedor, sequencial_resultado)
);

CREATE TABLE IF NOT EXISTS price_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_catalogo integer,
  catalog_type text CHECK (catalog_type IS NULL OR catalog_type IN ('CATMAT', 'CATSER')),
  codigo_pdm integer,
  codigo_classe integer,
  codigo_grupo integer,
  ncm_nbs text,
  unidade_canonica text,
  valor_unitario_homologado numeric NOT NULL,
  data_resultado date,
  uf text,
  fonte text NOT NULL DEFAULT 'pncp_resultado',
  source_record_id uuid REFERENCES source_record(id),
  numero_controle_pncp text,
  numero_item integer,
  ni_fornecedor text,
  sequencial_resultado integer,
  resultado_item_id uuid REFERENCES resultado_item(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero_controle_pncp, numero_item, ni_fornecedor, sequencial_resultado)
);

CREATE INDEX IF NOT EXISTS price_observation_catalog_idx
  ON price_observation (codigo_catalogo, catalog_type)
  WHERE codigo_catalogo IS NOT NULL;

CREATE INDEX IF NOT EXISTS price_observation_pdm_idx
  ON price_observation (codigo_pdm)
  WHERE codigo_pdm IS NOT NULL;

CREATE INDEX IF NOT EXISTS price_observation_ncm_idx
  ON price_observation (ncm_nbs, unidade_canonica)
  WHERE ncm_nbs IS NOT NULL;

CREATE INDEX IF NOT EXISTS price_observation_data_idx
  ON price_observation (data_resultado DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS resultado_item_controle_idx
  ON resultado_item (numero_controle_pncp, numero_item);
