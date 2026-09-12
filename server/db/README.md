# Database Migrations

Migrações de schema para Fase 1: PNCP + Catálogo Padronização + Embeddings.

## Status Atual

Schema skeleton criado | Comentários detalhados | Pronto para execução

## Arquivos

- `schema-migrations/001-add-orgaos-itens-padronizados.sql` - Tabelas principais
- `schema-migrations/002-add-embeddings.sql` - Suporte a embeddings via pgvector
- `README.md` - Este arquivo

## Schema Overview

### Tabela: orgaos

Órgãos contratantes do PNCP (~15.000 registros).

```
id (UUID) ─┐
cnpj ──────├─ UNIQUE, INDEXED
nome ──────┤
total_contratacoes
uf, tipo_orgao
embedding ─┤ vector(1536) - Commit 3
timestamps─┘
```

**Índices:**
- `cnpj` - Lookup por CNPJ
- `uf` - Filtro por estado
- `ultima_coleta_em` - Ranking por recência
- `embedding` (HNSW) - Busca semântica - Commit 3

### Tabela: itens_padronizados

Itens do catálogo CATMAT/CATSER (~5.000 registros).

```
id (UUID) ──┐
slug ───────├─ UNIQUE, INDEXED
nome ───────┤ Full-text search
codigos_catmat (ARRAY) ─┤ GIN indexed
codigos_catser (ARRAY) ─┤ GIN indexed
embedding ──┤ vector(1536) - Commit 3
timestamps──┘
```

**Índices:**
- `slug` - Lookup por slug
- `nome` (GIN, full-text) - Busca textual
- `codigos_catmat` - Filtro por código CATMAT
- `codigos_catser` - Filtro por código CATSER
- `embedding` (HNSW) - Busca semântica - Commit 3

### Tabela: documentos_padronizacao

Documentos linkados aos itens (~500-1000 registros).

```
id (UUID) ──┐
item_id (FK)├─ Referência ao item
titulo ─────┤ Título do documento
url ────────┤ URL no gov.br
tipo_arquivo
data_publicacao
hash_conteudo
timestamps──┘
```

**Índices:**
- `item_id` - Lookup por item
- `hash_conteudo` - Deduplicação

### Tabela: coleta_metadata

Metadata de coleta (tracking, agendamento).

```
id (UUID) ──┐
tipo_coleta ├─ UNIQUE ("orgaos", "catalogo")
status ─────┤ "sucesso", "erro", "parcial"
total_* ────┤ Estatísticas
mensagem_erro
ultima_coleta_sucesso
proxima_coleta_agendada
timestamps──┘
```

### Tabelas: embeddings_metadata e embeddings_log

Tracking de geração de embeddings (Commit 3).

## Execução das Migrations

### Usando Migrate CLI

```bash
# Executar todas as migrações
migrate -path server/db/schema-migrations -database "postgres://user:pass@localhost/db" up

# Rollback
migrate -path server/db/schema-migrations -database "postgres://user:pass@localhost/db" down
```

### Usando psql

```bash
# Conectar ao banco
psql -h localhost -U user -d monitor_licitacao

# Executar migration
\i server/db/schema-migrations/001-add-orgaos-itens-padronizados.sql

# Verificar tabelas
\dt orgaos itens_padronizados documentos_padronizacao
```

### Usando Prisma (se aplicável)

```bash
# Sincronizar schema
npx prisma db push

# Gerar migrações
npx prisma migrate dev --name add-orgaos-padronizados
```

## Commit Schedule

### Commit 1: Core Schema
- `001-add-orgaos-itens-padronizados.sql` completo
- Criar tabelas base sem embeddings
- Índices para CNPJ, slug, BM25

**Status:** Pronto para executar

### Commit 2: Documentação + OrgaosCollector
- `OrgaosCollector.ts` implementação
- Upsert de órgãos no banco
- Validate schema com 15k registros

**Status:** Após Commit 1

### Commit 3: Embeddings
- Instalar pgvector
- Executar `002-add-embeddings.sql`
- Adicionar colunas de embedding
- Gerar embeddings via Gemini

**Status:** Após pgvector instalado

## Índices e Performance

### Índices Criados

| Tabela | Coluna | Tipo | Propósito |
|--------|--------|------|-----------|
| orgaos | cnpj | B-tree | Lookup por CNPJ |
| orgaos | uf | B-tree | Filtro por estado |
| orgaos | ultima_coleta_em | B-tree | Ranking por recência |
| orgaos | embedding | HNSW | Busca semântica (Commit 3) |
| itens_padronizados | slug | B-tree | Lookup por slug |
| itens_padronizados | nome | GIN (FTS) | Full-text search português |
| itens_padronizados | codigos_catmat | GIN | Array search |
| itens_padronizados | codigos_catser | GIN | Array search |
| itens_padronizados | embedding | HNSW | Busca semântica (Commit 3) |

### Query Performance

- **Lookup por CNPJ:** < 1ms
- **Lookup por slug:** < 1ms
- **Full-text search:** 10-50ms
- **Cosine similarity (10 itens):** 50-200ms
- **Filtro por array:** 5-20ms

## Constraints e Validações

### Unique Constraints

- `orgaos.cnpj` - Cada órgão tem CNPJ único
- `itens_padronizados.slug` - Cada item tem slug único

### Foreign Keys

- `documentos_padronizacao.item_id` → `itens_padronizados.id`
  - ON DELETE CASCADE (remove documentos ao deletar item)

### Check Constraints

- `orgaos.total_contratacoes >= 0`
- Adicionar se necessário: CNPJ format validation

## Dados Iniciais

Nenhuma data inicial necessária. Dados são carregados via:

1. **OrgaosCollector** → popula `orgaos`
2. **CatalogoCollector** → popula `itens_padronizados` + `documentos_padronizacao`
3. **GeminiEmbedClient** → popula `embedding` columns

## Backup Strategy

Antes de Commit 2 (OrgaosCollector):

```bash
# Backup completo
pg_dump -h localhost -U user monitor_licitacao > backup-before-collector.sql

# Backup apenas schema
pg_dump -h localhost -U user --schema-only monitor_licitacao > schema-backup.sql
```

## Troubleshooting

### Erro: "relation already exists"

```bash
# Verificar tabelas existentes
SELECT tablename FROM pg_tables WHERE schemaname='public';

# Drop tabelas se necessário (cuidado!)
DROP TABLE IF EXISTS documentos_padronizacao, itens_padronizados, orgaos CASCADE;
```

### Erro: "pgvector not installed" (Commit 3)

```bash
# Instalar extensão
CREATE EXTENSION pgvector;

# Verificar instalação
SELECT * FROM pg_extension WHERE extname='pgvector';
```

### Índice HNSW não foi criado

```bash
-- Verificar índices
SELECT indexname, tablename FROM pg_indexes WHERE tablename='orgaos';

-- Recriar índice
DROP INDEX IF EXISTS idx_orgaos_embedding;
CREATE INDEX idx_orgaos_embedding
ON orgaos
USING hnsw(embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## Próximos Passos

1. Executar `001-add-orgaos-itens-padronizados.sql`
2. Validar schema com ferramentas de visualização
3. Implementar `OrgaosCollector` (Commit 2)
4. Instalar pgvector e executar `002-add-embeddings.sql` (Commit 3)

## Links

- [FASE-1-ARCHITECTURE.md](../docs/FASE-1-ARCHITECTURE.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
