# PRD v2 — Plataforma Nacional de Inteligência de Licitações

**Produto:** Monitor de Licitações · **Versão:** 2.1 · **Status:** Draft técnico  
**Fontes Tier 1:** PNCP + Compras.gov.br (Dados Abertos)

## Visão

Plataforma para descobrir, coletar, normalizar, relacionar e interpretar dados públicos de contratações — do planejamento/IRP até contratos e execução.

## Princípios

1. O documento oficial é a fonte de verdade.
2. O banco estruturado é a camada de acesso.
3. A IA é a camada de interpretação.
4. Nenhuma entidade derivada perde rastreabilidade até o registro público de origem.

## Centro do produto: ITEM

Busca, preço, fornecedor e oportunidade operam no nível item, não só no `objeto` da contratação.

## Fontes Tier 1 (atualizado)

```text
                 PUBLIC PROCUREMENT SOURCES

          ┌──────────────┼───────────────┐
          ↓              ↓               ↓
        PNCP       Compras.gov.br      futuras
          │              │
          │        ┌─────┼──────────┐
          │        ↓     ↓          ↓
          │      PGC   CATMAT     CATSER
          │        │     │          │
          │        │     └────┬─────┘
          │        │          ↓
          │        │     catálogo oficial
          │        │
          │        ├── contratações 14.133
          │        ├── resultados / fornecedor
          │        ├── pesquisa de preços
          │        ├── ARP / saldos / adesões
          │        └── contratos (com fallback)
          │
          └──────────────┬───────────────
                         ↓
                    RAW SOURCE
                         ↓
                    NORMALIZER
                         ↓
                 CANONICAL DATA MODEL
                         ↓
                    PROCUREMENT GRAPH
```

| Fonte | Base URL | Papel |
|-------|----------|-------|
| PNCP | `pncp.gov.br` | Contratação nacional, documentos, search, PCA |
| Compras.gov Dados Abertos | `dadosabertos.compras.gov.br` | Catálogo, PGC/DFD, resultados, preços, ARP, contratos |
| Comprasnet Web (frontend) | `cnetmobile.../comprasnet-fase-externa` | **Não** sync — link humano ou capture-on-click |

Ver [PNCP-ENDPOINT-MAP.md](./PNCP-ENDPOINT-MAP.md) e [COMPRAS-GOV-ENDPOINT-MAP.md](./COMPRAS-GOV-ENDPOINT-MAP.md).

**Plano de execução:** [PLAN-tier1-compras-gov-enrichment.md](./plans/PLAN-tier1-compras-gov-enrichment.md) · **Issue:** [#79](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/79)

## Fase 1 Core (implementação atual)

**Escopo:** `source_record` → órgão/unidade → contratação → item → documento + snapshots/eventos + API + timeline + sync idempotente.

**Fora:** RAG, embeddings, IRP live, ingest ARP/contratos completo, motor de preços, download PDF.

**Stack:** TypeScript, Express, Drizzle, Neon PostgreSQL.

## Golden Records

| Domínio | Registro |
|---------|----------|
| Search → Contratação | SESC CE Pregão 6/2026 — `03612122000127-1-000026/2026` |
| PCA PNCP | Gabinete Civil AL — `12200267000101-0-000001/2026` |
| Contratação PNCP rica | Passex 103/2026 — `00394452000103-1-019732/2026` (17 itens, PNCP suficiente) |
| Compras.gov contratação | SESC CE — `idCompra=45102305000062026` |
| Compras.gov PGC | Gabinete Civil — `orgao=12200267000101`, ano 2026 |
| CATMAT | Item `261521` (SWITCH, PDM 5522) |

## Sequência conceitual

```text
PGC/PCA → IRP → Contratação → Itens → Documentos → Resultado → ARP → Contrato → Eventos
```

## Oportunidades (tipos)

```text
NEW_TENDER | PCA_DEMAND | IRP | ARP_AVAILABLE | CONTRACT_EXPIRING | RECURRING_PURCHASE
```

ARP com saldo/adesão habilitada via módulo 08 Compras.gov (v2.0 manual).

## Critérios de aceite Fase 1

1. Descobrir e persistir payload original (PNCP + Compras.gov quando aplicável)
2. Normalizar órgão, unidade, contratação, itens
3. Pesquisar item individualmente
4. Catálogo de documentos com URL oficial
5. Re-sync sem duplicação
6. Detectar alterações (snapshot + event + timeline)
7. API interna autenticada
8. Projeção tenant→editais via item ou objeto
9. **Novo:** enriquecer `idCompra` e CATMAT via Compras.gov Dados Abertos sem captcha
