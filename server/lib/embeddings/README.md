# Embeddings

Cliente para gerar embeddings de texto usando Google Gemini API.

## Status Atual

Skeleton files criados | Tipos definidos | Pronto para implementação

## Arquivo

- `GeminiEmbedClient.ts` - Client para Gemini Embedding API
- `README.md` - Este arquivo

## Modelo Utilizado

**text-embedding-004**
- Dimensionalidade: 1536
- Entrada máxima: ~20.000 caracteres
- Latência: ~100-500ms
- Preço: Compartilhado com modelos Gemini (included no free tier)

## Uso

### Embedding Simples

```typescript
const client = new GeminiEmbedClient(process.env.GEMINI_API_KEY, logger);

const embedding = await client.gerarEmbedding('papel para impressora');
console.log(embedding.length); // 1536
console.log(embedding); // [-0.123, 0.456, -0.789, ...]
```

### Batch de Embeddings

```typescript
const textos = [
  'papel A4 75g/m²',
  'papel ofício branco',
  'papel reciclado 80g/m²',
];

const embeddings = await client.gerarEmbeddingsBatch(textos);
// [[...-0.123, 0.456...], [...0.789, -0.456...], [...]]
```

### Similaridade Cosine

```typescript
const emb1 = await client.gerarEmbedding('papel A4');
const emb2 = await client.gerarEmbedding('papel ofício');

const similarity = client.calcularSimilaridade(emb1, emb2);
console.log(similarity); // 0.87 (muito similar)
```

## Rate Limiting

- Limite: ~1500 requisições/minuto
- Delay entre requisições: 40ms (padrão)
- Máximo de retries: 3
- Delay entre retries: 1000ms

Configurável:

```typescript
const client = new GeminiEmbedClient(apiKey, logger, {
  requestsPorMinuto: 1000,
  delayEntrerequisicoes: 60,
  maxRetries: 5,
});
```

## Integração com Busca Semântica

Os embeddings são usados em dois cenários:

### 1. Pré-computação (Background)

Durante coleta de dados via `OrgaosCollector` e `CatalogoCollector`:

```typescript
// Para cada item padronizado
const item = { id: 'item-1', nome: 'Papel A4' };
const embedding = await embedClient.gerarEmbedding(item.nome);

// Salvar no banco (com pgvector)
await db.query(
  'UPDATE itens_padronizados SET embedding = $1 WHERE id = $2',
  [embedding, item.id],
);
```

### 2. Query-time (Real-time)

Durante buscas do usuário:

```typescript
const termo = 'papel para impressora';
const queryEmbedding = await embedClient.gerarEmbedding(termo);

// Buscar similar itens usando pgvector
const resultados = await db.query(
  'SELECT * FROM itens_padronizados ORDER BY embedding <=> $1 LIMIT 10',
  [queryEmbedding],
);
```

## Otimizações

### Caching

Embeddings são imutáveis para um texto fixo. Cache com TTL:

```typescript
const cache = new Map<string, number[]>();

async function gerarComCache(texto: string) {
  if (cache.has(texto)) return cache.get(texto);
  
  const embedding = await client.gerarEmbedding(texto);
  cache.set(texto, embedding);
  
  return embedding;
}
```

### Batch Processing

Usar `gerarEmbeddingsBatch()` para 2+ textos economiza requisições:

```typescript
// Opção 1: 5 requisições (uma por texto)
for (const texto of textos) {
  await client.gerarEmbedding(texto);
}

// Opção 2: 1-2 requisições (batch)
await client.gerarEmbeddingsBatch(textos);
```

### Chunking

Para arrays > 100 itens, fazer chunks:

```typescript
const chunks = [];
for (let i = 0; i < textos.length; i += 100) {
  chunks.push(textos.slice(i, i + 100));
}

const embeddings = [];
for (const chunk of chunks) {
  embeddings.push(...await client.gerarEmbeddingsBatch(chunk));
}
```

## Próximos Passos

1. Implementar requisições HTTP com retry
2. Integrar com banco (pgvector)
3. Adicionar cache de embeddings
4. Implementar batch processing
5. Adicionar testes unitários

## Performance

- Embedding simples: ~200ms
- Batch (50 itens): ~500-800ms
- Batch (100 itens): ~1000-1500ms

Para 15.000 órgãos:
- Sem batch: ~3.000 segundos (50 minutos)
- Com batch (100): ~200 segundos (3-4 minutos)

## Custos

Google Gemini oferece:
- Free tier: 1.500 requisições/dia
- Incluso: embeddings compartilhados com modelos
- Pago: sem custo adicional para embeddings

## Links

- [Google Gemini Embedding API](https://ai.google.dev/gemini-api/docs/embeddings)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
- [SEMANTIC-SEARCH-DESIGN.md](../../docs/SEMANTIC-SEARCH-DESIGN.md)
