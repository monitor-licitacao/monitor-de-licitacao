> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/89

## 1. Objetivo

Implementar o **Pipeline de Participação** (`/pipeline`) — clone comportamental do Licinexus `/minhas-licitacoes`: funil tenant das contratações que o fornecedor escolheu acompanhar.

**Por quê:** descoberta pública (`/contratacoes`), portfolio de contratos (`/contratos`) e RevOps (`crm_deals`) são superfícies distintas. O tenant precisa de um board kanban para organizar licitações em disputa, com KPIs, importação por PNCP e botão Participar na ficha.

Plano: `.cursor/plans/pipeline_participacao_fd2b34be.plan.md`

## 2. Critérios de aceite

### Negócio

- [ ] Aba **Pipeline** no menu, rota `/pipeline`
- [ ] Kanban com 9 colunas (Selecionada → Cancelada); Perdida derivada de Homologada + `!vencedor`
- [ ] KPIs: No pipeline, Em disputa, Homologadas, Valor em jogo
- [ ] 3 views: Kanban, Cards, Tabela
- [ ] Busca por código PNCP, órgão, objeto
- [ ] Filtro Arquivadas / restaurar
- [ ] Drag-and-drop entre colunas atualiza status
- [ ] Modal **Importar por PNCP** (resolver + criar card)
- [ ] Botão **Participar** na ficha `/contratacoes/:id`
- [ ] CTA "Buscar oportunidades" → `/contratacoes`
- [ ] Empty state honesto quando lista vazia

### Técnico

- [ ] Migration `tenant_pipeline_item` + schema.ts
- [ ] Funções puras: `displayStatus`, KPIs, drag mapping
- [ ] `GET/POST/PUT/PATCH/DELETE /api/pipeline` + `POST /api/pipeline/resolver-pncp`
- [ ] Auth via JWT tenant (`getAuthenticatedTenantId`) — nunca `tenantId` do body
- [ ] Unique `(tenant_id, numero_controle_pncp)`; 409 em duplicata
- [ ] Testes: `__pipeline_status__`, `__pipeline_kpis__`, `__pipeline_persist__`, `__pipeline_import__`
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In scope

1. Schema + status/KPI puros + testes TDD
2. Persistência + rotas JWT
3. UI board (empty, 3 views, KPIs, import, drag, arquivo)
4. Botão Participar na ficha + 409 navega ao board

### Out of scope

- Ficha `/pipeline/:id`
- Robô Comprasnet / chat do pregão
- Paywall / trial
- Portais BEC, BLL, Licitações-e
- Auto-sync de fase a partir da situação PNCP
- Estender `crm_deals` / agentes RevOps
- WhatsApp de prazo de proposta

## 4. Colunas do board

| Coluna | Chave persistida |
|--------|------------------|
| Selecionada | `SELECIONADA` |
| Análise | `ANALISE` |
| Proposta | `RECEBENDO_PROPOSTA` |
| Lance | `FASE_LANCE` |
| Sessão | `SESSAO_PUBLICA` |
| Recurso | `RECURSO` |
| Homologada | `HOMOLOGADA` + `vencedor=true` |
| Perdida | `HOMOLOGADA` + `vencedor=false` (display) |
| Cancelada | `CANCELADA` |

## 5. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| HAR com lista vazia | Contrato fechado via JS extraído; golden SESC para testes |
| `0009` tomado por outra migration | Usar próximo número livre |
| Confusão com CRM | Entidade separada `tenant_pipeline_item`; RevOps intocado |
| Import PNCP sem contratação local | `resolver-pncp` + ingest pontual existente |

## 6. Arquivos e áreas

- `server/db/migrations/0009_tenant_pipeline.sql`
- `server/lib/pipeline/` (types, status, kpis, persist, import-pncp)
- `server/routes/pipeline.ts`
- `src/components/PipelineView.tsx` + `src/components/pipeline/*`
- `src/types/pipeline.ts`
- `src/components/contratacoes/ContratacaoDetailView.tsx`
- `src/App.tsx`, `src/components/Sidebar.tsx`

## 7. Goldens

| Golden | Controle | Papel |
|--------|----------|-------|
| SESC CE 026 | `03612122000127-1-000026/2026` | Import + Participar + card no board |

## 8. Rastreabilidade

- **Plano:** `.cursor/plans/pipeline_participacao_fd2b34be.plan.md`
- **HAR ref:** `PIPELINE.har` (não versionar — contém tokens)
- **Benchmark:** Licinexus `/minhas-licitacoes`
- **Área:** `area:ui`, `area:api`
- **Prioridade:** P1

---
> v1: board only — sem ficha de detalhe, sem robô, sem paywall.
