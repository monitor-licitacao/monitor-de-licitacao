-- Cadastro local de órgãos para o modal de contrato manual (#88).
-- Registry-first: não depende de BrasilAPI para CNPJ já visto em contratação.

CREATE TABLE IF NOT EXISTS orgao_registry (
  cnpj text PRIMARY KEY CHECK (char_length(cnpj) = 14),
  razao_social text NOT NULL,
  uf_sigla text,
  municipio_nome text,
  fonte text NOT NULL CHECK (fonte IN ('contratacao', 'brasilapi', 'receitaws', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO orgao_registry (cnpj, razao_social, uf_sigla, municipio_nome, fonte)
SELECT DISTINCT ON (c.cnpj_orgao)
  c.cnpj_orgao,
  COALESCE(
    NULLIF(TRIM(c.raw_json->'unidadeOrgao'->>'nomeUnidade'), ''),
    NULLIF(TRIM(CONCAT(c.municipio, ' ', c.uf)), ''),
    'Órgão contratante'
  ),
  c.uf,
  c.municipio,
  'contratacao'
FROM contratacao c
WHERE char_length(c.cnpj_orgao) = 14
ORDER BY c.cnpj_orgao, c.data_publicacao DESC NULLS LAST
ON CONFLICT (cnpj) DO NOTHING;
