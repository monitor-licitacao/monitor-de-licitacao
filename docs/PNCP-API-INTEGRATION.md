# PNCP API Integration Guide

**Versão:** 1.0  
**Status:** Skeleton - Pronto para implementação  
**API Base:** https://pncp.gov.br/api

## Endpoints

### 1. GET /api/search/filters

Retorna lista de órgãos e filtros disponíveis.

**Descrição:** Lista todos os órgãos contratantes com total de contratações/licitações.

**Query Parameters:**
- `tipos_documento` (opcional): Filtrar por tipo (ex: "edital")
- `pagina` (opcional): Página (1-indexed, padrão: 1)
- `limite` (opcional): Itens por página (padrão: 100, máximo: 1000)

**Response:** 
```json
{
  "data": [
    {
      "id": "orgao-1",
      "cnpj": "00000000000001",
      "nome": "Ministério da Educação",
      "total": 150,
      "uf": "DF",
      "tipoOrgao": "Ministério"
    },
    {
      "id": "orgao-2",
      "cnpj": "00000000000002",
      "nome": "Secretaria de Educação - SP",
      "total": 250,
      "uf": "SP",
      "tipoOrgao": "Secretaria Estadual"
    }
  ],
  "total": 15000,
  "pagina": 1,
  "totalPaginas": 150
}
```

**Rate Limit:** 1000 req/min  
**Timeout:** 30 segundos  
**HTTP Status:**
- `200` - Sucesso
- `400` - Query inválida
- `429` - Rate limit excedido
- `500` - Erro servidor

**Exemplo de Requisição:**
```bash
curl -s "https://pncp.gov.br/api/search/filters?tipos_documento=edital" \
  | jq '.data | length'
# Retorna: 15000 (total de órgãos)
```

**TODO (Commit 1):**
- [ ] Implementar paginação automática
- [ ] Validar response com zod
- [ ] Cache de órgãos por 24h
- [ ] Retry com exponential backoff

---

### 2. GET /api/licitacao

Retorna licitações/contratações de um órgão.

**Descrição:** Lista editais e contratações de um órgão específico com filtros.

**Query Parameters:**
- `cnpj_orgao` (obrigatório): CNPJ do órgão (14 dígitos)
- `data_inicio` (opcional): Data inicial (YYYY-MM-DD)
- `data_final` (opcional): Data final (YYYY-MM-DD)
- `modalidade` (opcional): Modalidade (Convite, Tomada de Preço, Concorrência, Pregão, etc)
- `termo` (opcional): Termo de busca no título/descrição
- `pagina` (opcional): Página (padrão: 1)
- `limite` (opcional): Itens por página (padrão: 100, máximo: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "edital-123",
      "titulo": "Aquisição de Equipamentos de Informática",
      "numero": "EDITAL-2025-001",
      "dataPublicacao": "2025-01-15T10:30:00Z",
      "dataEncerramento": "2025-02-15T17:00:00Z",
      "modalidade": "Convite",
      "tipoDocumento": "Edital",
      "cnpjOrgao": "00000000000001",
      "idOrgao": "orgao-1",
      "status": "Encerrado",
      "url": "https://pncp.gov.br/detalhe/edital-123"
    }
  ],
  "total": 450,
  "pagina": 1,
  "totalPaginas": 5
}
```

**Rate Limit:** 1000 req/min  
**Timeout:** 30 segundos

**Exemplo de Requisição:**
```bash
# Editais do Ministério da Educação em 2025
curl -s "https://pncp.gov.br/api/licitacao?cnpj_orgao=00000000000001&data_inicio=2025-01-01" \
  | jq '.data | length'
