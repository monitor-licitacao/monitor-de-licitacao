## 1. Objetivo

Implementar o pipeline **PNCP-first** com enriquecimento seletivo via API oficial [Compras.gov Dados Abertos](https://dadosabertos.compras.gov.br/swagger-ui/index.html), conforme PRD v2.1 e plano `doc/plans/PLAN-tier1-compras-gov-enrichment.md`.

**Por quê:** investigação com 4 goldens provou que PNCP Classe B já cobre itens quando `orcamentoSigiloso=false` (Passex 19732 — 17 itens). Compras.gov entra para catálogo (CATMAT/CATSER), PGC/DFD, metadata (`idCompra`), resultados e ARP — **não** para duplicar ingest de itens.

## 2. Critérios de Aceite

### Negócio
- [ ] Contratação ingerida via PNCP exibe links "Ver no PNCP" e "Acessar Contratação" (Compras.gov)
- [ ] Passex 19732: 17 itens persistidos só via PNCP; `id_compra` enriquecido via Dados Abertos
- [ ] Gabinete Civil: PGC/DFD ingerido via `/modulo-pgc/1_consultarPgcDetalhe`
- [ ] CATMAT item 261521 resolvível no catálogo interno

### Técnico
- [ ] Migration: `id_compra`, `catalog_item`, `pgc_dfd`, `source_health`
- [ ] Worker `ENRICH_COMPRAS_GOV` pós-ingest PNCP com política condicional (ver plano)
- [ ] **Zero** sync automatizado para `comprasnet-fase-externa?captcha=`
- [ ] Testes: `__passex_golden__`, `__compras_gov_enrich__` (novo), goldens existentes
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In Scope
- Fase B: schema + persist CG Dados Abertos
- Fase C: worker ENRICH_COMPRAS_GOV
- Fase D: job DISCOVER_QUERY (Search → PNCP ingest → enrich)
- Fase E: botões UI + endpoint enriquecimento
- Política `enrichment-policy.ts` (PNCP_SUFFICIENT | CG_METADATA | CG_CATALOG | LINK_ONLY)

### Out of Scope
- ARP/contratos ingest completo (módulo 09 instável — Comunicado 18/26)
- Matching PCA↔PGC probabilístico (Fase F — issue futura)
- Headless browser / replay captcha P1
- RAG / embeddings

## 4. Riscos e Mitigações

- **CG Dados Abertos itens vazios** (Passex, SESC): *Mitigação* — nunca substituir itens PNCP; usar PNCP Classe B como canônico
- **Módulo Contratos instável**: *Mitigação* — `source_health` + skip com retry
- **tsx/Bun dev broken (#78)**: *Mitigação* — resolver antes de integrar worker ao `npm run dev`

## 5. Arquivos e Áreas Prováveis

- `doc/plans/PLAN-tier1-compras-gov-enrichment.md` (plano)
- `server/lib/compras-gov/` (client ✅, persist, jobs, enrichment-policy)
- `server/workers/compras_gov_enrich.ts`
- `server/db/migrations/0003_compras_gov_enrichment.sql`
- `src/components/ContratacoesView.tsx`
- `server/routes/contratacoes-v1.ts`

## 6. Goldens de validação

| Golden | Controle | Teste |
|--------|----------|-------|
| Passex 103/2026 | `00394452000103-1-019732/2026` | PNCP suficiente, CG itens vazio |
| SESC CE 026 | `03612122000127-1-000026/2026` | Search + sigilo |
| Gabinete PGC | `12200267000101` / 2026 | 70 DFDs |
| CATMAT | codigoItem `261521` | SWITCH PDM 5522 |

## 7. Testes Obrigatórios

- [ ] `npm test`
- [ ] `npm run compras-gov:compare-golden`
- [ ] Ingest fixture Passex + validate DB

## 8. Rastreabilidade

- **PRD:** `doc/PRD-v2-plataforma-inteligencia-licitacoes.md` v2.1
- **Mapas:** `doc/COMPRAS-GOV-ENDPOINT-MAP.md`, `doc/PNCP-ENDPOINT-MAP.md`
- **Plano:** `doc/plans/PLAN-tier1-compras-gov-enrichment.md`
- **Área:** `area:ingestao`, `area:api`, `area:ui`
- **Prioridade:** P0

---
> Baseado na investigação live PNCP vs Compras.gov (Passex, SESC, Gabinete). Compras.gov Dados Abertos = Tier 1; fase-externa = link humano apenas.
