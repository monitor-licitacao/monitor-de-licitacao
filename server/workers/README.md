# Workers

Background workers para coleta de dados do PNCP e catálogo de padronização.

## Status Atual

Skeleton files criados | Tipos definidos | Pronto para implementação

## Arquivos

- `OrgaosCollector.ts` - Coleta de órgãos contratantes (~15k registros)
- `CatalogoCollector.ts` - Coleta de itens padronizados do catálogo gov.br
- `README.md` - Este arquivo

## OrgaosCollector

Coleta todos os órgãos contratantes do PNCP.

**Entrada:** API PNCP `/api/search/filters`

**Saída:** Tabela `orgaos` no banco

**Fluxo:**
1. Chamada para `PncpApiClient.fetchOrgaos()`
2. Validação de cada órgão (CNPJ, nome, etc)
3. Upsert no banco (INSERT ... ON CONFLICT UPDATE)
4. Atualizar metadata (ultima_coleta_em)

**Estatísticas:**
- Total processado
- Total inserido (novo)
- Total atualizado
- Erros
- Tempo de execução

**Agendamento:** Diário ou semanal

```typescript
const collector = new OrgaosCollector(logger, pncpClient);
const stats = await collector.coletarOrgaos();
// {
//   totalProcessados: 15000,
//   totalInseridos: 100,
//   totalAtualizados: 14900,
//   erros: 0,
//   status: 'sucesso',
//   tempoExecucaoMs: 45000,
// }
```

## CatalogoCollector

Coleta itens padronizados do catálogo oficial do gov.br.

**Fonte:** https://www.gov.br/pncp/pt-br/catalogo

**Saída:** 
- Tabela `itens_padronizados`
- Tabela `documentos_padronizacao`

**Fluxo:**
1. Fetch HTML da página do catálogo
2. Parser de HTML (extrair tabelas)
3. Normalização de dados (slugs, códigos CATMAT/CATSER)
4. Upsert de itens no banco
5. Download de documentos (PDFs de especificação)
6. Link de documentos aos itens

**Dados Extraídos:**
- CATMAT (Catálogo de Materiais)
- CATSER (Catálogo de Serviços)
- Especificações técnicas
- Documentos de padronização

**Desafios:**
- Página pode ser JavaScript-rendered → usar Puppeteer
- Estrutura HTML pode mudar → parser robusto
- Documentos podem ser grandes → download assíncrono
- Deduplicação por hash de conteúdo

**Agendamento:** Semanal ou mensal

```typescript
const collector = new CatalogoCollector(logger);
const stats = await collector.coletarCatalogo();
// {
//   totalProcessados: 5000,
//   totalInseridos: 50,
//   totalAtualizados: 4950,
//   documentosBaixados: 200,
//   erros: 5,
//   status: 'parcial',
//   tempoExecucaoMs: 120000,
// }
```

## Integração com Job Queue

Ambos workers são ideais para execução via Bull queue (Redis):

```typescript
const queue = new Queue('pncp-collectors', redisConnection);

// Agendamento diário
queue.add('fetch-orgaos', {}, { repeat: { cron: '0 2 * * *' } });

// Agendamento semanal
queue.add('fetch-catalogo', {}, { repeat: { cron: '0 3 * * 0' } });

queue.process('fetch-orgaos', async (job) => {
  const collector = new OrgaosCollector(logger, pncpClient);
  const stats = await collector.coletarOrgaos();
  return stats;
});
```

## Próximos Passos

1. Implementar `OrgaosCollector.coletarOrgaos()` e métodos auxiliares
2. Implementar `CatalogoCollector` com parser HTML
3. Adicionar testes unitários
4. Integrar com Bull queue para agendamento
5. Adicionar alertas de erro (Slack, email)

## Performance

**OrgaosCollector:**
- 15.000 órgãos
- ~45 segundos (sem rate limiting)
- ~2-3 minutos (com rate limiting 1000 req/min)

**CatalogoCollector:**
- 5.000+ itens
- ~2-3 minutos (parsing + upsert)
- ~30+ minutos (com download de documentos)

## Error Handling

Ambos workers implementam:
- Retry em caso de falha de rede
- Continuar mesmo com erro em um item específico
- Log detalhado de erros
- Status parcial se alguns itens falharem
- Atualização de metadata mesmo com erros

## Links

- [FASE-1-ARCHITECTURE.md](../../docs/FASE-1-ARCHITECTURE.md)
- [CATALOGO-PADRONIZACAO.md](../../docs/CATALOGO-PADRONIZACAO.md)
- [Bull Queue Documentation](https://docs.bullmq.io/)
