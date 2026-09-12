# Semantic Search Design - RRF + Embeddings

**Versão:** 1.0  
**Status:** Skeleton - Pronto para implementação  
**Estratégia:** BM25 (PostgreSQL FTS) + Cosine Similarity (pgvector) + RRF

## Visão Geral

Busca híbrida que combina:
1. **BM25** - Full-text search (exato, termo-base)
2. **Semantic Search** - Embeddings + cosine similarity (semântico)
3. **RRF** - Reciprocal Rank Fusion (combinação inteligente)

```
User Query: "papel para impressora"
         ↓
    ┌────┴────┐
    ↓         ↓
  BM25    Semantic
    ↓         ↓
  Rank1    Rank2
    └────┬────┘
         ↓
      RRF (Combine)
         ↓
   Final Results
```

## 1. BM25 (Full-Text Search)

### O que é?

BM25 (Best Match 25) é um algoritmo de ranking para busca textual que considera:
- Frequência do termo (TF - Term Frequency)
- Inverso da frequência do documento (IDF - Inverse Document Frequency)
- Tamanho do documento

### Fórmula

```
BM25(d,q) = Σ[i=1..n] IDF(qi) * (f(qi,d) * (k1 + 1)) / (f(qi,d) + k1 * (1 - b + b * |d| / avgdl))

Onde:
- qi = termo i da query
- d = documento
- f(qi,d) = frequência do termo qi no documento d
- |d| = tamanho do documento em palavras
- avgdl = tamanho médio de documento
- k1 = parâmetro (típico: 1.2)
- b = parâmetro (típico: 0.75)
```

### Implementação no PostgreSQL

```sql
-- Criar índice GIN para full-text search
CREATE INDEX idx_itens_nome_fts
ON itens_padronizados
USING GIN(to_tsvector('portuguese', nome));

-- Query com BM25
SELECT 
  id, 
  nome,
  ts_rank(
    to_tsvector('portuguese', nome),
    to_tsquery('portuguese', 'papel & impressora')
  ) as bm25_score
FROM itens_padronizados
WHERE to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'papel & impressora')
ORDER BY bm25_score DESC
LIMIT 100;
```

### Exemplo de Resultado

```
Query: "papel para impressora"
Parsed to: "papel" & "impressora"  (ignora "para")

Resultados:
1. Papel A4 branco para impressora (score: 15.4)
2. Papel ofício 75g/m² (score: 12.1)
3. Cartucho para impressora (score: 9.8)
```

### Vantagens

- Muito rápido (~10-50ms)
- Excelente para termos exatos
- Captura relevância by frequency
- Independente de embeddings

### Limitações

- Não compreende significado
- Falha com sinônimos (papel ≠ papelaria)
- Falha com termos não exatos (typos)

---

## 2. Semantic Search (Embeddings + Cosine Similarity)

### O que é?

Transforma texto em vetor numérico (embedding) e compara similaridade usando cosine distance.

```
"papel A4 para impressora" → [-0.123, 0.456, -0.789, ...] (1536-dim)
"papel branco 75g"         → [-0.124, 0.451, -0.792, ...] (1536-dim)

cosine_similarity = dot_product / (|v1| * |v2|)
                  = 0.987  (0 = diferente, 1 = idêntico)
```

### Fórmula (Cosine Similarity)

```
similarity(v1, v2) = (v1 · v2) / (|v1| * |v2|)
                   = Σ(v1[i] * v2[i]) / (√Σ(v1[i]²) * √Σ(v2[i]²))

Valor em [0, 1]:
- 0.0 = Completamente diferente
- 0.5 = Moderadamente similar
- 0.9+ = Muito similar
- 1.0 = Idêntico
```

### Modelo Utilizado

**Google Gemini text-embedding-004**
- Dimensionalidade: 1536
- Input máximo: ~20.000 caracteres
- Latência: ~100-500ms
- Custo: Free tier (included)

### Implementação no PostgreSQL (pgvector)

```sql
-- Criar extensão pgvector (pré-requisito)
CREATE EXTENSION pgvector;

-- Adicionar coluna de embedding
ALTER TABLE itens_padronizados
ADD COLUMN embedding vector(1536);

-- Criar índice HNSW (Hierarchical Navigable Small Worlds)
CREATE INDEX idx_itens_embedding
ON itens_padronizados
USING hnsw(embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query de busca por similaridade
SELECT 
  id,
  nome,
  (embedding <=> :query_embedding) as cosine_distance,
  (1 - (embedding <=> :query_embedding)) as similarity
FROM itens_padronizados
WHERE embedding IS NOT NULL
ORDER BY embedding <=> :query_embedding  -- <=> = cosine distance operator
LIMIT 10;
```

### Exemplo de Resultado

```
Query: "papel para máquina de escrever"
Query embedding: [-0.0234, 0.1256, -0.0876, ...]

Resultados (top-5):
1. Papel ofício 75g/m² (similarity: 0.92)
2. Papel A4 75g/m² (similarity: 0.89)
3. Papel timbrado (similarity: 0.87)
4. Papel kraft 90g/m² (similarity: 0.81)
5. Papel carbono (similarity: 0.78)
```

