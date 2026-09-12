# Fase 1: PNCP + Catálogo Padronização + Embeddings

**Status:** ✅ Skeleton Completo - Pronto para Implementação  
**Branch:** `feature/pncp-catalog-embeddings`  
**Data de Criação:** 2025-09-12

## Resumo

Fase 1 implementa infraestrutura para coleta de dados do PNCP (Portal Nacional de Contratações Públicas) e busca semântica com embeddings Gemini.

### Deliverables

- ✅ 13 arquivos skeleton TypeScript com tipos completos
- ✅ 4 documentos de design arquitetural
- ✅ 2 SQL migrations skeleton
- ✅ ~500 linhas de documentação + tipos
- ✅ Estrutura pronta para implementação iterativa

## Estrutura de Diretórios

```
server/
├── lib/
│   ├── connectors/
│   │   ├── pncp/
│   │   │   ├── PncpApiClient.ts        (4 endpoints PNCP)
│   │   │   ├── types.ts                (tipos completos)
│   │   │   └── README.md
│   │   └── search/
│   │       ├── SemanticSearchService.ts (busca semântica)
│   │       ├── HybridSearcher.ts        (RRF fusion)
│   │       └── README.md
│   ├── embeddings/
│   │   ├── GeminiEmbedClient.ts         (Gemini API)
│   │   └── README.md
│   └── ...
├── workers/
│   ├── OrgaosCollector.ts              (15k órgãos)
│   ├── CatalogoCollector.ts            (5k itens padronizados)
│   └── README.md
└── db/
    ├── schema-migrations/
    │   ├── 001-add-orgaos-itens-padronizados.sql
    │   └── 002-add-embeddings.sql
    └── README.md

docs/
├── FASE-1-ARCHITECTURE.md              (visão geral + stack)
├── PNCP-API-INTEGRATION.md             (4 endpoints documentados)
├── CATALOGO-PADRONIZACAO.md            (parser HTML + CATMAT)
└── SEMANTIC-SEARCH-DESIGN.md           (BM25 + Semantic + RRF)
```

## Componentes Principais

### 1. PncpApiClient

**Arquivo:** `server/lib/connectors/pncp/PncpApiClient.ts`

Integração com API PNCP:
- `fetchOrgaos()` - Retorna ~15.000 órgãos
- `fetchEditaisPorOrgao(cnpj)` - Editais de um órgão
- `fetchDetalheEdital(id)` - Detalhes completos
- `fetchSugestoes(termo)` - Autocompletar

**Rate Limit:** 1000 req/min

### 2. Collectors

#### OrgaosCollector
**Arquivo:** `server/workers/OrgaosCollector.ts`
- Coleta 15.000 órgãos via API PNCP
- Validação e normalização de dados
- Upsert idempotente no banco
- Tempo: ~2-3 minutos

#### CatalogoCollector
**Arquivo:** `server/workers/CatalogoCollector.ts`
- Parser HTML gov.br/pncp/catalogo
- Extração de CATMAT/CATSER (~5.000 itens)
- Download de documentos de padronização
- Deduplicação por hash de conteúdo
- Tempo: ~30-60 minutos (com downloads)

### 3. GeminiEmbedClient

**Arquivo:** `server/lib/embeddings/GeminiEmbedClient.ts`

Gera embeddings via Google Gemini API:
- `gerarEmbedding(texto)` - Embedding simples (1536-dim)
- `gerarEmbeddingsBatch(textos[])` - Batch processing
- `calcularSimilaridade(emb1, emb2)` - Cosine similarity

**Modelo:** text-embedding-004 (1536 dimensões)  
**Rate Limit:** 1500 req/min

### 4. Busca Semântica

#### SemanticSearchService
**Arquivo:** `server/lib/connectors/search/SemanticSearchService.ts`

Busca por similaridade semântica:
- `search(termo, filtros)` - Busca semântica com pré-filtros
- `searchByEmbedding(embedding)` - Busca direto por vetor
- `hybridSearch(termo)` - Combina BM25 + Semantic

#### HybridSearcher
**Arquivo:** `server/lib/connectors/search/HybridSearcher.ts`

Combinação via RRF (Reciprocal Rank Fusion):
- `combineWithRrf(bm25Results, semanticResults)` - Fusão inteligente
- Pesos configuráveis (padrão: 50/50)
- K-parameter para RRF (padrão: 60)

