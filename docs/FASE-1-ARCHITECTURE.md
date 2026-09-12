# Fase 1: Arquitetura - PNCP + Catálogo + Embeddings

**Status:** Skeleton - Pronto para implementação Semana 1

## Visão Geral

Fase 1 implementa coleta de dados do PNCP (órgãos, editais, catálogo padronizado) e busca semântica com embeddings Gemini.

## Stack Tecnológico

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js ou similar
- **Database:** PostgreSQL 14+
- **Vector DB:** pgvector (PostgreSQL extension)
- **Embeddings:** Google Gemini API (text-embedding-004)
- **Queue:** Bull (Redis) para workers
- **Logging:** Winston

### Ferramentas

- **HTTP Client:** undici ou axios
- **Parser HTML:** cheerio
- **Validação:** zod ou joi
- **Search:** PostgreSQL FTS (BM25) + pgvector (cosine similarity)

## Arquitetura de Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FASE 1 DATA FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. COLETA (Collectors via Bull Queue)
┌─────────────────────┐
│  OrgaosCollector    │ ─┐
│  CatalogoCollector  │ ─┴──> PNCP API / gov.br
└─────────────────────┘

2. ARMAZENAMENTO (PostgreSQL)
┌─────────────────────────────────────────┐
│ orgaos                                   │
│ itens_padronizados                       │
│ documentos_padronizacao                  │
│ (sem embeddings ainda)                   │
└─────────────────────────────────────────┘

3. EMBEDDINGS (Background Job)
┌─────────────────────────────────────────┐
│ GeminiEmbedClient                        │
│ (gerar embeddings para órgãos + itens)  │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ UPDATE orgaos SET embedding = ...        │
│ UPDATE itens_padronizados SET embedding │
└─────────────────────────────────────────┘

4. BUSCA SEMÂNTICA (Runtime)
┌─────────────────────────────────────────┐
│ User Query                               │
│ "papel A4 para impressora"              │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ SemanticSearchService                    │
│ 1. Gerar embedding (Gemini API)          │
│ 2. Busca BM25 (PostgreSQL FTS)          │
│ 3. Busca Semantic (pgvector cosine)     │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ HybridSearcher (RRF)                     │
│ Combinar BM25 + Semantic com ranks       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Resultados Ranqueados                    │
│ [item-1: 0.92, item-2: 0.88, ...]       │
└─────────────────────────────────────────┘
```

## Componentes Principais

### 1. PncpApiClient

**Responsabilidade:** Integração HTTP com API PNCP

**Métodos:**
- `fetchOrgaos()` - Lista todos órgãos (~15k)
- `fetchEditaisPorOrgao(cnpj, filtros)` - Editais de um órgão
- `fetchDetalheEdital(id)` - Detalhes completos
- `fetchSugestoes(termo)` - Autocompletar

**Rate Limiting:** 1000 req/min

### 2. Collectors

#### OrgaosCollector
- Fetch de 15.000 órgãos
- Validação e normalização
- Upsert no banco (idempotent)
- Tempo: ~2-3 minutos

#### CatalogoCollector
- Parser HTML gov.br/pncp/catalogo
- Extração de CATMAT/CATSER
- Download de documentos
- Upsert com deduplicação
- Tempo: ~30-60 minutos (com downloads)

### 3. GeminiEmbedClient

**Responsabilidade:** Gerar embeddings via Gemini API

**Features:**
- Embedding simples (texto → vector 1536-dim)
- Batch processing (múltiplos textos)
- Caching de embeddings
- Rate limiting (1500 req/min)

**Custo:** Free tier (included com Gemini)

### 4. SemanticSearchService

**Responsabilidade:** Busca semântica por similaridade

**Fluxo:**
1. Gerar embedding do termo (via Gemini)
2. Buscar similar items via pgvector (cosine similarity)
3. Aplicar pré-filtros (órgão, NCM, etc)
4. Ranking por score

### 5. HybridSearcher

**Responsabilidade:** Combinar BM25 + Semantic com RRF

**Fórmula RRF:**
```
scoreRRF = peso_bm25 * (1 / (k + rank_bm25))
         + peso_semantic * (1 / (k + rank_semantic))
k = 60
peso_bm25 = 0.5 (configurável)
peso_semantic = 0.5 (configurável)
```

## Database Schema

### Tabelas Principais

```sql
orgaos (
  id UUID PRIMARY KEY,
  cnpj VARCHAR(14) UNIQUE,
  nome TEXT,
  total_contratacoes INTEGER,
  uf, tipo_orgao,
  embedding vector(1536),  -- Commit 3
  timestamps
)

itens_padronizados (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE,
  nome TEXT,
  codigos_catmat VARCHAR[] INDEXED,
  codigos_catser VARCHAR[] INDEXED,
  embedding vector(1536),  -- Commit 3
  hash_conteudo VARCHAR(64),
  timestamps
)

