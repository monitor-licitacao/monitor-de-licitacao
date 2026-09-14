> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/95

## 1. Objetivo

Criar o perfil da empresa em **dois domínios** — comercial e habilitação — sem transformar `tenant_party` numa tabela de tudo.

**Por quê:** o vídeo Licinexus cruza requisito do edital com documento da empresa (inclui certidão vencida). Comercial (CNAE/CATMAT/ticket) e habilitação (certidões/atestados com validade) não são a mesma entidade. Sem perfil, o score só diz “parece interessante”; com perfil: “parece interessante **para você**”.

## 2. Critérios de aceite

### Negócio

- [ ] Settings: CNPJ(s) em `tenant_party` (PR 6 de #86); interesses e docs **fora** dessa tabela
- [ ] Comercial (`company_interest`): CNAE, CATMAT/CATSER, termo, UF, município, ticket_min/max
- [ ] Capacidade (`company_capability`): tipo, valor, validade, evidência
- [ ] Habilitação (`company_document`): `type`, `file`, `issued_at`, `expires_at`, `status` — certidão vencida detectável
- [ ] API JWT tenant — nunca `tenantId` no body

### Técnico

- [ ] `tenant_party` permanece CNPJ + razão + `is_primary`. Sem colunas novas de matching nessa tabela
- [ ] Tabelas: `company_interest`, `company_capability`, `company_document`
- [ ] Toda capacidade/documento aponta para evidência (arquivo ou URL). Sem evidência → `status = UNKNOWN` no score, não `0`
- [ ] Testes puros de persistência + autorização
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In

1. Schema irmão de `tenant_party`
2. CRUD JWT + Settings UI mínima
3. Contrato lido pelo OpportunityScore v2 (Match V1)

### Out

- Módulos, assentos, assinatura, credenciais (lock-in Licinexus)
- Extração automática de atestados a partir de PDF do tenant
- Colunas de matching em `tenant_party`
- Match V2 (requisitos do edital) — espera o grafo

## 4. Riscos

- **Inchar `tenant_party`:** mitigação — recusar PR que adicione CATMAT/ticket nessa tabela
- **Perfil vazio no score:** fatores de aderência ficam `UNKNOWN`; denominador recalcula

## 5. Rastreabilidade

- **PRD:** `doc/PRD-produto-copiloto-decisao.md`
- **Roadmap:** Fase 2 · Match V1
- **Depende:** #86 PR 6 (Settings CNPJ)
- **Área:** `area:api`, `area:ui`
- **Prioridade:** P1
- **Executor:** `exec:cursor`
