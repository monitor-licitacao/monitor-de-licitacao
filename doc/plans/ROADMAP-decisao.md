# Roadmap — copiloto de decisão

**PRD produto:** [PRD-produto-copiloto-decisao.md](../PRD-produto-copiloto-decisao.md)  
**PRD dados:** [PRD-v2-plataforma-inteligencia-licitacoes.md](../PRD-v2-plataforma-inteligencia-licitacoes.md)

Numeração formal das 6 fases **não muda**. Dentro da Fase 2 há duas camadas (Match V1 / Match V2).

## Dependência real

```text
documento            → fatos / requisitos / riscos
perfil da empresa    → aderência (Posso?)
aderência + fatos    → OpportunityScore
preço + concorrência → CommercialViability (Vale?)
gates + score + viability → recommendation
recommendation + comportamento → aprendizado
aprendizado          → agente (Como ganhar? em escala)
```

Caminho crítico (prioridade interna; numeração das fases intacta):

```text
itens confiáveis (PRD v2)
  → perfil comercial + docs habilitação
  → grafo (facts/requirements/risks/evidence)
  → OpportunityScore
  → price engine + competitor engine
  → recommendation
  → radar na ficha
```

## Fases

### Fase 1 — Descoberta + documentos

- Fechado: #79 (enrich Compras.gov), #81/#82 (domínios PNCP).
- Em curso: #93 (catálogo de anexos + histórico; link oficial, sem blob).
- GATE seguinte: grafo documental — saídas `facts` / `requirements` / `risks` / `evidence` (não chunks RAG).
- Fora: OCR/RAG genérico; download-em-massa nacional.

### Fase 2 — Matching + alertas

Duas camadas, mesma fase formal:

- **Match V1 (metadados):** objeto, itens, UF, valor, CNAE, CATMAT. Base = #86 `formula_version = 1` + GATE perfil (`company_*`).
- **Match V2 (requisitos):** atestados, certificações, qualificação, prazos, restrições. Só depois do grafo. Enquanto o grafo não existir, fatores documentais ficam `UNKNOWN`.

- GATE: perfil da empresa — comercial (`company_interest`) separado de habilitação (`company_document` + validade).
- Fora: score sem evidência; `ausente = 0`; copy “chance de vitória” sem calibração.

### Fase 3 — Análise de edital

- GATE: reader + checklist a partir do grafo. Desbloqueia Match V2. “Analisar edital” alimenta fatores, não inventa o %.
- Fora: chat solto no PDF; RAG como produto.

### Fase 4 — Preço + concorrência

- Já parcialmente em #86 + plano CATMAT.
- Três saídas de preço: sugerido + faixa + anomalia. Concorrentes: histórico ≠ inferência.
- Absorver no `formula_version = 2`. Sem motor de preço paralelo.

### Fase 5 — Pipeline comercial

- Em curso: #89 (board, 9 colunas, sem ficha).
- GATE: ficha `/pipeline/:id` + `opportunity_outcome`.
- Aceite fundamental: Homologada/Perdida sem motivo de outcome não fecha.
- Fora: robô Comprasnet.

### Fase 6 — Agente operacional

- Issue P2 estacionada.
- Só depois de empresa + licitação + documentos + requisitos + preços + concorrentes + pipeline + resultados.
- Agente = consulta estruturada (“5 oportunidades score>80, prazo>10d, sem pendência crítica”).
- Fora: ERP, SICAF, marketplace, vertical governo.

## Aquisição (fora das 6 fases)

Site público + SEO: TASK P2 estacionada. Só depois do Match V1 ter “combina com sua empresa?” verdadeiro.

Saved search (filtros + alerta): feature simples na descoberta, não GATE.

## Issues novas (este turno)

- Epic: [#94](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/94)
- Perfil: [#95](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/95)
- Grafo: [#96](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/96)
- Score v2: [#97](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/97)
- Radar: [#98](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/98)
- Outcome: [#99](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/99)
- SEO (P2): [#100](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/100)

Não duplicar #86, #89, #93.
