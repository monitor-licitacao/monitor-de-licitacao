# Plano de execução — Tier 1 Compras.gov + Enriquecimento condicional

**Versão:** 1.0 · **Data:** 13/09/2026  
**PRD:** [PRD-v2](../PRD-v2-plataforma-inteligencia-licitacoes.md) v2.1  
**Mapas:** [PNCP-ENDPOINT-MAP](../PNCP-ENDPOINT-MAP.md) · [COMPRAS-GOV-ENDPOINT-MAP](../COMPRAS-GOV-ENDPOINT-MAP.md)  
**Issue GitHub:** [#79 — Tier 1 Compras.gov enriquecimento condicional](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/79)

---

## Contexto

Investigação concluída com 4 goldens e política de fontes refinada:

| Golden | Lição |
|--------|-------|
| Passex 19732 | PNCP Classe B **suficiente** (17 itens, valores, NCM) |
| SESC CE 026 | Sigilo — PNCP zera valores; link Compras.gov UI |
| Gabinete PCA/PGC | Compras.gov PGC enriquece planejamento |
| CATMAT 261521 | Compras.gov Dados Abertos para catálogo |

**Regra:** ingest default = PNCP A+B; Compras.gov Dados Abertos = enriquecimento seletivo; fase-externa = link humano, sem sync.

---

## Objetivo

Implementar pipeline **PNCP-first** com job de enriquecimento Compras.gov (Dados Abertos) e UX de navegação oficial, sem duplicar ingest de itens quando PNCP já cobre.

---

## Fases

### Fase A — Fundação (✅ concluída)

- [x] `ComprasGovOpenDataClient` + types + compare PNCP↔CG
- [x] Fixtures + testes: SESC, Passex, PGC Gabinete, CATMAT
- [x] PRD v2.1 Tier 1 + COMPRAS-GOV-ENDPOINT-MAP
- [x] Golden Passex — prova PNCP suficiente

### Fase B — Schema e persistência (✅ concluída)

- [x] Coluna `id_compra` em `contratacao`
- [x] Tabela `catalog_item` (CATMAT | CATSER)
- [x] Tabela `pgc_dfd`
- [x] `source_health` reutiliza schema legado (`source` + `endpoint`)
- [x] Migration `0003_compras_gov_enrichment.sql` + `persist.ts`, `normalize-*.ts`
- [x] Testes idempotentes em `__compras_gov_enrich__.test.ts`

### Fase C — Worker ENRICH_COMPRAS_GOV (✅ concluída)

**Fluxo**

```text
contratacao ingerida (PNCP)
    ↓
resolve idCompra (link ou CG 1.1 por numeroControlePNCP)
    ↓
SE orcamento_sigiloso item-level OU itens PNCP vazios
    → CG 1.1 metadata + flag ENRIQUECIMENTO_PARCIAL
SENÃO
    → CG 1.1 apenas (idCompra, existeResultado, valor total)
    ↓
SE catalogoCodigoItem ou NCM presente
    → CG CATMAT/CATSER lookup
    ↓
source_health + entity_snapshot
```

**Não fazer**

- Sync `comprasnet-fase-externa` com captcha
- Re-ingest itens quando PNCP já tem 17/17 (Passex)

**Entregáveis**

- [x] `enrichment-policy.ts` — matriz PNCP_SUFFICIENT / CG_METADATA_ONLY / etc.
- [x] `jobs.ts` — `runEnrichContratacao`, `runEnrichPgc`, `enqueueEnrichComprasGovJob`, `processNextEnrichJob`
- [x] `server/workers/compras_gov_enrich.ts` — CLI `--controle`, `--pgc`, `--poll`
- [x] `scripts/compras_gov_enrich_fixture.ts` — SESC + PGC sem rede
- [x] Testes policy + job mock adapter em `__compras_gov_enrich__.test.ts`
- [x] Scripts npm: `worker:compras-gov`, `compras-gov:enrich-fixture`

**Validação (fixtures)**

| Golden | Resultado |
|--------|-----------|
| SESC CE 026 | `idCompra=45102305000062026`, `enrichmentPartial=true`, `fetchCgItems=false` |
| Gabinete PGC | 10 DFDs persistidos (sample fixture), `CG_PGC_PLANEJAMENTO` |
| Passex | `PNCP_SUFFICIENT` — policy não busca itens CG |

### Fase D — Search DISCOVER_QUERY (✅ concluída)

**Fluxo**

```text
query (ex. musculação)
    ↓
PncpSearchClient.fetchSearch
    ↓
resolveControleFromSearchHit
    ↓
ingestContratacaoBundle (PNCP A+B)
    ↓
enqueueEnrichComprasGovJob (condicional)
```

**Entregáveis**

- [x] `server/lib/pncp/search-client.ts` — índice `/contratacoes/publicacao`
- [x] `server/lib/pncp/resolve-controle.ts` — `resolveControleFromSearchHit`
- [x] `server/lib/pncp/ingest.ts` — `ingestContratacaoBundle` → `contratacao` + `item`
- [x] `server/lib/pncp/discover-jobs.ts` — `DISCOVER_QUERY` + job_queue
- [x] `server/workers/pncp_discover.ts` — CLI `--query` / `--poll`
- [x] Fixtures SESC: `server/lib/pncp/fixtures/sesc-ce-026-2026/`
- [x] `__pncp_search__.test.ts` — golden SESC 14 itens

**Scripts:** `worker:pncp-discover`, `pncp:discover-fixture`

### Fase E — API + UI (✅ concluída)

- [x] `GET /api/contratacoes` — lista contratações ingeridas
- [x] `GET /api/contratacoes/:id/enriquecimento` — idCompra, links, plan, catalog, PGC stub
- [x] `ContratacoesView` — botões "Ver no PNCP" + "Acessar Contratação"
- [x] `EnrichmentBadge` — PNCP suficiente vs enriquecimento parcial
- [x] `__contratacoes_enrichment__.test.ts` — golden SESC

### Fase F — PGC ↔ PCA matching (P2)

- Vínculo probabilístico `pca_contratacao` / `pgc_dfd` → contratação
- Pesos por categoria (PDM TIC, grupo serviço)
- Fora do escopo desta issue — apenas stub/documentar

---

## Matriz de decisão (implementar em código)

```typescript
// server/lib/compras-gov/enrichment-policy.ts
type EnrichmentDecision =
  | 'PNCP_SUFFICIENT'           // Passex: itens com valores
  | 'CG_METADATA_ONLY'          // idCompra + total contratação
  | 'CG_CATALOG_LOOKUP'         // codigoItem / NCM → CATMAT
  | 'CG_PGC_PLANEJAMENTO'       // orgao + ano
  | 'LINK_COMPRASNET_ONLY';     // sigiloso — sem sync API
```

---

## Testes obrigatórios

| Teste | Golden |
|-------|--------|
| `__passex_golden__.test.ts` | PNCP 17 itens, CG DA vazio |
| `__compras_gov_open_data__.test.ts` | Client + fixtures |
| `__compras_gov_enrich__.test.ts` | Job idempotente Passex + Gabinete PGC |
| `__pncp_search__.test.ts` | Search → ingest (SESC) |

Comandos: `npm test`, `npm run compras-gov:compare-golden`, `npm run lint`

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| CG Dados Abertos itens vazios | Nunca substituir PNCP itens; fallback PNCP |
| Módulo Contratos instável (Comunicado 18/26) | `source_health` + skip com log |
| API PNCP 500 intermitente | Retry + fixture golden |
| tsx ausente no dev (issue #78) | Fix Bun/tsx antes do worker |

---

## Definition of Done (gate)

- [x] Migration aplicada em Neon dev
- [x] Worker ENRICH roda nos goldens Passex/SESC/PGC (fixtures + testes)
- [x] UI com links oficiais PNCP + Compras.gov (Fase E)
- [x] Docs atualizados (este plano)
- [x] PR com testes verdes
- [x] Nenhuma chamada automatizada a `comprasnet-fase-externa?captcha=`

---

## Estimativa

| Fase | Esforço |
|------|---------|
| B — Schema | 1–2 dias |
| C — Worker | 2–3 dias |
| D — Search job | 1 dia |
| E — API/UI | 1 dia |
| **Total P0+P1** | **~5–7 dias** |
