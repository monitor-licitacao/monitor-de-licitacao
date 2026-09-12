# PNCP Connector

Client tipado para integração com API PNCP (Portal Nacional de Contratações Públicas).

## Status Atual

Skeleton files criados | Tipos definidos | Pronto para implementação

## Arquivos

- `types.ts` - Definições de tipos e interfaces
- `PncpApiClient.ts` - Client HTTP com métodos principais
- `README.md` - Este arquivo

## Métodos Principais

### `fetchOrgaos()`

Retorna lista de todos os órgãos contratantes (~15.000 órgãos).

```typescript
const orgaos = await client.fetchOrgaos();
// [{ id: '...', cnpj: '00000000000000', nome: '...', total: 150 }, ...]
```

### `fetchEditaisPorOrgao(cnpjOrgao, filtros?)`

Retorna editais/contratações de um órgão específico.

```typescript
const editais = await client.fetchEditaisPorOrgao('00000000000000', {
  dataInicial: '2025-01-01',
  modalidade: 'Convite',
});
```

### `fetchDetalheEdital(idEdital)`

Retorna detalhes completos de um edital.

```typescript
const edital = await client.fetchDetalheEdital('edital-123');
// { id: '...', titulo: '...', items: [...], documentos: [...] }
```

### `fetchSugestoes(termo, limite?)`

Retorna sugestões de busca.

```typescript
const sugestoes = await client.fetchSugestoes('papel', 10);
// ['papel A4', 'papel branco', ...]
```

## Rate Limiting

- Limite: ~1000 requisições/minuto
- Delay entre requisições: 100ms (padrão)
- Máximo de retries: 3
- Delay entre retries: 1000ms

Configurável ao inicializar:

```typescript
const client = new PncpApiClient(logger, {
  requestsPorMinuto: 500,
  delayEntrerequisicoes: 200,
  maxRetries: 5,
});
```

## Próximos Passos

1. Implementar métodos HTTP com retry logic
2. Integrar com sistema de logging
3. Adicionar testes unitários
4. Validar respostas com schema validator

## Links

- [Documentação PNCP](https://pncp.gov.br)
- [PNCP-API-INTEGRATION.md](../../docs/PNCP-API-INTEGRATION.md)
- [FASE-1-ARCHITECTURE.md](../../docs/FASE-1-ARCHITECTURE.md)