### Vantagens

- Compreende significado semântico
- Funciona com termos não exatos
- Resiliente a sinônimos
- Captura contexto

### Limitações

- Requer embeddings pré-computados
- Mais lento que BM25 (~100-200ms)
- Falha com termos muito específicos (NCM codes)
- Custo de API (Gemini)

---

## 3. RRF (Reciprocal Rank Fusion)

### O que é?

Algoritmo que combina rankings de múltiplas fontes (BM25 + Semantic) sem precisar de scores comparáveis.

### Fórmula

```
RRF_score(d) = Σ[i=1..n] 1 / (k + rank_i(d))

Onde:
- rank_i(d) = posição do documento d no ranking i (1-indexed)
- k = constante (típico: 60 para PostgreSQL)
- n = número de rankings

Para dois rankings (BM25 + Semantic):
RRF_score = 1/(60 + rank_bm25) + 1/(60 + rank_semantic)

Se documento não aparece em um ranking, usar rank = ∞
```

### Exemplo Numérico

```
Documento A:
  - BM25 rank: 1 (score: 15.4)
  - Semantic rank: 3 (similarity: 0.85)
  - RRF score = 1/(60+1) + 1/(60+3) = 1/61 + 1/63 = 0.0164 + 0.0159 = 0.0323

Documento B:
  - BM25 rank: 5 (score: 10.2)
  - Semantic rank: 1 (similarity: 0.92)
  - RRF score = 1/(60+5) + 1/(60+1) = 1/65 + 1/61 = 0.0154 + 0.0164 = 0.0318

Documento C:
  - BM25 rank: 2 (score: 12.8)
  - Semantic rank: ∞ (não aparece)
  - RRF score = 1/(60+2) + 1/(60+∞) = 1/62 + 0 = 0.0161

Final ranking:
1. Documento A (0.0323)
2. Documento B (0.0318)
3. Documento C (0.0161)
```

### Implementação

```typescript
interface RankingResult {
  id: string;
  score: number;
  rank: number;
}

function combineWithRrf(
  bm25Results: RankingResult[],
  semanticResults: RankingResult[],
  k = 60
): Array<{ id: string; rrfScore: number }> {
  const rrfScores = new Map<string, number>();
  
  // Process BM25 results
  bm25Results.forEach((result, idx) => {
    const rank = idx + 1;  // 1-indexed
    const rrfScore = 1 / (k + rank);
    rrfScores.set(result.id, (rrfScores.get(result.id) || 0) + rrfScore);
  });
  
  // Process Semantic results
  semanticResults.forEach((result, idx) => {
    const rank = idx + 1;  // 1-indexed
    const rrfScore = 1 / (k + rank);
    rrfScores.set(result.id, (rrfScores.get(result.id) || 0) + rrfScore);
  });
  
  // Sort by RRF score descending
  return Array.from(rrfScores.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
```

### Vantagens

- Combina duas estratégias sem score normalization
- Balanceado por padrão (50/50)
- Robusto a outliers
- Simples e eficiente

### Limitações

- Assume independência dos rankings
- Todos os itens têm contribuição igual

---

## 4. Pre-Filtros

Antes de busca, aplicar filtros para reduzir espaço de busca:

### Por Órgão (CNPJ)

```sql
SELECT * FROM itens_padronizados
WHERE org_id IN (
  SELECT id FROM orgaos WHERE cnpj = '00000000000001'
);
```

### Por NCM (Código de Classificação)

```sql
SELECT * FROM itens_padronizados
WHERE '110101' = ANY(codigos_catmat);
```

### Por Tipo de Item

```sql
SELECT * FROM itens_padronizados
WHERE tipo IN ('material', 'servico');
```

### Exemplo Combinado

```typescript
async function buscarComFiltros(
  termo: string,
  filtros: {
    cnpjOrgao?: string;
    codigosCatmat?: string[];
    tipos?: string[];
  }
) {
  // Construir query SQL com WHERE clause dinâmico
  let sql = `
    SELECT id, nome, embedding
    FROM itens_padronizados
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filtros.cnpjOrgao) {
    sql += ` AND org_id IN (SELECT id FROM orgaos WHERE cnpj = $${params.length + 1})`;
    params.push(filtros.cnpjOrgao);
  }
  
  if (filtros.codigosCatmat?.length) {
    sql += ` AND codigos_catmat && $${params.length + 1}`;
    params.push(filtros.codigosCatmat);
  }
  
  if (filtros.tipos?.length) {
    sql += ` AND tipo = ANY($${params.length + 1})`;
    params.push(filtros.tipos);
  }
  
  const results = await db.query(sql, params);
  return results;
}
```

---

## 5. Query Examples

### Exemplo 1: Busca Simples

```typescript
// Query: "papel A4"

// Step 1: BM25
const bm25Results = await db.query(`
  SELECT id, nome, ts_rank(...) as score
  FROM itens_padronizados
  WHERE to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'papel')
  LIMIT 100
`);
// Results: [
//   { id: 'item-1', nome: 'Papel A4 75g/m²', score: 15.4 },
//   { id: 'item-2', nome: 'Papel ofício', score: 12.1 },
// ]