```

**TODO (Commit 1):**
- [ ] Implementar filtros de data
- [ ] Suportar busca por modalidade
- [ ] Validar CNPJ antes de requisição

---

### 3. GET /api/detalhe

Retorna detalhes completos de um edital.

**Descrição:** Informações completas do edital incluindo itens, documentos, especificações.

**Query Parameters:**
- `id` (obrigatório): ID do edital

**Response:**
```json
{
  "id": "edital-123",
  "titulo": "Aquisição de Equipamentos de Informática",
  "numero": "EDITAL-2025-001",
  "dataPublicacao": "2025-01-15T10:30:00Z",
  "cnpjOrgao": "00000000000001",
  "orgaoNome": "Ministério da Educação",
  "descricao": "Edital para aquisição de notebooks e desktops...",
  "itens": [
    {
      "numero": "001",
      "descricao": "Notebook com processador i7",
      "especificacoes": "16GB RAM, 512GB SSD...",
      "quantidade": 50,
      "unidadeMedida": "unidade",
      "codigoNcm": "8471.30.00",
      "codigosCatmat": ["110105"],
      "preco_referencia": 5000.00
    }
  ],
  "documentos": [
    {
      "titulo": "Edital Completo",
      "tipo": "PDF",
      "url": "https://pncp.gov.br/docs/edital-123-completo.pdf",
      "dataPubilcacao": "2025-01-15"
    }
  ],
  "resultados": {
    "dataJulgamento": "2025-02-20T14:00:00Z",
    "vencedor": {
      "nome": "Empresa XYZ LTDA",
      "cnpj": "00000000000099"
    },
    "valorHomologado": 250000.00
  }
}
```

**Rate Limit:** 1000 req/min  
**Timeout:** 30 segundos

**Exemplo de Requisição:**
```bash
# Detalhes completos do edital
curl -s "https://pncp.gov.br/api/detalhe?id=edital-123" \
  | jq '.itens | length'
```

**TODO (Commit 1):**
- [ ] Extrair NCM codes
- [ ] Linkados com catálogo CATMAT
- [ ] Parse de especificações técnicas

---

### 4. GET /api/sugestoes

Retorna sugestões de busca (autocomplete).

**Descrição:** Sugestões de termos para busca de editais.

**Query Parameters:**
- `termo` (obrigatório): Termo para autocomplete
- `limite` (opcional): Max sugestões (padrão: 10)
- `tipo` (opcional): Filtro por tipo (ex: "material", "servico")

**Response:**
```json
{
  "sugestoes": [
    "papel A4 75g/m²",
    "papel A4 80g/m²",
    "papel para cópia",
    "papel reciclado",
    "papel kraft"
  ]
}
```

**Rate Limit:** 1000 req/min  
**Timeout:** 10 segundos

**Exemplo de Requisição:**
```bash
curl -s "https://pncp.gov.br/api/sugestoes?termo=papel&limite=5" \
  | jq '.sugestoes'
```

**TODO (Commit 1):**
- [ ] Cache de sugestões (TTL: 24h)
- [ ] Normalizar termo (remover acentos)

---

## Error Handling

### HTTP Status Codes

| Status | Descrição | Ação |
|--------|-----------|------|
| `200` | OK | Continuar |
| `400` | Bad Request | Validar parâmetros |
| `401` | Unauthorized | (não aplicável, API pública) |
| `404` | Not Found | Item/endpoint não existe |
| `429` | Too Many Requests | Aguardar rate limit reset |
| `500` | Server Error | Retry com exponential backoff |
| `503` | Service Unavailable | Retry mais tarde |

### Retry Strategy

```typescript
// Exponential Backoff
const delays = [1000, 2000, 4000, 8000, 16000];  // ms

for (const attempt of [1, 2, 3, 4, 5]) {
  try {
    return await fetchFromPncp(endpoint);
  } catch (error) {
    if (attempt < 5 && isRetryable(error)) {
      const delay = delays[attempt - 1];
      await sleep(delay);
      continue;
    }
    throw error;
  }
}
```

### Exemplo de Erro 429 (Rate Limit)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Max 1000 requests per minute",
  "retryAfter": 60,
  "resetAt": "2025-01-15T10:31:00Z"
}
```

**Ação:** Aguardar `retryAfter` segundos antes de retry

---

## Rate Limiting

### Limites

- **Limite global:** 1000 requisições/minuto
- **Limite por endpoint:** 200 requisições/minuto (alguns endpoints)
- **Headers de resposta:**
  - `X-RateLimit-Limit` - Limite total
  - `X-RateLimit-Remaining` - Requisições restantes
  - `X-RateLimit-Reset` - Unix timestamp do reset

