-- Fase B — Tier 1 Compras.gov enriquecimento (issue #79)
-- id_compra em contratacao + catalog_item + pgc_dfd + source_health

ALTER TABLE contratacao
  ADD COLUMN IF NOT EXISTS id_compra text;

CREATE UNIQUE INDEX IF NOT EXISTS contratacao_id_compra_idx
  ON contratacao (id_compra)
  WHERE id_compra IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS status_catalog_family_code_unique
  ON status_catalog (family, code);

CREATE TABLE IF NOT EXISTS catalog_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type text NOT NULL CHECK (catalog_type IN ('CATMAT', 'CATSER')),
  codigo_item integer NOT NULL,
  descricao_item text,
  codigo_grupo integer,
  nome_grupo text,
  codigo_classe integer,
  nome_classe text,
  codigo_pdm integer,
  nome_pdm text,
  codigo_ncm text,
  source_record_id uuid REFERENCES source_record(id),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_type, codigo_item)
);

CREATE TABLE IF NOT EXISTS pgc_dfd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid REFERENCES source_record(id),
  orgao_cnpj text NOT NULL,
  ano integer NOT NULL,
  numero_artifacto integer NOT NULL,
  ordem_dfd integer NOT NULL,
  codigo_uasg text,
  nome_uasg text,
  descricao_objeto_dfd text,
  tipo_item text,
  codigo_item_catalogo integer,
  catalog_type text,
  valor_total_item numeric,
  data_prevista_formalizacao timestamptz,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orgao_cnpj, ano, numero_artifacto, ordem_dfd)
);

-- source_health: tabela já existe no Neon (source + endpoint, last_success/last_failure).
-- recordSourceHealth() em persist.ts usa o schema legado.
