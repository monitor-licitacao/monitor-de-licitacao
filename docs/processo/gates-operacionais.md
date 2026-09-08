# Plano Operacional Consolidado — Monitor de Licitação (SOP v1)

Este documento define o fluxo oficial de execução com agentes e desenvolvedores para garantir qualidade, segurança e rastreabilidade em todas as entregas do projeto **Monitor de Licitação**.

---

## 🎯 Objetivo do SOP v1

Padronizar entregas com:
1. **Escopo validado**
2. **Execução rastreável**
3. **Revisão independente**
4. **Evidência de testes**
5. **Validação de impacto**

---

## 🧩 Papel de Cada Ferramenta no Fluxo

| Ferramenta | Papel Principal |
| :--- | :--- |
| **GitHub (Issue/PR/Actions)** | Fonte técnica auditável (diff, checks de CI, aprovação). |
| **Notion** | PRDs, backlog priorizado, decisões estratégicas de produto. |
| **GitBook** | Runbooks, playbooks e checklists operacionais. |
| **Amplitude** | Evidência de uso, eventos e métricas de impacto (KPIs). |
| **Gamma** | Comunicação executiva para stakeholders. |
| **Agentes (Cursor/Copilot)** | Execução e revisão técnica (sempre com revisão humana/independente, sem autoaprovação). |

> 📌 **Regra de Memória Operacional**: Ferramentas de contexto/memória (como Grok Mem, claude-mem) servem como apoio de contexto, nunca decisão final isolada.

---

## 🛡️ Fluxo Oficial por Gates (Obrigatório)

### Gate 0 — Reconciliação de Contexto
Antes de codar:
- Validar Notion (objetivo e prioridade da funcionalidade).
- Mapear Issues e PRs abertas para evitar duplicidade ou conflitos.
- Confirmar estado atualizado da branch base (`main`).
- Identificar playbook no GitBook aplicável à tarefa.
- Registrar baseline no Amplitude.

**Saída**: Classificar o cenário em:
`concluído` | `pendente` | `parcial` | `sem evidência` | `depreciado`.

---

### Gate 1 — Contrato de Execução (Issue)
Toda tarefa deve possuir uma Issue estruturada utilizando o template `.github/ISSUE_TEMPLATE/execucao-gate.md`, contendo:
- Objetivo claro.
- Critérios de aceite (negócio + técnico).
- Escopo explícito (*In Scope* e *Out of Scope*).
- Riscos e mitigação.
- Arquivos e áreas prováveis de alteração.
- Testes obrigatórios.
- Eventos e KPIs de telemetria (Amplitude).

> ⛔ **Sem contrato completo preenchido, a execução não inicia.**

---

### Gate 2 — Handoff para Executor
O executor (humano ou agente) recebe apenas:
- Tarefa priorizada e validada.
- Contexto reconciliado.
- Limites explícitos de escopo.
- Testes exigidos.
- Requisitos de telemetria.
- Restrições de segurança e arquitetura.

---

### Gate 3 — Entrega (PR)
O Pull Request deve ser pequeno e objetivo (preferencialmente < 300–400 linhas), criado via template `.github/pull_request_template.md`:
- O que mudou e por quê.
- Evidências de testes locais (`npm test`).
- Evidências de instrumentação (Amplitude).
- Pendências e débitos técnicos declarados.
- Links para Issue e documento no Notion.

---

### Gate 4 — Revisão Independente
Revisão técnica criteriosa avaliando:
- Escopo aprovado (sem acúmulo de tarefas não relacionadas).
- Segurança (autenticação, rate limit, segredos fora do código).
- Robustez de integração externa (fallback, `try/catch` defensivo).
- Persistência e auditoria (`updated_at`, `user_id`).
- Cobertura de testes automatizados.
- Aderência estrita às Golden Rules.

> ⛔ **O autor não autoaprova o PR.**

---

### Gate 5 — Correção ou Merge
- Corrigir blockers apontados na revisão.
- Merge realizado somente com checks de CI verdes e critérios atendidos.
- Atualizar Notion (decisão e débitos remanescentes).
- Atualizar GitBook (runbooks e lições aprendidas).
- Publicar resumo executivo no Gamma com links oficiais.

---

## 📌 DoR / DoD

### Definition of Ready (DoR)
- [ ] Issue completa e aprovada com template de Gate 1.
- [ ] Dependências e riscos mapeados.
- [ ] Testes obrigatórios definidos.
- [ ] Telemetria e eventos de impacto definidos.

### Definition of Done (DoD)
- [ ] PR mergeada com CI verde (`npm test` e checks automatizados).
- [ ] Testes obrigatórios executados com evidência documentada.
- [ ] Critérios de segurança validados.
- [ ] Telemetria validada.
- [ ] Notion e GitBook atualizados.
- [ ] Comunicação executiva no Gamma publicada.

---

## 🧭 Golden Rules (Obrigatórias)

1. **Zero alucinação**: Não inventar dados jurídicos, comerciais, valores ou fornecedores.
2. **Fallback de dados**: Ausência explícita (`[DADO AUSENTE]`) quando necessário.
3. **Disclaimer IA em minutas/documentos**:
   *“Documento gerado por assistência de IA. Revisão humana obrigatória.”*
4. **Segurança por padrão**: Rotas `/api/*` autenticadas, segredos fora do código, rate limit em rotas de IA.
5. **Resiliência**: Fallback para fontes externas e `try/catch` defensivo.
6. **Auditoria**: Alterações de estado com trilha auditável (`updated_at`, `user_id`, etc.) quando aplicável.

---

## 📢 Formato Padrão de Atualização no Gamma

- **Objetivo**
- **Entregas da janela**
- **Evidência técnica** (Issue / PR / Checks)
- **Impacto esperado** (KPI Amplitude)
- **Riscos residuais**
- **Próximos passos**
- **Links oficiais** (Notion, Issue, PR, Dashboard)