### 5. Database Schema

**Migrations:** `server/db/schema-migrations/`

#### 001-add-orgaos-itens-padronizados.sql
Tabelas principais:
- `orgaos` (15k registros)
  - Campos: id, cnpj (UNIQUE), nome, total_contratacoes, uf, tipo_orgao, timestamps
  - Índices: cnpj, uf, ultima_coleta_em

- `itens_padronizados` (5k registros)
  - Campos: id, slug (UNIQUE), nome, codigos_catmat[], codigos_catser[], hash_conteudo
  - Índices: slug, nome (GIN/FTS), codigos_catmat (GIN), codigos_catser (GIN)

- `documentos_padronizacao`
  - Campos: id, item_id (FK), titulo, url, tipo_arquivo, hash_conteudo
  - Índices: item_id, hash_conteudo

- `coleta_metadata`
  - Tracking de coleta para scheduler

#### 002-add-embeddings.sql
Após pgvector instalado:
- Adiciona `embedding vector(1536)` às tabelas
- Cria índices HNSW para busca rápida
- Tabelas de metadata para tracking de embeddings

## Documentação

### FASE-1-ARCHITECTURE.md
Visão geral da arquitetura:
- Data flow (coleta → storage → embeddings → busca)
- Stack tecnológico
- Componentes principais
- Fluxo de implementação em 5 commits
- Performance targets

### PNCP-API-INTEGRATION.md
Integração com API PNCP:
- 4 endpoints documentados com exemplos
- Rate limiting e retry strategy
- Error handling
- Best practices (caching, batch)
- Troubleshooting

### CATALOGO-PADRONIZACAO.md
Coleta do catálogo gov.br:
- Estrutura de página esperada
- Parser strategy com fallbacks
- Dados CATMAT/CATSER
- Download e deduplicação de documentos
- Desafios e soluções

### SEMANTIC-SEARCH-DESIGN.md
Estratégia de busca:
- BM25 (full-text search no PostgreSQL)
- Semantic search (embeddings + pgvector)
- RRF (Reciprocal Rank Fusion) para combinação
- Query examples com código
- Performance tuning
- Ajuste de pesos

## Fluxo de Implementação (5 Commits)

### Commit 1: Core Infrastructure
**Foco:** PncpApiClient + OrgaosCollector

- [ ] Implementar PncpApiClient (4 métodos)
- [ ] Implementar retry logic + rate limiting
- [ ] Implementar OrgaosCollector (validação + upsert)
- [ ] Executar migration 001
- [ ] Testar: 15k órgãos carregados com sucesso

**Tempo estimado:** 4-6 horas

### Commit 2: Catalog Collection
**Foco:** CatalogoCollector + Documentos

- [ ] Implementar CatalogoCollector (parser HTML)
- [ ] Implementar download de documentos
- [ ] Testar deduplicação por hash
- [ ] Validar 5k+ itens no banco
- [ ] Teste end-to-end

**Tempo estimado:** 6-8 horas

### Commit 3: Embeddings
**Foco:** GeminiEmbedClient + Setup pgvector

- [ ] Instalar pgvector extension
- [ ] Implementar GeminiEmbedClient
- [ ] Executar migration 002
- [ ] Gerar embeddings para 15k+ items
- [ ] Teste de similaridade cosine

**Tempo estimado:** 4-5 horas

### Commit 4: Semantic Search
**Foco:** SemanticSearchService + HybridSearcher

- [ ] Implementar SemanticSearchService
- [ ] Implementar HybridSearcher com RRF
- [ ] Testar BM25 + Semantic + RRF
- [ ] Validar queries complexas
- [ ] Otimizar pesos

**Tempo estimado:** 4-6 horas

### Commit 5: API Endpoints
**Foco:** Endpoints públicos + Tests

- [ ] Endpoint GET /api/search/hybrid
- [ ] Endpoint GET /api/search/semantic
- [ ] Endpoint GET /api/items/{id}
- [ ] Tests de integração
- [ ] Documentação de API

**Tempo estimado:** 3-4 horas

## Variáveis de Ambiente Necessárias

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/monitor_licitacao
DB_POOL_SIZE=20

# API PNCP
PNCP_API_BASE_URL=https://pncp.gov.br/api
PNCP_RATE_LIMIT_RPM=1000

