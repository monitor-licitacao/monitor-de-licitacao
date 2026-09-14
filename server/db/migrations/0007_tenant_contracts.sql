-- Painel de Contratos (tenant portfolio) — issue Licinexus clone

CREATE TABLE IF NOT EXISTS tenant_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cnpj text NOT NULL CHECK (char_length(cnpj) = 14),
  razao_social text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cnpj)
);

CREATE INDEX IF NOT EXISTS tenant_party_tenant_idx ON tenant_party (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_party_cnpj_idx ON tenant_party (cnpj);

CREATE TABLE IF NOT EXISTS tenant_contract (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('contrato', 'ata')),
  origem text NOT NULL CHECK (origem IN ('pncp', 'manual')),
  numero_controle_pncp text,
  numero_contrato_empenho text,
  contratacao_id uuid,
  orgao_cnpj text NOT NULL,
  orgao_razao_social text,
  uf_sigla text,
  municipio_nome text,
  fornecedor_cnpj text NOT NULL,
  fornecedor_razao_social text,
  objeto text,
  valor_global numeric,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  indice_reajuste text,
  valor_reajustado numeric,
  reajustado_em timestamptz,
  source_record_id uuid REFERENCES source_record(id),
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_contract_pncp_unique
  ON tenant_contract (tenant_id, numero_controle_pncp)
  WHERE numero_controle_pncp IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_contract_manual_unique
  ON tenant_contract (tenant_id, orgao_cnpj, numero_contrato_empenho)
  WHERE origem = 'manual' AND numero_contrato_empenho IS NOT NULL;

CREATE INDEX IF NOT EXISTS tenant_contract_tenant_idx ON tenant_contract (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_contract_fornecedor_idx ON tenant_contract (fornecedor_cnpj);
CREATE INDEX IF NOT EXISTS tenant_contract_vigencia_idx ON tenant_contract (data_vigencia_fim);
CREATE INDEX IF NOT EXISTS tenant_contract_tipo_idx ON tenant_contract (tenant_id, tipo);

CREATE TABLE IF NOT EXISTS tenant_contract_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_contract_id uuid NOT NULL REFERENCES tenant_contract(id) ON DELETE CASCADE,
  descricao text,
  quantidade numeric,
  unidade_medida text,
  unidade_canonica text,
  valor_unitario numeric,
  valor_total numeric,
  catalog_type text CHECK (catalog_type IS NULL OR catalog_type IN ('CATMAT', 'CATSER')),
  catalogo_codigo_item integer,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_contract_item_contract_idx
  ON tenant_contract_item (tenant_contract_id);

CREATE TABLE IF NOT EXISTS tenant_contract_oficio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_contract_id uuid NOT NULL REFERENCES tenant_contract(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('renovacao', 'reajuste', 'encerramento')),
  assunto text NOT NULL,
  corpo text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'gerado', 'enviado')),
  email_orgao text,
  email_cliente text,
  enviado_em timestamptz,
  pdf_storage_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_contract_oficio_contract_idx
  ON tenant_contract_oficio (tenant_contract_id);

-- Seed CNPJ primário tenant 1 (Vectra Cargo — ajuste se necessário)
INSERT INTO tenant_party (tenant_id, cnpj, razao_social, is_primary)
SELECT 1, '62188748000117', 'Vectra Cargo', true
WHERE EXISTS (SELECT 1 FROM tenants WHERE id = 1)
ON CONFLICT (tenant_id, cnpj) DO NOTHING;
