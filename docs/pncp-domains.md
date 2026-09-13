# Domain Registry PNCP — modalidades, instrumentos e amparos legais

**Issue:** [#81](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/81)  
**Observado em:** 13/09/2026 (HTTP `200`, endpoints públicos, sem autenticação)  
**Job:** `SYNC_PNCP_DOMAINS`  
**Este módulo não interpreta direito.** Ele replica tabelas de domínio publicadas pelo PNCP.

## Endpoints de origem

| Domínio | Endpoint | Campos usados |
|---|---|---|
| Modalidades | `GET https://pncp.gov.br/api/pncp/v1/modalidades` | `id`, `nome`, `descricao`, `dataInclusao`, `dataAtualizacao`, `statusAtivo`, `irp` |
| Instrumentos convocatórios | `GET https://pncp.gov.br/api/pncp/v1/tipos-instrumentos-convocatorios` | `id`, `nome`, `descricao`, `obrigatoriedadeDataAberturaPropostaNome`, `obrigatoriedadeDataEncerramentoPropostaNome`, `dataInclusao`, `dataAtualizacao`, `statusAtivo` |
| Amparos legais | `GET https://pncp.gov.br/api/pncp/v1/amparos-legais` | `id`, `nome`, `descricao`, `tipoAmparoLegal{id,nome,descricao,statusAtivo}`, `dataInclusao`, `dataAtualizacao`, `statusAtivo` |

`irp` é persistido como boolean da fonte. Não há significado operacional adicional inferido neste módulo.

## Política de sync

- Frequência sugerida: **diária** (`0 6 * * *` America/Sao_Paulo no worker com `WORKER_CRON=true`).
- Sync manual: `npm run worker:pncp-domains` ou `POST /api/v1/domains/sync` (autenticado).
- Não consultar esses endpoints por contratação. O registro local é o cache.
- Timeout 20s, até 3 tentativas, backoff 300ms × tentativa (mesmo padrão do cliente Compras.gov).
- Falha de um domínio **não** aborta os outros.
- Schema drift (lista inválida, `id`/`nome` ausentes ou tipo errado) gera `PncpDomainSchemaError` e `source_health` DEGRADED.

## Inativos

`statusAtivo=false` **não implica DELETE**. O registro local é atualizado e preservado. A captura de 13/09/2026 já mostrou o instrumento `5` (Não se Aplica) inativo.

## Versionamento

Reutiliza infraestrutura existente:

- `source_record` — raw payload + `payload_hash` + `first_seen_at`/`last_seen_at`
- `entity_snapshot` — append-only quando o hash do registro muda (`DOMAIN_UPDATED` implícito)
- tabelas de domínio — campos normalizados + `raw_json` + `payload_hash` (mesmo padrão de `catalog_item`)

Datas da fonte (`dataInclusao`/`dataAtualizacao` → `source_created_at`/`source_updated_at`) são distintas das datas internas (`first_seen_at`, `last_seen_at`, `created_at`, `updated_at`).

## API interna

Autenticada pelo middleware `/api` (JWT ou `x-api-key`):

```http
GET /api/v1/domains/modalidades
GET /api/v1/domains/instrumentos-convocatorios
GET /api/v1/domains/amparos-legais
GET /api/v1/domains/amparos-legais/{id}
POST /api/v1/domains/sync
```

Filtros: `status_ativo`, `tipo` (pncp_id do tipo de amparo), `q` (nome/descrição). Toda listagem devolve `pncpId`.

## Relação com contratação — não inventada nesta issue

A tabela `contratacao` **não** ganhou FK nova aqui.

Evidência já existente no payload PNCP da compra SESC CE 026/2026 (`server/lib/pncp/fixtures/sesc-ce-026-2026/compra.json`):

| Campo da fonte | Significado | Situação atual |
|---|---|---|
| `modalidadeId` | ID oficial da modalidade | gravado em `contratacao.modalidade_id` (integer PNCP, não FK UUID) |
| `tipoInstrumentoConvocatorioCodigo` | ID oficial do instrumento | **não persistido** como coluna |
| `amparoLegal.codigo` | ID oficial do amparo | **não persistido** como coluna |

Não há matching por nome, valor, objeto ou modalidade presumida. Follow-up: mapear essas três chaves explícitas para as tabelas deste registry.

## Limitações

- Não é motor jurídico. Descrições do PNCP são dados de origem.
- Não existe `if valor < X → Art. 75, II`.
- Não existe `modalidade X → amparo Y`.
- Não há tabela `alert_rule` no schema atual; filtros de alerta por domínio ficam para issue posterior.
- Analytics por amparo dependem do relacionamento com contratação, ainda não fechado.

Uma eventual rule engine jurídica precisará de legislação, vigência, fonte e versão **próprias**, fora deste registry.
