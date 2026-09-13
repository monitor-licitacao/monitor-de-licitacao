# Guia de Integração e Telemetria: Amplitude & Compras RJ

> **Importante**: Documento gerado por assistência de IA. Revisão humana obrigatória.

Este documento detalha o padrão de implementação de telemetria da coleta e importação do histórico de preços do Compras RJ para a Amplitude HTTP API v2 (atendendo à **Issue #60** e **PRD Seção 6.2**).

---

## 1. Visão Geral da Arquitetura

O módulo de telemetria foi projetado com garantias estritas de:
1. **Validação de Schema em Runtime**: Schemas tipados e validados via `zod` em `server/events/historico-preco-event.ts`.
2. **Idempotência e Deduplicação**: Chave gerada no padrão `{source}_{batch_id}_{timestamp_ms}` com persistência no banco Neon via Drizzle (`telemetry_events`) e fallback defensivo em memória.
3. **Privacidade e Redação de Dados (Golden Rule 6)**: Sanitização automática de CNPJs e valores monetários em campos livres antes da transmissão para o Amplitude.
4. **Resiliência Operacional**: Circuit breaker com detecção de falhas e política de retry com backoff exponencial.

---

## 2. Schema do Evento (`historico_preco_importado`)

Definido em `server/events/historico-preco-event.ts`:

| Campo | Tipo | Obrigatório | Descrição / Restrição |
| :--- | :--- | :--- | :--- |
| `timestamp` | `string` | Sim | Formato ISO 8601 válido |
| `source_system` | `literal("compras_rj")` | Sim | Identificador do sistema de origem |
| `collection_batch_id` | `string` | Sim | UUID v4 válido do lote de coleta |
| `item_count` | `number` | Sim | Inteiro não negativo |
| `operation_type` | `enum` | Sim | `"import"` \| `"update"` \| `"verify"` |
| `processing_time_ms` | `number` | Sim | Tempo de processamento em ms (inteiro >= 0) |
| `status` | `enum` | Sim | `"success"` \| `"failure"` \| `"partial"` |
| `error_code` | `string` | Não | Código de erro caso falhe |
| `error_message` | `string` | Não | Mensagem descritiva (sanitizada de dados PII) |
| `idempotency_key` | `string` | Sim | Formato `{source}_{batch_id}_{timestamp_ms}` |
| `retry_attempt` | `number` | Não | Contagem de tentativas de reenvio |
| `data_quality_score` | `number` | Não | Inteiro entre 0 e 100 |
| `affected_items` | `number` | Não | Total de itens alterados/afetados |

---

## 3. Persistência e Tabela de Auditoria (`telemetry_event_idempotency`)

Estrutura implementada no schema relacional Drizzle (`server/db/schema.ts`):

```typescript
export const telemetryEventIdempotency = pgTable('telemetry_event_idempotency', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  collectionBatchId: text('collection_batch_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  status: text('status').notNull(),
  amplitudeEventId: text('amplitude_event_id'),
  retryAttempt: integer('retry_attempt').default(0).notNull(),
  actorUserId: text('actor_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
}, (table) => ({
  tenantKeyUidx: uniqueIndex('telemetry_event_idempotency_tenant_key_uidx').on(
    table.tenantId,
    table.idempotencyKey
  ),
  tenantStatusIdx: index('telemetry_event_idempotency_tenant_status_idx').on(
    table.tenantId,
    table.status
  ),
}));
```

---

## 4. Variáveis de Ambiente e Configuração

* `AMPLITUDE_API_KEY`: Chave de API da Amplitude para HTTP API v2 (`process.env.AMPLITUDE_API_KEY`). Nunca commitada diretamente no repositório.
* `DATABASE_URL`: String de conexão Neon Postgres para a tabela `telemetry_event_idempotency`. Caso ausente em testes locais ou workers isolados, a camada faz fallback gracioso para cache de idempotência em memória.

> **Nota sobre Retenção**: A política de retenção de eventos de 90 dias mencionada no PRD é gerenciada diretamente no console de administração da Amplitude e não pode ser configurada dinamicamente via chamada à API de eventos.

---

## 5. Padrão de Testes

Os testes automatizados em `__amplitude_historico__.test.ts` utilizam o test double `MockAmplitudeHttpApi` (`tests/__amplitude_mock__.ts`), permitindo validar:
* Validação rigorosa de schema em runtime (casos válidos e inválidos).
* Formatação e verificação da chave de idempotência.
* Sanitização de PII / valores confidenciais.
* Envio com deduplicação (rejeição de duplo envio para status `sent`).
* Comportamento sob falha de rede e retries com backoff.

Execute a suíte com:
```bash
npm test
```