// Step 2: Semantic
const queryEmbedding = await geminiClient.gerarEmbedding('papel A4');
const semanticResults = await db.query(`
  SELECT id, nome, (embedding <=> $1) as distance
  FROM itens_padronizados
  ORDER BY distance ASC
  LIMIT 100
`, [queryEmbedding]);
// Results: [
//   { id: 'item-1', nome: 'Papel A4 75g/m²', similarity: 0.92 },
//   { id: 'item-5', nome: 'Papel A5', similarity: 0.88 },
// ]

// Step 3: RRF Combine
const finalResults = hybridSearcher.combineWithRrf(bm25Results, semanticResults);
// Results: [
//   { id: 'item-1', rrfScore: 0.0323 },  // Aparece em ambos (1º BM25, 1º Semantic)
//   { id: 'item-5', rrfScore: 0.0154 },  // Aparece só em Semantic (2º)
//   { id: 'item-2', rrfScore: 0.0159 },  // Aparece só em BM25 (2º)
// ]
```

### Exemplo 2: Busca com Pré-Filtro

```typescript
// Query: "papel" + filtro cnpj = "00000000000001"

const orgaoId = await db.query(
  'SELECT id FROM orgaos WHERE cnpj = $1',
  ['00000000000001']
);

// BM25 com filtro
const bm25Results = await db.query(`
  SELECT id, nome, ts_rank(...) as score
  FROM itens_padronizados
  WHERE org_id = $1
    AND to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'papel')
  LIMIT 100
`, [orgaoId.rows[0].id]);

// Similar para semantic
```

### Exemplo 3: Busca Avançada (NCM + Término)

```typescript
// Query: "papel" + catmat 110101

const baseQuery = `
  SELECT id, nome, embedding
  FROM itens_padronizados
  WHERE '110101' = ANY(codigos_catmat)
`;

// BM25 sobre pré-filtrados
const bm25 = await db.query(baseQuery + `
  AND to_tsvector('portuguese', nome) @@ to_tsquery('portuguese', 'papel')
`);

// Semantic sobre pré-filtrados
const semantic = await db.query(baseQuery + `
  ORDER BY embedding <=> $1 LIMIT 100
`, [queryEmbedding]);
```

---

## 6. Performance & Tuning

### Index Types

| Índice | Tipo | Use case | Performance |
|--------|------|----------|-------------|
| BM25 (GIN) | Full-Text | Buscas textuais | 10-50ms |
| HNSW (pgvector) | Vector | Similary search | 50-200ms |
| B-tree | Scalar | Filtros (CNPJ, tipo) | <1ms |

### Tuning HNSW

```sql
-- m = número de conexões (padrão: 16)
-- ef_construction = tamanho da candidate list (padrão: 64)
-- Maior = mais acurado mas mais lento

-- Balanceado
CREATE INDEX idx_embedding_hnsw
ON itens_padronizados
USING hnsw(embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Mais rápido (menos acurado)
WITH (m = 8, ef_construction = 32);

-- Mais acurado (mais lento)
WITH (m = 24, ef_construction = 128);
```

### Query Optimization

```sql
-- ✗ Ruim: Sem índice, full table scan
SELECT * FROM itens_padronizados
ORDER BY embedding <=> query_embedding;

-- ✓ Bom: Com índice HNSW
EXPLAIN ANALYZE
SELECT * FROM itens_padronizados
WHERE embedding IS NOT NULL
ORDER BY embedding <=> query_embedding
LIMIT 10;
-- Index Scan using idx_embedding_hnsw ...
```

---

## 7. Hybrid Search Weights

### Ajuste de Pesos

```typescript
// Default: 50/50
const searcher = new HybridSearcher(logger, {
  pesoBm25: 0.5,
  pesoSemantic: 0.5,
});

// BM25-biased (40/60 semantic)
// Melhor para querys estruturadas (NCM codes)
const searcher = new HybridSearcher(logger, {
  pesoBm25: 0.4,
  pesoSemantic: 0.6,
});

// Semantic-biased (30/70 semantic)
// Melhor para querys naturais
const searcher = new HybridSearcher(logger, {
  pesoBm25: 0.3,
  pesoSemantic: 0.7,
});
```

### Quando ajustar

- **Aumentar BM25:** Usuários buscam por NCM/CATMAT codes
- **Aumentar Semantic:** Usuários fazem buscas em linguagem natural
- **Balanced (0.5/0.5):** Geral, recomendado para produção

---

## 8. Próximos Passos

- [ ] Implementar BM25 em SemanticSearchService
- [ ] Implementar Vector Search em SemanticSearchService
- [ ] Implementar RRF em HybridSearcher
- [ ] Testar com dados reais (15k+ items)
- [ ] Tunear índices e pesos

---

## Referências

- [BM25 Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
- [RRF (Reciprocal Rank Fusion)](https://en.wikipedia.org/wiki/Reciprocal_rank_fusion)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings)
- [FASE-1-ARCHITECTURE.md](./FASE-1-ARCHITECTURE.md)