# Gemini API
GEMINI_API_KEY=your-api-key
GEMINI_EMBEDDING_MODEL=text-embedding-004
GEMINI_RATE_LIMIT_RPM=1500

# Redis (Bull Queue para workers)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Workers Scheduling
ORGAOS_COLLECTOR_CRON=0 2 * * *     # Daily 2AM
CATALOGO_COLLECTOR_CRON=0 3 * * 0   # Weekly Sunday 3AM
EMBEDDINGS_GENERATOR_CRON=0 5 * * *  # Daily 5AM
```

## Performance Targets

| Operação | Alvo | Notas |
|----------|------|-------|
| Coleta de órgãos | <3 min | 15k items com rate limit |
| Coleta catálogo | <60 min | Inclui downloads |
| Gerar embeddings | <5 min | 20k items batch |
| Semantic search | <200ms | Query individual |
| BM25 search | <50ms | Query individual |
| Hybrid search | <300ms | Combinado |

## Checklist de Implementação

### Antes de Commit 1
- [ ] Revisar tipos em `types.ts`
- [ ] Revisar estrutura de `PncpApiClient`
- [ ] Setup de ambiente (DATABASE_URL, PNCP_API_BASE_URL)
- [ ] Criar banco de dados

### Antes de Commit 2
- [ ] Testar 15k órgãos carregados
- [ ] Revisar `CatalogoCollector.ts`
- [ ] Setup de storage para documentos
- [ ] Testar download de PDFs

### Antes de Commit 3
- [ ] Instalar pgvector: `CREATE EXTENSION pgvector`
- [ ] Setup GEMINI_API_KEY
- [ ] Executar migration 002
- [ ] Testar geração de 10 embeddings

### Antes de Commit 4
- [ ] Validar 15k+ embeddings gerados
- [ ] Testar consulta BM25
- [ ] Testar consulta Semantic
- [ ] Validar RRF combining

### Antes de Commit 5
- [ ] Todos commits anteriores completos
- [ ] Setup Express.js / servidor
- [ ] Implementar endpoints REST
- [ ] Testes de integração

## Próximos Passos

1. **Revisar Skeleton (2-3 horas)**
   - Ler todos arquivos `.ts` e `.md`
   - Validar tipos e interfaces
   - Adicionar comentários/sugestões

2. **Começar Commit 1 (4-6 horas)**
   - Implementar `PncpApiClient`
   - Implementar `OrgaosCollector`
   - Testar com dados reais

3. **Proceder Iterativamente**
   - Um commit por semana
   - Review de código entre commits
   - Deploy incremental

## Links de Referência

- Documentação de Design: `docs/FASE-1-ARCHITECTURE.md`
- Integração PNCP: `docs/PNCP-API-INTEGRATION.md`
- Catálogo: `docs/CATALOGO-PADRONIZACAO.md`
- Busca Semântica: `docs/SEMANTIC-SEARCH-DESIGN.md`

## Notas Importantes

### Sem Implementação
Estes arquivos são **skeletons puros**:
- Nenhum código real de requisição HTTP
- Nenhum SQL executável
- Apenas tipos, signatures e TODOs
- Preparados para implementação gradual

### Tipos Completos
Todos os tipos TypeScript estão **100% definidos**:
- Interfaces para respostas de API
- Types para configuração
- Error classes customizadas
- Pronto para codar contra interfaces

### Documentação Detalhada
Cada documento descreve a solução **end-to-end**:
- Exemplos de código
- Queries SQL
- Diagramas ASCII
- Performance notes

## Estrutura de Commits

```
feature/pncp-catalog-embeddings
├── Commit 1: PncpApiClient + OrgaosCollector
├── Commit 2: CatalogoCollector
├── Commit 3: GeminiEmbedClient + Embeddings
├── Commit 4: SemanticSearchService + HybridSearcher
└── Commit 5: API Endpoints + Tests
```

## Status Final

- ✅ Branch criada: `feature/pncp-catalog-embeddings`
- ✅ 13 arquivos skeleton TypeScript
- ✅ 4 documentos de design
- ✅ 2 SQL migrations
- ✅ README organizador
- ✅ ~500 linhas de código/documentação
- ✅ Pronto para desenvolvimento

---

**Última Atualização:** 2025-09-12  
**Criado por:** Claude Haiku 4.5  
**Status:** ✅ Ready for Implementation
