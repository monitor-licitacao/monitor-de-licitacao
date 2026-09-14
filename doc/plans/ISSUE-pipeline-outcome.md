> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/99

## 1. Objetivo

Persistir **`opportunity_outcome`** no pipeline: motivo de perda, motivo de não participação, preços ofertado/vencedor, concorrente vencedor, resultado.

**Por quê:** o board (#89) organiza. Sem outcome o score não aprende. O PRD exige a entidade no modelo desde já; esta issue implementa.

## 2. Critérios de aceite

### Negócio

- [ ] Card não pode ir para **Homologada** ou **Perdida** sem `resultado` + motivo (`motivo_perda` ou vitória explícita)
- [ ] Saída do funil sem participar exige `motivo_nao_participacao`
- [ ] Campos: `preco_ofertado`, `preco_vencedor`, `concorrente_vencedor` (opcionais, mas persistidos quando houver)
- [ ] Outcome ligado a `tenant_id` + `contratacao_id` (ou `tenant_pipeline_item_id`)

### Técnico

- [ ] Tabela `opportunity_outcome` (não inchir `tenant_pipeline_item` com 12 colunas novas sem necessidade — FK + tabela irmã)
- [ ] PATCH autenticado JWT
- [ ] Teste: transição Homologada/Perdida sem motivo → 422
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In

1. Schema + validação de transição
2. UI mínima no board ou na futura ficha `/pipeline/:id` (se a ficha não existir, modal no card)

### Out

- Ficha completa `/pipeline/:id` (pode ser PR seguinte, mas outcome não espera)
- Robô Comprasnet
- Treinar modelo ML nesta entrega (só persistir o feedback)

## 4. Rastreabilidade

- **PRD:** reforço 4 (outcome cedo)
- **Roadmap:** Fase 5
- **Depende:** #89
- **Área:** `area:api`, `area:ui`
- **Prioridade:** P1
- **Executor:** `exec:cursor`
