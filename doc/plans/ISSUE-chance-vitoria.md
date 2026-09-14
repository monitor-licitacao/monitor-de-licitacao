> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/86

## 1. Objetivo

Implementar o **motor determinístico de chance de vitória** na ficha da contratação (4 fatores da Licinexus) + corpus de preço com filtro de fontes + módulo de denúncia no alerta de sobrepreço.

**Por quê:** sem resultado homologado, CNPJ do tenant e unidade canônica, qualquer percentual é alucinação. O PRD v2 proíbe entidade derivada sem rastreio (`source_record_id`). A IA **não inventa o número**.

Plano: `.cursor/plans/chance_de_vitória_78aee61e.plan.md` (espelho abaixo em `doc/plans/PLAN-chance-vitoria.md` quando versionado).

## 2. Critérios de aceite

### Negócio

- [ ] Ficha da contratação: card com % + confiança (`ALTA` / `MEDIA` / `BAIXA` / `INSUFICIENTE`)
- [ ] Aba **Inteligência** com os 4 fatores; fator sem evidência **sai da média** (não entra como 50%)
- [ ] Relação com o órgão usa CNPJ(s) de `tenant_party` + CRM ganho/perdido
- [ ] Concorrentes: top 5 com `reliability_score`; lista vazia se não houver corpus (nunca inventar nome)
- [ ] Viabilidade de preço por item: mediana, P25–P50, `n`, desvio, fonte
- [ ] Filtro **Fonte do preço**: Todas / Painel de Preços / PNCP (processos + atas RP) / IRP / Compras.gov.br / CMED / BPS / Compras-MG
- [ ] Alerta inexequível (`< P25 * 0.70`) multiplica a chance por 0,70
- [ ] Alerta sobrepreço (`> P75 * 1.50`) **não** mexe no % e oferece dossiê de denúncia (CGU/TCU/MPF ou TCE/MPE)
- [ ] Denúncia não protocola sozinha; copy sem a palavra crime

### Técnico

- [ ] Migration: `tenant_party`, `fornecedor`, `resultado_item`, `price_observation`, `win_assessment`, `unidade_canonica`
- [ ] Client PNCP `GET .../itens/{n}/resultados` + persistência idempotente
- [ ] Backfill CG `fetchResultadosItens14133` (já no client) sem duplicar chave
- [ ] Painel / CG módulo 03 só com `catalogoCodigoItem`; atas RP em `fonte=pncp`; IRP em `fonte=irp`
- [ ] IRP/item sigiloso: padrão #79 (`LINK_COMPRASNET_ONLY` + persistir item; **não** entra na mediana)
- [ ] Join: CATMAT → PDM → NCM + unidade canônica (`UNIDADE`/`UND`/`UNID.` → `UN`)
- [ ] `GET /api/contratacoes/:id/chance-vitoria` e `GET /api/denuncia/canais?uf=&esfera=`
- [ ] Testes puros em `server/lib/win-chance/` — sem Gemini, sem rede
- [ ] `npm test` + `npm run lint` verdes
- [ ] **Zero** sync `comprasnet-fase-externa?captcha=`

## 3. Escopo

### In scope

1. Schema + `tenant_party` + `unidade_canonica` + calculadoras (`formula_version = 1`)
2. Ingest PNCP resultados + `price_observation`
3. Backfill CG 07 + Painel (CATMAT) + atas RP + IRP (mesmo peso em `todas`)
4. API + aba Inteligência + filtro de fonte + alertas
5. Canais de denúncia + dossiê (só sobrepreço)
6. CNPJ do tenant nas Settings + cruzamento CRM

### Out of scope

- LLM narrando a chance
- Ingest CMED / BPS / Compras-MG (só rótulo no filtro, `n = 0`)
- Mercado Livre
- Valor sigiloso na mediana (SESC: CG 2.1 não abre o estimado)
- Dump nacional / protocolo automático Fala.BR/TCU/MPF
- % calculado em lote na listagem

## 4. Fórmula (`formula_version = 1`)

- Relação com o órgão **35%**
- Concorrentes (`100 - ameaça`) **35%**
- Viabilidade de preço **30%**
- Alerta inexequível: penalidade `× 0.70` (não é score)

`chance = media_ponderada(fatores_com_dados) * penalidade_alerta`

## 5. Riscos e mitigações

- **IRP ≠ ata/resultado** (estimado vs registrado): *Mitigação* — `natureza = estimado|registrado|homologado`; filtro permite excluir IRP
- **Índice IRP vigente vazio** (HAR 13/09/2026 `total: 0`): *Mitigação* — walk `/api/pncp/.../irp/.../itens`
- **Sigilo**: *Mitigação* — mesmo padrão #79; não scrape fase-externa
- **Unidade fragmentada** (`UN` vs `UNIDADE`): *Mitigação* — `unidade_canonica` antes do upsert e do join
- **Dedup Painel × Compras.gov**: *Mitigação* — chave `numero_controle_pncp + numero_item + ni_fornecedor`
- **Dependência #79** (enrich sigilo / CATMAT): *Mitigação* — reutilizar `enrichment-policy.ts`, não reabrir captcha

## 6. Arquivos e áreas

- `server/lib/win-chance/` (calculadoras + testes)
- `server/lib/pncp/` (client resultados + atas + IRP)
- `server/lib/compras-gov/` (módulo 03 + job irmão de `jobs.ts`)
- `server/db/migrations/` (0005+)
- `server/routes/contratacoes.ts` + rota denúncia
- `src/components/contratacoes/ContratacaoDetailView.tsx` / `ContratacaoItensPanel.tsx`

## 7. Goldens

| Golden | Controle | Papel no motor |
|--------|----------|----------------|
| Passex 103/2026 | `00394452000103-1-019732/2026` | 17 itens + NCM; join por NCM + unidade (`catalogoCodigoItem` null) |
| SESC CE 026 | `03612122000127-1-000026/2026` | Sigilo → fator preço `INSUFICIENTE`; enrich parcial #79 |
| CATMAT 261521 | PDM 5522 | Ponte Painel / módulo 03 |

## 8. Sequência de PRs

1. Schema + unidade canônica + scorers puros
2. Client PNCP resultados + `price_observation`
3. CG 07 + Painel + atas + IRP
4. API + aba Inteligência + alertas
5. Denúncia (só sobrepreço)
6. Settings CNPJ + CRM

## 9. Rastreabilidade

- **PRD:** `doc/PRD-v2-plataforma-inteligencia-licitacoes.md` v2.1
- **Plano:** `.cursor/plans/chance_de_vitória_78aee61e.plan.md`
- **Cruzamento CATMAT:** `.cursor/plans/cruzamento_catmat_9d64d9fd.plan.md`
- **Dependências:** #79 (enrich), #81/#82 (domínios PNCP)
- **Benchmark:** [Licinexus inteligência de preços](https://www.licinexus.com.br/inteligencia-precos)
- **Área:** `area:ingestao`, `area:api`, `area:ui`
- **Prioridade:** P1

---
> Decisões 13/09/2026: IRP entra na mediana com o mesmo peso (`fonte=irp`); sigiloso segue #79 e não entra na mediana; Mercado Livre fora do produto; denúncia não mexe no %.
