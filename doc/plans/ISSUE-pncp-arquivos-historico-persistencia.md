## Objetivo

Persistir **anexos PNCP** (`/arquivos`) e **histórico de manutenção** (`/historico`) na ficha de contratação, corrigindo Passex 19732 que hoje exibe **Anexos (0)** e **Histórico (3)** sintético apesar de 4 PDFs e 38 eventos no [PNCP](https://pncp.gov.br/app/editais/00394452000103/2026/19732).

**Por quê:** o ingest atual grava compra + itens, mas `buildAnexos()` lê `raw_json.arquivos` (inexistente). Histórico persistido (`contratacao_historico`) só deriva datas da compra — não consome a API `/historico`.

## Critérios de aceite

### Negócio
- [ ] Passex 19732 (`00394452000103-1-019732/2026`): tab **Anexos** mostra **4** documentos com título, tipo e link PNCP
- [ ] Histórico lista eventos `Inclusão - Documento de Contratação` / `Inclusão - Item de Contratação` com data/hora e nome do arquivo quando aplicável
- [ ] Links de download abrem endpoint PNCP (`/pncp-api/v1/.../arquivos/{seq}`) — sem storage próprio

### Técnico
- [ ] Migrations `0011_contratacao_arquivos` + `0012_contratacao_log_pncp`
- [ ] Client + persist idempotente + sync no ingest + lazy backfill no detail API
- [ ] Script `npm run pncp:sync-documentos -- --controle <numeroControlePncp>`
- [ ] Testes `__pncp_arquivos__.test.ts` + golden fixture Passex
- [ ] `npm test` + `npm run lint` verdes

## Rastreabilidade

- **Plano:** `doc/plans/PLAN-pncp-arquivos-historico-persistencia.md`
- **Golden:** Passex 19732 — UUID local `cf9e0e18-1b03-4cb2-9f29-ad964c869402`
- **Endpoints PNCP:**
  - [quantidade=4](https://pncp.gov.br/api/pncp/v1/orgaos/00394452000103/compras/2026/19732/arquivos/quantidade)
  - [arquivos p1](https://pncp.gov.br/api/pncp/v1/orgaos/00394452000103/compras/2026/19732/arquivos?pagina=1&tamanhoPagina=5)
  - [historico p1](https://pncp.gov.br/api/pncp/v1/orgaos/00394452000103/compras/2026/19732/historico?pagina=1&tamanhoPagina=5)
- **Área:** `area:ingestao`, `area:api`, `area:ui`
- **Prioridade:** P1
- **Executor:** `exec:cursor`
- **Modelo:** composer-2.5

## Escopo

### In
- Tabelas + client + persist + sync ingest + detail API + UI tabs Anexos/Histórico
- Backfill script contratações existentes
- Testes unitários/integração com fixture

### Out
- Cache/download PDF em blob storage
- Atas (`/atas`) e contratos (`/contratos/contratacao` — 404 esperado)
- Compras.gov fase-externa captcha

## Plano de testes e PR

### Pré-implementação
- [ ] Reproduzir bug: abrir `/contratacoes/cf9e0e18-1b03-4cb2-9f29-ad964c869402` → Anexos (0)
- [ ] Confirmar API PNCP retorna 4 arquivos (curl ou browser)

### Durante implementação (TDD por task do plano)
- [ ] Task 3: teste client com fixture → 4 arquivos
- [ ] Task 4: teste upsert idempotente
- [ ] Task 6: teste detail API → `anexos.length === 4`
- [ ] Task 9: `npm test` completo

### Pré-PR
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Backfill Passex: `npm run pncp:sync-documentos -- --controle 00394452000103-1-019732/2026`
- [ ] Screenshot UI: tabs Anexos (4) + Histórico (≥5 eventos visíveis)
- [ ] PR description com link PNCP + antes/depois

### Checklist PR
```markdown
## Summary
- Persist PNCP /arquivos and /historico to Postgres
- Fix empty Anexos tab for Passex 19732 (4 documents)

## Test plan
- [ ] npm test
- [ ] npm run lint
- [ ] Manual: cf9e0e18-1b03-4cb2-9f29-ad964c869402 shows 4 anexos
- [ ] Compare with https://pncp.gov.br/app/editais/00394452000103/2026/19732
```

## Arquivos prováveis

- `server/db/migrations/0011_contratacao_arquivos.sql`
- `server/db/migrations/0012_contratacao_log_pncp.sql`
- `server/lib/pncp/arquivos-client.ts`
- `server/lib/pncp/persist-arquivos.ts`
- `server/lib/pncp/persist-historico-pncp.ts`
- `server/lib/pncp/sync-documentos.ts`
- `server/lib/compras-gov/enrichment-api.ts`
- `src/components/contratacoes/ContratacaoDetailView.tsx`
- `__pncp_arquivos__.test.ts`

## Labels sugeridos

`area:ingestao`, `area:api`, `area:ui`, `P1`, `exec:cursor`
