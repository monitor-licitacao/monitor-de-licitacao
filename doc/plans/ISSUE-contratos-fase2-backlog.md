## 1. Objetivo

Implementar o **backlog pós-MVP** do Painel de Contratos — itens do clone Licinexus que ficaram explicitamente fora do [painel v1](.cursor/plans/painel_de_contratos_cce01633.plan.md).

**Por quê:** v1 entregou portfolio tenant funcional; estes itens são extensões de produto, integrações instáveis ou monetização — cada um com risco e PRD próprios.

## 2. Critérios de Aceite

### WhatsApp vencimento (P1)
- [ ] Worker/cron identifica contratos com vigência em `(0, 90]` dias ou status saúde `critico`
- [ ] Mensagem WhatsApp com objeto, nº, órgão, dias restantes e link para detalhe
- [ ] Dedupe — não reenviar o mesmo alerta no mesmo dia
- [ ] Opt-in por tenant (config existente ou nova flag)

### Compras.gov módulo 09 (P2)
- [ ] Ingest opcional de contratos CG quando PNCP sync não trouxe linha
- [ ] `source_health` registra falha; worker faz skip sem quebrar fila
- [ ] Idempotente por `numero_controle_pncp` ou `(orgao_cnpj, numero_contrato_empenho)`
- [ ] Manual tenant **não** sobrescrito (mesma regra v1)

### Assinatura digital ofício (P3)
- [ ] Campo `assinado_em` + hash do PDF em `tenant_contract_oficio`
- [ ] Fluxo documentado (Gov.br / certificado) — sem assinatura fake
- [ ] PDF gerado continua baixável sem assinatura

### Paywall / trial (P4)
- [ ] Limite de contratos ou features por plano
- [ ] UI honesta (CTA upgrade, não sumiço silencioso de dados)
- [ ] Sync PNCP continua persistindo; paywall afeta visualização/ações premium

### Gov empenho/liquidação (P5 — spike)
- [ ] Documento de mapeamento HAR `/api/v1/gov/*` → fontes PNCP/CG
- [ ] Decisão: módulo separado vs. escopo futuro

## 3. Escopo

### In Scope
- Itens listados no plano `.cursor/plans/contratos_fase2_backlog.plan.md`
- Integração com `tenant_contract`, health engine v1, workers existentes

### Out of Scope
- Refatoração do Painel v1 já entregue
- Modal manual simplificado (issue separada: `ISSUE-contratos-manual-contratacao.md`)
- Chance de vitória / inteligência comercial

## 4. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Compras.gov módulo 09 instável | `source_health` + skip; PNCP-first permanece canônico |
| WhatsApp spam | dedupe + opt-in + limite diário |
| Paywall quebra confiança | nunca apagar dados; degradar UI/actions |
| Assinatura digital regulatória | spike legal + Gov.br antes de implementar |

## 5. Arquivos e Áreas Prováveis

- `.cursor/plans/contratos_fase2_backlog.plan.md`
- `server/workers/pncp_contratos.ts` (extensão CG)
- `server/workers/` — novo `contratos_vencimento_alert.ts`
- `server/lib/contratos/oficios.ts` — assinatura
- `src/components/WhatsAppNotificationsView.tsx`
- `server/db/schema.ts` — `tenant_configs` / plan tier

## 6. Testes Obrigatórios

- [ ] `npm test` (novos testes por fatia)
- [ ] `npm run lint`
- [ ] Smoke worker WhatsApp com fixture de datas

## 7. Rastreabilidade

- **Plano v1:** `.cursor/plans/painel_de_contratos_cce01633.plan.md` § Fora deste plano
- **Plano fase 2:** `.cursor/plans/contratos_fase2_backlog.plan.md`
- **Área:** `area:contratos`, `area:workers`, `area:integracao`
- **Prioridade:** P1 WhatsApp → P2 CG09 → P3 assinatura → P4 paywall → P5 gov

---
> Não reimplementar o Painel v1. Cada item deste backlog fecha em PR isolado com testes próprios.
