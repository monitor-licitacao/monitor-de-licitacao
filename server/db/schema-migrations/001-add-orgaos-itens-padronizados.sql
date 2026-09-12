-- Fase 1: Criar tabelas para órgãos e itens padronizados
-- Status: Skeleton - pronto para implementação em Commit 2
--
-- TODO: Revisar constraints e índices antes deploy
-- TODO: Adicionar embedding column em Commit 3 (após pgvector)
-- TODO: Avaliar performance dos índices com dados reais
--
-- Histórico:
-- v1 - Inicial com órgãos e itens_padronizados

-- Extensões necessárias
-- TODO: Verificar se pgvector já está instalado antes de criar
-- CREATE EXTENSION IF NOT EXISTS pgvector;

-- ============================================================================
-- Tabela: orgaos
-- Descrição: Órgãos contratantes do PNCP (~15.000 registros)
-- Chave única: CNPJ (cada órgão tem um CNPJ único)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orgaos (
  -- Identificador único (UUID)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CNPJ do órgão (14 dígitos) - UNIQUE
  cnpj VARCHAR(14) NOT NULL UNIQUE,

  -- Nome completo do órgão
  nome TEXT NOT NULL,

  -- Quantidade total de contratações/licitações conhecidas
  total_contratacoes INTEGER DEFAULT 0,

  -- Unidade Federativa (sigla)
  uf VARCHAR(2),

  -- Tipo de órgão (ex: Ministério, Secretaria, Autarquia, etc)
  tipo_orgao VARCHAR(100),

  -- TODO: Adicionar coluna de embedding em Commit 3
  -- embedding vector(1536) NOT NULL,

  -- Timestamps
  primeira_coleta_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_coleta_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para órgãos
CREATE INDEX idx_orgaos_cnpj ON orgaos(cnpj);
CREATE INDEX idx_orgaos_uf ON orgaos(uf);
CREATE INDEX idx_orgaos_ultima_coleta ON orgaos(ultima_coleta_em DESC);

-- TODO: Índice em embedding (HNSW via pgvector) em Commit 3
-- CREATE INDEX idx_orgaos_embedding ON orgaos USING hnsw(embedding vector_cosine_ops);

-- ============================================================================
-- Tabela: itens_padronizados
-- Descrição: Itens do catálogo CATMAT/CATSER (~5.000 registros)
-- Chave única: Slug (normalizado a partir do nome)
-- ============================================================================
CREATE TABLE IF NOT EXISTS itens_padronizados (
  -- Identificador único (UUID)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Slug único para referência (ex: papel-a4-75g-m2)
  -- Gerado a partir do nome (lowercase, sem acentos, etc)
  slug VARCHAR(255) NOT NULL UNIQUE,

  -- Nome/descrição do item (ex: "Papel A4 75g/m²")
  nome TEXT NOT NULL,

  -- Códigos CATMAT (Catálogo de Materiais) - array
  codigos_catmat VARCHAR[] NOT NULL DEFAULT '{}',

  -- Códigos CATSER (Catálogo de Serviços) - array
  codigos_catser VARCHAR[] NOT NULL DEFAULT '{}',

  -- Descrição detalhada do item
  descricao TEXT,

  -- Unidade de medida padrão (ex: "resma", "unidade", "m²")
  unidade_medida VARCHAR(50),

  -- TODO: Adicionar coluna de embedding em Commit 3
  -- embedding vector(1536) NOT NULL,

  -- Hash do conteúdo para detectar mudanças
  -- TODO: Implementar: SHA256(nome || descricao || codigos)
  hash_conteudo VARCHAR(64),

  -- Timestamps
  primeira_coleta_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_coleta_em TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para itens padronizados
CREATE INDEX idx_itens_padronizados_slug ON itens_padronizados(slug);
CREATE INDEX idx_itens_padronizados_nome ON itens_padronizados USING GIN(to_tsvector('portuguese', nome));
CREATE INDEX idx_itens_padronizados_catmat ON itens_padronizados USING GIN(codigos_catmat);
CREATE INDEX idx_itens_padronizados_catser ON itens_padronizados USING GIN(codigos_catser);
CREATE INDEX idx_itens_padronizados_hash ON itens_padronizados(hash_conteudo);

-- TODO: Índice em embedding (HNSW via pgvector) em Commit 3
-- CREATE INDEX idx_itens_padronizados_embedding ON itens_padronizados USING hnsw(embedding vector_cosine_ops);

-- ============================================================================
-- Tabela: documentos_padronizacao
-- Descrição: Documentos linkados a itens padronizados (PDFs, especificações)
-- Chave estrangeira: item_id -> itens_padronizados.id
-- ============================================================================
CREATE TABLE IF NOT EXISTS documentos_padronizacao (
  -- Identificador único (UUID)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referência ao item padronizado
  item_id UUID NOT NULL,

  -- Título do documento
  titulo TEXT NOT NULL,

  -- URL do documento no gov.br ou local storage
  url TEXT NOT NULL,

  -- Tipo de arquivo (ex: "pdf", "doc", "docx")
  tipo_arquivo VARCHAR(10),

  -- Data de publicação do documento
  data_publicacao DATE,

  -- Hash do conteúdo para deduplicação
  hash_conteudo VARCHAR(64),

  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint de chave estrangeira
  CONSTRAINT fk_documentos_item
    FOREIGN KEY (item_id)
    REFERENCES itens_padronizados(id)
    ON DELETE CASCADE
);

-- Índices para documentos
CREATE INDEX idx_documentos_item_id ON documentos_padronizacao(item_id);
CREATE INDEX idx_documentos_hash ON documentos_padronizacao(hash_conteudo);

-- ============================================================================
-- Tabela: coleta_metadata
-- Descrição: Metadata da última coleta (para tracking e debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS coleta_metadata (
  -- Identificador único
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de coleta (ex: "orgaos", "catalogo")
  tipo_coleta VARCHAR(50) NOT NULL UNIQUE,

  -- Status da última coleta (ex: "sucesso", "erro", "parcial")
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',

  -- Total de itens processados
  total_processados INTEGER DEFAULT 0,

  -- Total de itens inseridos (novo)
  total_inseridos INTEGER DEFAULT 0,

  -- Total de itens atualizados
  total_atualizados INTEGER DEFAULT 0,

  -- Quantidade de erros
  erros INTEGER DEFAULT 0,

  -- Mensagem de erro (se houver)
  mensagem_erro TEXT,

  -- Data e hora da última coleta bem-sucedida
  ultima_coleta_sucesso TIMESTAMPTZ,

  -- Data e hora da tentativa mais recente
  ultima_tentativa TIMESTAMPTZ DEFAULT NOW(),

  -- Próxima data agendada de coleta
  proxima_coleta_agendada TIMESTAMPTZ,

  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para metadata
CREATE INDEX idx_coleta_metadata_tipo ON coleta_metadata(tipo_coleta);
CREATE INDEX idx_coleta_metadata_ultima_coleta ON coleta_metadata(ultima_coleta_sucesso DESC);

-- ============================================================================
-- Função: atualizar_timestamp
-- Descrição: Trigger para atualizar coluna 'atualizado_em' automaticamente
-- ============================================================================
-- TODO: Criar função em trigger_functions.sql separado
-- CREATE OR REPLACE FUNCTION atualizar_timestamp()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.atualizado_em = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- TODO: Criar triggers para cada tabela
-- CREATE TRIGGER trigger_update_orgaos
-- BEFORE UPDATE ON orgaos
-- FOR EACH ROW
-- EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================================
-- Notas Importantes
-- ============================================================================
--
-- 1. Todas as colunas de timestamp usam TIMESTAMPTZ (timezone-aware)
-- 2. UUIDs são usados como PKs (melhor para distribuição que serial)
-- 3. Arrays (codigos_catmat, codigos_catser) usam GIN indices para performance
-- 4. Full-text search (nome) usa índice GIN com português
-- 5. Embeddings serão adicionados em Commit 3 (depois pgvector instalado)
-- 6. ON DELETE CASCADE em documentos_padronizacao garante limpeza
-- 7. UNIQUE constraints em cnpj e slug garantem unicidade
--
-- Performance estimada:
-- - Insert de 15.000 órgãos: ~5-10 segundos
-- - Insert de 5.000 itens: ~2-3 segundos
-- - Lookup by CNPJ: < 1ms (com índice)
-- - Full-text search: ~10-50ms (com GIN index)