documentos_padronizacao (
  id UUID PRIMARY KEY,
  item_id UUID (FK),
  titulo, url, tipo_arquivo,
  hash_conteudo VARCHAR(64),
  timestamps
)

coleta_metadata (
  tipo_coleta VARCHAR(50) UNIQUE,
  status, total_processados, total_inseridos,
  ultima_coleta_sucesso, proxima_coleta_agendada
)
```

## Índices

### BM25 Full-Text Search

```sql
CREATE INDEX idx_itens_nome
ON itens_padronizados
USING GIN(to_tsvector('portuguese', nome));

-- Query:
SELECT * FROM itens_padronizados
WHERE to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'papel')
ORDER BY ts_rank(...) DESC;
```

### Vector Similarity (pgvector)

```sql
CREATE INDEX idx_orgaos_embedding
ON orgaos
USING hnsw(embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query:
SELECT * FROM orgaos
WHERE embedding IS NOT NULL
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

## Configuração de Ambiente

**Variáveis necessárias (.env):**

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/monitor_licitacao
DB_POOL_SIZE=20

# API PNCP
PNCP_API_BASE_URL=https://pncp.gov.br/api
PNCP_RATE_LIMIT=1000

# Gemini API
GEMINI_API_KEY=your-api-key-here
GEMINI_RATE_LIMIT=1500
GEMINI_EMBEDDING_MODEL=text-embedding-004

# Redis (Bull Queue)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Workers
ORGAOS_COLLECTOR_CRON=0 2 * * *  # 2AM daily
CATALOGO_COLLECTOR_CRON=0 3 * * 0  # 3AM Sunday
```

## Agendamento de Jobs (Bull Queue)

```typescript
// Agendamento automático
queue.add('fetch-orgaos', {}, {
  repeat: { cron: '0 2 * * *' }  // Diariamente 2AM
});

queue.add('fetch-catalogo', {}, {
  repeat: { cron: '0 3 * * 0' }  // Semanalmente Sunday 3AM
});

queue.add('generate-embeddings', {}, {
  repeat: { cron: '0 5 * * *' }  // Diariamente 5AM
});
```

## Fluxo de Implementação

### Commit 1: PncpApiClient + OrgaosCollector
- [ ] Implementar PncpApiClient (todos 4 métodos)
- [ ] Implementar OrgaosCollector (validação + upsert)
- [ ] Testes: 15k órgãos carregados
- [ ] Schema (001 migration)

### Commit 2: CatalogoCollector + Schema Update
- [ ] Implementar CatalogoCollector (parser + download)
- [ ] Validar 5k+ itens no banco
- [ ] Adicionar índices de performance

### Commit 3: Embeddings + Busca Semântica
- [ ] Instalar pgvector
- [ ] Implementar GeminiEmbedClient
- [ ] Executar 002 migration (embeddings columns)
- [ ] Gerar embeddings para 15k+5k items (~3-5 minutos)
- [ ] Implementar SemanticSearchService

### Commit 4: HybridSearch + RRF
- [ ] Implementar HybridSearcher.combineWithRrf()
- [ ] Testar RRF com dados reais
- [ ] Otimizar pesos (BM25 vs Semantic)

### Commit 5: API Endpoints + Tests
- [ ] Endpoint GET /api/search/hybrid
- [ ] Endpoint GET /api/search/semantic
- [ ] Endpoint GET /api/items/{id}
- [ ] Tests de integração

## Performance Targets

| Operação | Target | Notas |
|----------|--------|-------|
| Fetch de órgãos | <3 min | 15k items, com rate limit |
| Fetch catálogo | <60 min | Inclui downloads |
| Gerar embeddings | <5 min | 20k items batch |
| Semantic search | <200ms | Por query |
| BM25 search | <50ms | Por query |
| Hybrid search | <300ms | Combinado |

## Segurança e Validação

- [ ] Validar inputs com zod/joi
- [ ] Rate limiting em endpoints públicos
- [ ] Auth via JWT (se aplicável)
- [ ] HTTPS/TLS obrigatório
- [ ] Sanitizar queries SQL (usar prepared statements)
- [ ] Hash de documentos para deduplicação
- [ ] Backup automático de dados

## Monitoramento

- [ ] Logs estruturados (JSON)
- [ ] Métricas de collectors (sucesso, tempo, erros)
- [ ] Alertas de falha (email, Slack)
- [ ] Dashboard de status de coleta
- [ ] Rastreamento de custos Gemini API

## Próximos Passos

1. Revisar tipos e interfaces (1-2 horas)
2. Implementar Commit 1 (PncpApiClient + OrgaosCollector)
3. Testar com dados reais do PNCP
4. Proceder com Commits 2-5 iterativamente

## Links de Referência

- [PNCP-API-INTEGRATION.md](./PNCP-API-INTEGRATION.md)
- [CATALOGO-PADRONIZACAO.md](./CATALOGO-PADRONIZACAO.md)
- [SEMANTIC-SEARCH-DESIGN.md](./SEMANTIC-SEARCH-DESIGN.md)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