### Estratégia Recomendada

```typescript
const rateLimitConfig = {
  requestsPorMinuto: 1000,
  delayEntrerequisicoes: 100,  // 60,000ms / 600 requests
  maxRetries: 3,
  delayEntreRetries: 1000,
};
```

### Monitoramento

```typescript
// Log de rate limiting
if (remaining < 100) {
  logger.warn(`[PNCP] Rate limit próximo: ${remaining} requisições restantes`);
}
```

---

## Best Practices

### 1. Caching

```typescript
// Cache de órgãos por 24h
const cache = new Map<string, { data: any; expires: number }>();

async function fetchOrgaosComCache() {
  const key = 'orgaos_list';
  if (cache.has(key) && cache.get(key)!.expires > Date.now()) {
    return cache.get(key)!.data;
  }
  
  const data = await pncpClient.fetchOrgaos();
  cache.set(key, { data, expires: Date.now() + 24 * 3600 * 1000 });
  return data;
}
```

### 2. Batch Processing

```typescript
// Processar múltiplos órgãos sequencialmente com delay
async function fetchEditaisPorMultiplosOrgaos(cnpjs: string[]) {
  const resultados = [];
  for (const cnpj of cnpjs) {
    const editais = await pncpClient.fetchEditaisPorOrgao(cnpj);
    resultados.push(...editais);
    
    // Respeitar rate limit
    await sleep(100);  // 100ms entre requisições
  }
  return resultados;
}
```

### 3. Logging

```typescript
// Log estruturado
logger.info('PNCP API Call', {
  endpoint: '/api/licitacao',
  cnpj: '00000000000001',
  statusCode: 200,
  durationMs: 245,
  resultCount: 50,
});
```

---

## Exemplos de Fluxo Completo

### Fluxo 1: Coletar todos os órgãos

```typescript
// 1. Fetch de órgãos
const orgaos = await pncpClient.fetchOrgaos();
console.log(`Total de órgãos: ${orgaos.length}`);  // 15000

// 2. Upsert no banco
await db.bulkUpsert(orgaos, 'orgaos', { conflictColumn: 'cnpj' });
```

### Fluxo 2: Buscar editais de um órgão

```typescript
// 1. Fetch de editais
const editais = await pncpClient.fetchEditaisPorOrgao('00000000000001', {
  dataInicial: '2025-01-01',
  modalidade: 'Convite',
});

// 2. Para cada edital, fetch de detalhes
for (const edital of editais) {
  const detalhes = await pncpClient.fetchDetalheEdital(edital.id);
  // Processar itens, documentos, etc
}
```

### Fluxo 3: Autocomplete com sugestões

```typescript
// 1. User digita "papel"
const sugestoes = await pncpClient.fetchSugestoes('papel', 10);
// ['papel A4', 'papel ofício', ...]

// 2. User seleciona "papel A4"
// 3. Fazer busca com híbrida com termo "papel A4"
const resultados = await searchService.hybridSearch('papel A4');
```

---

## Troubleshooting

### Problema: "CNPJ não encontrado"

```
Status: 404
Response: { error: "Órgão não encontrado" }
```

**Solução:** Validar formato CNPJ (14 dígitos), testar com órgão conhecido primeiro.

### Problema: "Timeout na requisição"

```
Error: connect ETIMEDOUT
```

**Solução:** Aumentar timeout (padrão 30s), ou fazer retry com exponential backoff.

### Problema: "Rate limit excedido"

```
Status: 429
Headers: X-RateLimit-Remaining: 0
```

**Solução:** Aguardar segundo indicado em `X-RateLimit-Reset`, ou reduzir `requestsPorMinuto`.

---

## Próximos Passos

- [ ] Implementar PncpApiClient com todos 4 endpoints
- [ ] Testes com dados reais da API
- [ ] Monitoring de rate limiting
- [ ] Cache e batch processing

---

## Referências

- [Portal PNCP](https://pncp.gov.br)
- [FASE-1-ARCHITECTURE.md](./FASE-1-ARCHITECTURE.md)
- [PncpApiClient.ts](../server/lib/connectors/pncp/PncpApiClient.ts)
