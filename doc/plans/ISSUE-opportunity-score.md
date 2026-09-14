> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/97

## 1. Objetivo

Evoluir o motor de #86 para **OpportunityScore `formula_version = 2`**: aderência + confidence + factors + evidence + `critical_gates` + CommercialViability, com Recommendation como campo **irmão**.

**Por quê:** a Licinexus já vende “chance de vitória” + “não participar”. Nosso nome de produto é **Aderência** até haver calibração estatística. Análise documental alimenta fatores — não gera o número. UNKNOWN sai da média. Gate FAIL veta. Nunca `score > 80 = PARTICIPAR`.

## 2. Critérios de aceite

### Negócio

- [ ] Payload: `score`, `confidence`, `formula_version`, `calculated_at`, `factors[]`, `critical_gates[]`, `commercial_viability`, `recommendation`, `recommendation_reason`
- [ ] Copy/API de produto: `aderencia` — não expor `chance_de_vitoria` como rótulo v2
- [ ] Fator: `key`, `value`, `weight`, `confidence`, `evidence_count`, `status`, `explanation`
- [ ] `critical_gate.status`: `PASS` | `FAIL` | `UNKNOWN` | `NOT_APPLICABLE` — FAIL veta recommendation
- [ ] Teste: score alto + gate FAIL → `NAO_PARTICIPAR` (não média com habilitação 0)
- [ ] Teste: score alto + preço/concorrência ruins → `NAO_PARTICIPAR` (viabilidade)
- [ ] `UNKNOWN` sai da média; sem pesos arbitrários em fator sem evidência
- [ ] `PRODUCT_FIT` no nível **item** (itens aderentes / valor aderente), não só contratação
- [ ] Match V1 agora; Match V2 `UNKNOWN` até o grafo
- [ ] Cada `SUPPORTED` tem `evidence[]`

### Técnico

- [ ] Mesmo módulo `server/lib/win-chance/` (ou rename documentado). Sem pasta paralela `opportunity-score/`
- [ ] Snapshot persistido por `(tenant_id, contratacao_id, formula_version)`
- [ ] Testes puros; sem LLM; goldens Passex + SESC (sigilo → preço `UNKNOWN`)
- [ ] `GET /api/contratacoes/:id/chance-vitoria` passa a devolver o contrato v2 quando `formula_version=2` (query ou header). v1 continua até cutover
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In

1. Contrato de payload + calculadora v2 + testes de UNKNOWN/denominador
2. Recommendation como função pura separada do score
3. Evidence array por fator

### Out

- UI do Radar (GATE próprio)
- Extração de requisitos do PDF (grafo)
- Motor de preço paralelo ao corpus de #86
- LLM narrando o número

## 4. Riscos

- **Fork do motor:** mitigação — um módulo, `formula_version`
- **Match V2 cedo demais:** fatores documentais UNKNOWN até o grafo
- **Threshold escondido:** teste que falha se recommendation for função só de `score`
- **Pesos inventados:** catálogo de fatores no PRD é alvo; não fechar pesos até haver fatos do grafo

## 5. Rastreabilidade

- **PRD:** `doc/PRD-produto-copiloto-decisao.md` v1.1 (três perguntas, critical_gate, fatos→score)
- **Roadmap:** Fase 2–4
- **Depende:** #86 (v1), GATE perfil (Match V1)
- **Área:** `area:api`, `area:ui` (só se o card v1 já existir — senão API only)
- **Prioridade:** P1
- **Executor:** `exec:cursor`
