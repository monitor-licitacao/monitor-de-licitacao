# Mapa Compras.gov.br — API Dados Abertos → entidade PRD v2

> Atualizado: 13/09/2026 · Base: [Swagger oficial](https://dadosabertos.compras.gov.br/swagger-ui/index.html) · Manual v2.0 (fev/2026)  
> Golden Records: Passex `00394452000103-1-019732/2026` · SESC CE `03612122000127-1-000026/2026` · Gabinete Civil PGC `12200267000101` / 2026 · CATMAT `261521`

## Política de fontes (Tier 1)

```text
SOURCE TIER 1
├── PNCP                    → contratação nacional, documentos, search
└── Compras.gov.br/SIASG    → catálogo, PGC/DFD, resultados, preços, ARP, contratos
```

**Distinção crítica** (confirmada em discussões oficiais no catálogo dados.gov.br):

| Superfície | Base | Classe | Ingest server-side |
|------------|------|--------|-------------------|
| API Dados Abertos | `dadosabertos.compras.gov.br` | **Classe A — oficial** | ✅ Sim |
| Frontend Comprasnet Web | `cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa` | **Classe B — observada** | ❌ Sync (P1 efêmero) · ✅ link humano |

---

## Módulo 07 — Contratações Lei 14.133

| Endpoint | Parâmetros chave | Entidade PRD | Fixture |
|----------|------------------|--------------|---------|
| `GET /modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id` | `tipo=idCompra\|numeroControlePNCPCompra`, `codigo` | `contratacao` (+ `id_compra`) | `fixtures/sesc-ce-026-contratacao.json` |
| `GET /modulo-contratacoes/2.1_consultarItensContratacoes_PNCP_14133_Id` | idem | `item` enriquecido | — |
| `GET /modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133` | `dataResultadoPncpInicial/Final` (obrig.) | `item` + fornecedor/preço | — |

### Campos exclusivos / enriquecedores vs PNCP

| Campo Compras.gov | Utilidade |
|-------------------|-----------|
| `idCompra` | Chave SIASG → link frontend + demais módulos |
| `descricaoDetalhada` | Spec técnica além da descrição PNCP |
| `codigoGrupo`, `codigoClasse`, `codItemCatalogo` | Ponte CATMAT/CATSER |
| `temResultado`, `codFornecedor`, `valorUnitarioResultado` | Resultado homologado por item |
| `existeResultado` | Flag rápida na contratação |

### Golden Passex 19732 — PNCP suficiente (13/09/2026)

Aviso Contratação Direta nº 103/2026 — 6º Batalhão Comunicação/RS — [`00394452000103/2026/19732`](https://pncp.gov.br/app/editais/00394452000103/2026/19732)

Fixtures: `server/lib/compras-gov/fixtures/passex-19732/` · Captura: `doc/Acompanhar Contratação.har`

| Fonte | Itens | Valores | Descrição | NCM |
|-------|-------|---------|-----------|-----|
| PNCP Classe B `/itens` | **17** | ✅ | **longa (spec)** | ✅ |
| Compras.gov **fase-externa** `/itens?captcha` | 17 (HAR p0=10) | ✅ alinhado | curta | ❌ |
| Compras.gov **Dados Abertos** `2.1` | **0** | total contratação ✅ | — | — |

**Regra demonstrada:** quando `orcamentoSigiloso=false`, ingest PNCP Classe A+B cobre o produto; Compras.gov fase-externa é redundante; Dados Abertos itens pode vir vazio.

Item 9: Esteira Elétrica — R$ 11.600/un (fitness no lote hospitalar).

---

### Golden SESC CE — comparação live (13/09/2026)

| Aspecto | PNCP | Compras.gov Dados Abertos |
|---------|------|---------------------------|
| Contratação metadata | ✅ | ✅ alinhado |
| Itens | ✅ 14 itens (valores sigilosos zerados) | ⚠️ 0 itens (compra anulada / lag) |
| Sigilo | `orcamentoSigilosoCodigo=3` | `orcamentoSigilosoCodigo=1` (divergência) |
| Frontend Compras.gov | — | Mostra valores estimados na UI (Classe B) |

---

## Módulo 04 — PGC (planejamento / DFD)

| Endpoint | Parâmetros | Entidade PRD |
|----------|------------|--------------|
| `GET /modulo-pgc/1_consultarPgcDetalhe` | **`orgao`** (CNPJ), **`anoPcaProjetoCompra`**, opc. `codigoUasg` | `pgc_dfd` (futuro) · enriquece `pca_item` |

### Campos relevantes

```text
ordemDfd, descricaoObjetoDfd, nivelPrioridadeDfd
dataPrevistaFormalizacaoDemanda
tipoItem (M/S)
codigoGrupoMaterial → codigoClasseMaterial → codigoPdmMaterial → codigoItemCatalogo
quantidadeItem, valorUnitarioItem, valorTotalItem
```

**Golden Gabinete Civil AL 2026:** 70 registros PGC (amostra: DFD 34 — modelo anatômico, CATMAT 330384).

Complementa PCA PNCP:

```text
PCA (PNCP)          PGC (Compras.gov)
  grupo contratação     DFD + prioridade
  item + PDM            data formalização demanda
  data desejada         hierarquia CATMAT completa + valores
```

---

## Módulo 02 — CATMAT

| Endpoint | Uso PRD |
|----------|---------|
| `GET /modulo-material/3_consultarPdmMaterial` | Normalização PDM |
| `GET /modulo-material/4_consultarItemMaterial` | `catalog_item` tipo CATMAT |

**Golden:** `codigoItem=261521` → PDM 5522 SWITCH, NCM 85176234, grupo/classe TIC.

Parâmetro `tamanhoPagina`: intervalo **10–500**.

---

## Módulo 02 — CATSER

Equivalente hierárquico para serviços: Seção → Divisão → Grupo → Classe → Subclasse → Item.

Entidade alvo: `catalog_item` com `catalog_type=CATSER`.

---

## Módulo 03 — Pesquisa de Preços

Material / Serviço (+ detalhe, JSON e CSV).

Cruzamento proposto:

```text
price_observation ← PNCP resultados
                  ← Compras.gov Pesquisa de Preços
                  ← histórico Compras RJ (legado)
```

---

## Módulo 08 — ARP

Endpoints v2.0: ARP, itens, **unidades participantes**, **empenhos/saldo**, **adesões (caronas)**.

Oportunidade comercial: `OPPORTUNITY_TYPE.ARP_AVAILABLE` — radar de saldo + fornecedor + adesão.

---

## Módulo 09 — Contratos

⚠️ Comunicado **Nº 18/26** — instabilidade no módulo Contratos (mai/2026). Exigir `source_health`, retry, fallback PNCP.

---

## Módulo Fornecedor + OCDS

- Fornecedor: enriquecimento de `codFornecedor` / CNPJ
- OCDS Releases: interoperabilidade futura

---

## Implementação no repo

| Artefato | Caminho |
|----------|---------|
| Client | `server/lib/compras-gov/client.ts` |
| Compare PNCP↔CG | `server/lib/compras-gov/compare-pncp.ts` |
| Fixtures | `server/lib/compras-gov/fixtures/` |
| Script compare | `npm run compras-gov:compare-golden` |
| Testes | `__compras_gov_open_data__.test.ts` |

### Chaves de ligação entre fontes

```text
numeroControlePNCP  ←→  numeroControlePNCPCompra
linkSistemaOrigem?compra=  →  idCompra
codigoItem / codItemCatalogo  →  CATMAT/CATSER
orgao (CNPJ) + anoPcaProjetoCompra  →  PGC ↔ PCA
```

---

## Testes de contrato

- `__compras_gov_open_data__.test.ts` — contratação SESC, PGC Gabinete, CATMAT 261521
- `__passex_golden__.test.ts` — Passex 19732: PNCP 17 itens, CG fase-externa alinha valores, DA itens vazio
- `scripts/compras_gov_compare_golden.ts` — diff campo a campo PNCP vs Compras.gov
