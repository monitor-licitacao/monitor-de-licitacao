-- Issue #82 — Contratação → domínio PNCP só com ID explícito da fonte.
-- Integers = chave publicada. UUIDs = FK resolvida se o registry (#81) já tiver a linha.

ALTER TABLE contratacao
  ADD COLUMN IF NOT EXISTS instrumento_convocatorio_codigo integer,
  ADD COLUMN IF NOT EXISTS amparo_legal_codigo integer,
  ADD COLUMN IF NOT EXISTS pncp_modalidade_id uuid REFERENCES pncp_modalidade(id),
  ADD COLUMN IF NOT EXISTS pncp_instrumento_convocatorio_id uuid REFERENCES pncp_instrumento_convocatorio(id),
  ADD COLUMN IF NOT EXISTS pncp_amparo_legal_id uuid REFERENCES pncp_amparo_legal(id);

CREATE INDEX IF NOT EXISTS contratacao_instrumento_codigo_idx
  ON contratacao (instrumento_convocatorio_codigo)
  WHERE instrumento_convocatorio_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS contratacao_amparo_codigo_idx
  ON contratacao (amparo_legal_codigo)
  WHERE amparo_legal_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS contratacao_pncp_modalidade_fk_idx
  ON contratacao (pncp_modalidade_id)
  WHERE pncp_modalidade_id IS NOT NULL;
