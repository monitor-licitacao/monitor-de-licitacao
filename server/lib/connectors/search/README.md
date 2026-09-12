# Search Connectors

Implementação de busca semântica e híbrida com pgvector + Gemini embeddings.

## Status Atual

Skeleton files criados | Tipos definidos | Pronto para implementação

## Arquivos

- `SemanticSearchService.ts` - Busca semântica por embeddings
- `HybridSearcher.ts` - Combinação de BM25 + Semantic com RRF
- `README.md` - Este arquivo

## Estratégia de Busca

### Busca Semântica (Cosine Similarity)

1. Gerar embedding do termo via Gemini API (1536-dim)
2. Buscar no pgvector por similaridade cosine
3. Aplicar pré-filtros (órgão, NCM, CATMAT, CATSER)
4. Ranking por score (0-1)

**Vantagens:**
- Captura significado semântico
- Funciona com termos não exatos
- Resiliente a variações de nomenclatura

**Limitações:**
- Não captura ocorrências exatas bem
- Requer embeddings pré-computados

### Busca Full-Text (BM25)

1. Busca full-text native do PostgreSQL
2. Muito bom para termos exatos e NCM codes
3. Rápido e não requer embeddings

**Vantagens:**
- Excelente para buscas estruturadas
- Suporta queries complexas (AND, OR, NOT)
- Sem custo de embedding

**Limitações:**
- Não compreende significado
- Falha com sinônimos

### Busca Híbrida (RRF - Reciprocal Rank Fusion)

Combina BM25 + Semantic Search usando Reciprocal Rank Fusion:

```
scoreRRF = peso_bm25 * (1 / (k + rank_bm25))
         + peso_semantic * (1 / (k + rank_semantic))
```

Onde:
- `k = 60` (típico para PostgreSQL)
- `peso_bm25 = 0.5` (configurável)
- `peso_semantic = 0.5` (configurável)
- `rank` = posição do item na lista ordenada (1-indexed)

**Uso:**

```typescript
const searcher = new HybridSearcher(logger, {
  pesoBm25: 0.4,      // 40% peso para busca exata
  pesoSemantic: 0.6,  // 60% peso para semântica
  kRrf: 60,
  limite: 20,
});

const results = searcher.combineWithRrf(bm25Results, semanticResults);
// [{ id: 'item-1', scoreRrf: 0.85, scores: { ... } }, ...]
```

## Pré-filtros

Antes de fazer busca, filtrar por:

- **Órgão (CNPJ):** `WHERE cnpj_orgao = ?`
- **NCM codes:** `WHERE ANY(codigos_ncm) = ?`
- **CATMAT:** `WHERE ANY(codigos_catmat) IN ?`
- **CATSER:** `WHERE ANY(codigos_catser) IN ?`

Exemplo:

```typescript
const results = await searchService.search('papel A4', {
  cnpjOrgao: '00000000000001',
  codigosCatmat: ['110101', '110102'],
  tipos: ['item_padronizado'],
  limite: 10,
  scoreMinimo: 0.5,
});
```

## Query Examples

### Exemplo 1: Item Padronizado

```typescript
// Usuário busca por "papel para impressora"
const results = await searchService.search('papel para impressora', {
  tipos: ['item_padronizado'],
  codigosCatmat: ['110100'],
  limite: 5,
});
// Retorna: [
//   { id: 'item-1', tipo: 'item_padronizado', texto: 'Papel A4 75g/m²', score: 0.92 },
//   { id: 'item-2', tipo: 'item_padronizado', texto: 'Papel ofício branco', score: 0.88 },
// ]
```

### Exemplo 2: Edital por Órgão + Termo

```typescript
// Buscar editais do Ministério da Educação sobre TI
const results = await searchService.hybridSearch('sistemas de informação', {
  cnpjOrgao: '00000000000001',
  tipos: ['edital'],
  limite: 10,
});
```

## Próximos Passos

1. Implementar `SemanticSearchService.search()` e métodos auxiliares
2. Implementar `HybridSearcher.combineWithRrf()`
3. Integrar com `GeminiEmbedClient` para gerar embeddings
4. Implementar queries SQL em `SemanticSearchService`
5. Adicionar testes de RRF com dados mock

## Performance

- Busca semântica: ~50-200ms (depende de pgvector index)
- Busca BM25: ~10-50ms
- Busca híbrida: ~100-300ms

Recomendações:
- Criar índice HNSW no pgvector para dimension 1536
- Criar índice GIN para BM25
- Pré-computar embeddings em background

## Links

- [SEMANTIC-SEARCH-DESIGN.md](../docs/SEMANTIC-SEARCH-DESIGN.md)
- [pgvector documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [RRF in Information Retrieval](https://en.wikipedia.org/wiki/Reciprocal_rank_fusion)
