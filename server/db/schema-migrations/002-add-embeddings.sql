-- Fase 1: Adicionar suporte a embeddings via pgvector
-- Status: Skeleton - pronto para implementação em Commit 3
--
-- TODO: Instalar extensão pgvector antes de rodar
-- TODO: Revisar dimensão de embedding (1536 para Gemini)
-- TODO: Testar performance de índices HNSW vs IVFFlat
-- TODO: Avaliar storage (vector toma ~6KB por embedding)
--
-- Histórico:
-- v1 - Adicionar colunas de embedding e índices

-- ============================================================================
-- Pré-requisito: pgvector extension
-- ============================================================================
-- Instalar via: CREATE EXTENSION IF NOT EXISTS pgvector;
-- Ou via comando: CREATE EXTENSION pgvector;

-- ============================================================================
-- Adicionar coluna de embedding à tabela: orgaos
-- ============================================================================
-- TODO: Descomentar após pgvector instalado
-- ALTER TABLE orgaos
-- ADD COLUMN embedding vector(1536);

-- Criar índice HNSW para busca de similaridade rápida
-- HNSW = Hierarchical Navigable Small Worlds (mais eficiente que IVFFlat)
-- TODO: Descomentar após adicionar coluna
-- CREATE INDEX idx_orgaos_embedding
-- ON orgaos
-- USING hnsw(embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Adicionar coluna de embedding à tabela: itens_padronizados
-- ============================================================================
-- TODO: Descomentar após pgvector instalado
-- ALTER TABLE itens_padronizados
-- ADD COLUMN embedding vector(1536);

-- Criar índice HNSW para busca de similaridade rápida
-- TODO: Descomentar após adicionar coluna
-- CREATE INDEX idx_itens_padronizados_embedding
-- ON itens_padronizados
-- USING hnsw(embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Tabela: embeddings_metadata
-- Descrição: Tracking de qual versão de embeddings foi gerada
-- ============================================================================
-- Necessário para saber quando re-gerar embeddings se mudar modelo
CREATE TABLE IF NOT EXISTS embeddings_metadata (
  -- Identificador único
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tabela que contém os embeddings (ex: "orgaos", "itens_padronizados")
  tabela_nome VARCHAR(50) NOT NULL UNIQUE,

  -- Modelo usado para gerar embeddings
  modelo_gemini VARCHAR(50) NOT NULL DEFAULT 'text-embedding-004',

  -- Versão do modelo
  modelo_versao VARCHAR(20) NOT NULL DEFAULT '1',

  -- Dimensão dos embeddings
  dimensao_embedding INTEGER NOT NULL DEFAULT 1536,

  -- Total de embeddings gerados
  total_embeddings INTEGER DEFAULT 0,

  -- Total de embeddings ainda pendentes
  total_pendentes INTEGER DEFAULT 0,

  -- Data da última geração
  ultima_geracao TIMESTAMPTZ,

  -- Taxa de erro na última tentativa (0-100%)
  taxa_erro_ultima_geracao DECIMAL(5, 2) DEFAULT 0,

  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_embeddings_metadata_tabela ON embeddings_metadata(tabela_nome);

-- ============================================================================
-- Tabela: embeddings_log
-- Descrição: Log de operações de embedding para debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS embeddings_log (
  -- Identificador único
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tabela origem (ex: "orgaos", "itens_padronizados")
  tabela_nome VARCHAR(50) NOT NULL,

  -- ID do item em embeddings_log
  item_id UUID NOT NULL,

  -- Status da geração (ex: "pendente", "processado", "erro")
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',

  -- Mensagem de erro (se houver)
  mensagem_erro TEXT,

  -- Número de tentativas
  tentativas INTEGER DEFAULT 0,

  -- Data da última tentativa
  ultima_tentativa TIMESTAMPTZ,

  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_embeddings_log_tabela_status ON embeddings_log(tabela_nome, status);
CREATE INDEX idx_embeddings_log_status ON embeddings_log(status);
CREATE INDEX idx_embeddings_log_ultima_tentativa ON embeddings_log(ultima_tentativa DESC);

-- ============================================================================
-- View: v_embeddings_pendentes
-- Descrição: View para listar embeddings ainda não gerados
-- ============================================================================
-- TODO: Criar view que lista items com embedding NULL
-- SELECT o.id, o.cnpj, o.nome, 'orgaos' as tabela
-- FROM orgaos o
-- WHERE o.embedding IS NULL
-- UNION ALL
-- SELECT i.id, i.slug, i.nome, 'itens_padronizados' as tabela
-- FROM itens_padronizados i
-- WHERE i.embedding IS NULL
-- ORDER BY criado_em DESC;

-- ============================================================================
-- Função: calcular_similaridade_cosine
-- Descrição: Função SQL para calcular similaridade cosine entre dois vetores
-- ============================================================================
-- TODO: Criar função customizada se pgvector não for suficiente
-- CREATE OR REPLACE FUNCTION calcular_similaridade_cosine(
--   v1 vector(1536),
--   v2 vector(1536)
-- )
-- RETURNS DECIMAL AS $$
-- BEGIN
--   RETURN (v1 <=> v2)::decimal;
-- END;
-- $$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Query Examples (após embeddings gerados)
-- ============================================================================
--
-- 1. Busca por similaridade cosine (Top-10)
-- ============================================================================
-- SELECT id, cnpj, nome, (embedding <=> query_embedding) AS distancia
-- FROM orgaos
-- WHERE embedding IS NOT NULL
-- ORDER BY distancia ASC
-- LIMIT 10;
--
-- Nota: <=> é operador de cosine distance do pgvector
--       (0 = idêntico, 2 = totalmente diferente)
--
-- 2. Busca com threshold de similaridade
-- ============================================================================
-- SELECT id, nome, (1 - (embedding <=> query_embedding)) AS similaridade
-- FROM itens_padronizados
-- WHERE embedding IS NOT NULL
--   AND (1 - (embedding <=> query_embedding)) > 0.7
-- ORDER BY similaridade DESC;
--
-- 3. Busca com pré-filtro (órgão) + similaridade
-- ============================================================================
-- SELECT o.id, o.cnpj, o.nome
-- FROM orgaos o
-- WHERE o.uf = 'SP'
--   AND o.embedding IS NOT NULL
-- ORDER BY o.embedding <=> query_embedding
-- LIMIT 20;
--
-- 4. Combinação BM25 + Semantic (via RRF em aplicação)
-- ============================================================================
-- -- BM25 score
-- SELECT id, nome, ts_rank(to_tsvector('portuguese', nome), query) as bm25_score
-- FROM itens_padronizados
-- WHERE to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'paper:*')
-- ORDER BY bm25_score DESC
-- LIMIT 100;
--
-- -- Semantic score (depois combina em app via RRF)
-- SELECT id, nome, (embedding <=> query_embedding) as semantic_score
-- FROM itens_padronizados
-- ORDER BY semantic_score ASC
-- LIMIT 100;

-- ============================================================================
-- Performance Notes
-- ============================================================================
--
-- Vector Size:
-- - 1536 dimensions × 4 bytes (float32) = 6.144 KB por embedding
-- - 15.000 órgãos × 6KB = 92 MB
-- - 5.000 itens × 6KB = 30 MB
-- Total: ~120 MB adicional
--
-- Index Size (HNSW):
-- - Adiciona ~50% ao tamanho dos dados
-- - 15.000 órgãos: ~450 MB total com índice
--
-- Query Performance:
-- - HNSW busca: ~50-200ms (depende de dados)
-- - BM25 busca: ~10-50ms
-- - Combinação RRF: ~150-300ms
--
-- Recomendações:
-- - Usar HNSW para busca de similaridade rápida
-- - Tunear m=16, ef_construction=64 se performance for problema
-- - Monitorar disk space se crescer além de 100.000 items
-- - Considerar sharding se > 1 milhão de items

-- ============================================================================
-- Rollback
-- ============================================================================
-- Se precisar reverter (rollback) esta migration:
--
-- DROP INDEX IF EXISTS idx_itens_padronizados_embedding;
-- DROP INDEX IF EXISTS idx_orgaos_embedding;
-- ALTER TABLE itens_padronizados DROP COLUMN embedding;
-- ALTER TABLE orgaos DROP COLUMN embedding;
-- DROP TABLE embeddings_log;
-- DROP TABLE embeddings_metadata;
