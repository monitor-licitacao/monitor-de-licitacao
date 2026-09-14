## 1. Objetivo

Simplificar **Novo contrato (manual)** para derivar dados de **Contratações PNCP** já ingeridas — eliminando digitação livre de CNPJ, nº e itens.

**Por quê:** Print 2 mostra CNPJ BrasilAPI falhando para órgão válido; o painel [ContratacaoItensPanel](src/components/contratacoes/ContratacaoItensPanel.tsx) já tem objeto, itens, catálogo e preços — duplicar no modal é complexidade desnecessária.

## 2. Critérios de Aceite

### UX modal v2
- [ ] Dropdown **Contratação** (lista `/api/contratacoes`) — obrigatório
- [ ] Dropdown **Nº do contrato** com opções do resumo (PNCP, processo, edital, compra) — não campo texto livre
- [ ] **Órgão** preenchido automaticamente a partir da contratação; CNPJ não editável
- [ ] **Itens** exibidos read-only (shape do `ContratacaoItensPanel`); sem “+ Adicionar item” / autocomplete CATMAT
- [ ] Vigência, valor global e objeto ainda editáveis; valor default = soma itens ou total homologado
- [ ] Botão “Registrar como contrato” na ficha `/contratacoes/:id` abre modal pré-selecionado

### CNPJ / órgão (Print 2)
- [ ] Auditar BrasilAPI com goldens (SESC, Passex); log provider + status
- [ ] Fallback: `orgao_registry` populado de `contratacao.cnpj_orgao` + razão social conhecida
- [ ] Mensagem UI: verde quando API ok; âmbar “Usando dados da contratação” quando registry/local — não exigir nome manual

### API
- [ ] `GET /api/contratos/manual/sources` — contratações + números sugeridos
- [ ] `POST /api/contratos/manual` aceita `contratacao_id` + `item_numeros[]`; servidor monta itens
- [ ] `tenant_contract.contratacao_id` persistido

### Técnico
- [ ] Mapper `ContratacaoItemRico` → `tenant_contract_item` com testes
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In Scope
- Refatoração [ContratoManualModal.tsx](src/components/contratos/ContratoManualModal.tsx)
- Mapper + registry órgão + endpoints acima
- Deep link desde [ContratacaoDetailView.tsx](src/components/contratacoes/ContratacaoDetailView.tsx)

### Out of Scope
- Reescrever ContratacaoItensPanel (só consumir mesmo shape)
- Backlog fase 2 (paywall, WhatsApp, CG módulo 09) — ver `ISSUE-contratos-fase2-backlog.md`
- Cadastro manual **sem** contratação no sistema (manter endpoint v1 legado ou 410 — decidir no PR)

## 4. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Contratação sem itens PNCP | permitir contrato só com resumo; itens vazios ok |
| Orçamento sigiloso | incluir linhas com valores null; health `valor_vs_mercado` neutro |
| Lista contratações grande | paginar sources; busca por q= no dropdown |
| BrasilAPI fora | registry-first; nunca bloquear criação se contratação tem órgão |

## 5. Arquivos e Áreas Prováveis

- Plano: `.cursor/plans/contratos_manual_contratacao.plan.md`
- `server/lib/contratos/map-contratacao-items.ts` (novo)
- `server/lib/contratos/orgao-registry.ts` (novo)
- `server/db/migrations/0009_orgao_registry.sql` (novo)
- `server/lib/contratos/cnpj-lookup.ts`
- `server/lib/contratos/persist.ts`
- `server/routes/contratos.ts`
- `src/components/contratos/ContratoManualModal.tsx`
- `src/components/contratacoes/ContratacaoDetailView.tsx`

## 6. Testes Obrigatórios

- [ ] `__contratos_manual_v2__.test.ts` — mapper + validação contratacao_id
- [ ] `__orgao_registry__.test.ts` — seed + lookup
- [ ] Smoke browser: Contratações → Registrar contrato → dashboard

## 7. Rastreabilidade

- **Plano:** `.cursor/plans/contratos_manual_contratacao.plan.md`
- **Painel v1:** `.cursor/plans/painel_de_contratos_cce01633.plan.md` § Cadastro manual
- **Dados:** `GET /api/contratacoes/:id` + [ContratacaoItensPanel.tsx](src/components/contratacoes/ContratacaoItensPanel.tsx)
- **Área:** `area:contratos`, `area:ui`
- **Prioridade:** P0 (feedback imediato Print 2)

---
> Meta: modal com 1 dropdown + confirmação, não planilha manual.
