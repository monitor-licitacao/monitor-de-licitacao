> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/98

## 1. Objetivo

Mostrar o copiloto **na ficha existente** `/contratacoes/:id`: score, confidence, porquês, preço, concorrência, documentos e recommendation.

**Por quê:** criar `/radar` ou `/intelligence` obriga o usuário a aprender outro produto. A superfície é a ficha (Passex e demais).

## 2. Critérios de aceite

### Negócio

- [ ] Card no topo da ficha com copy **Aderência /100** + **Confiança** — não “Chance de vitória”
- [ ] Fatores clicáveis: abre âncora oficial + doc da empresa + cobertura (auditabilidade)
- [ ] Critical gates visíveis (PASS/FAIL/UNKNOWN)
- [ ] Recommendation + reason (aderência alta + “não participar” é estado válido)
- [ ] Faixa histórica de preço + anomalia quando houver corpus; vazio honesto se não
- [ ] Concorrentes: rótulo **histórico** vs **provável**; nunca inventar nome
- [ ] CTA **Analisar edital** na mesma ficha (etapa do motor, não chat)
- [ ] Sem rotas novas (`/radar`, `/copiloto`, `/dashboard-ia`)

### Técnico

- [ ] Consome `GET /api/contratacoes/:id/chance-vitoria` v2
- [ ] Se `confidence` baixa, o card não some — mostra o número e o aviso
- [ ] Empty/UNKNOWN states sem skeleton mentiroso
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In

1. Card na [ContratacaoDetailView.tsx](../../src/components/contratacoes/ContratacaoDetailView.tsx)
2. Estados: INSUFICIENTE / parcial / completo

### Out

- Módulo ou rota nova
- Agente conversacional
- SEO / página pública

## 4. Rastreabilidade

- **PRD:** superfície + norte das 6 frases
- **Roadmap:** Fase 2 UI / consome v2
- **Depende:** GATE OpportunityScore v2
- **Área:** `area:ui`
- **Prioridade:** P2
- **Executor:** `exec:github`
