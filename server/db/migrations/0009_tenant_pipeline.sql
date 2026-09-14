-- Pipeline de Participação (Minhas Licitações — Licinexus clone)

CREATE TABLE IF NOT EXISTS tenant_pipeline_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contratacao_id uuid,
  numero_controle_pncp text NOT NULL,
  portal text NOT NULL DEFAULT 'PNCP',
  orgao_cnpj text NOT NULL CHECK (char_length(orgao_cnpj) = 14),
  orgao_razao_social text,
  objeto_compra text,
  modalidade_nome text,
  valor_total_estimado numeric,
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz,
  uf_sigla text,
  status text NOT NULL DEFAULT 'SELECIONADA' CHECK (
    status IN (
      'SELECIONADA',
      'ANALISE',
      'RECEBENDO_PROPOSTA',
      'FASE_LANCE',
      'SESSAO_PUBLICA',
      'RECURSO',
      'HOMOLOGADA',
      'CANCELADA'
    )
  ),
  vencedor boolean NOT NULL DEFAULT false,
  arquivada boolean NOT NULL DEFAULT false,
  source_record_id uuid REFERENCES source_record(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, numero_controle_pncp)
);

CREATE INDEX IF NOT EXISTS tenant_pipeline_item_tenant_idx
  ON tenant_pipeline_item (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_pipeline_item_status_idx
  ON tenant_pipeline_item (tenant_id, status);

CREATE INDEX IF NOT EXISTS tenant_pipeline_item_arquivada_idx
  ON tenant_pipeline_item (tenant_id, arquivada);

CREATE INDEX IF NOT EXISTS tenant_pipeline_item_encerramento_idx
  ON tenant_pipeline_item (data_encerramento_proposta);
