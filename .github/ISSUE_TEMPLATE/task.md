---
name: Task
description: Tarefa padrão — objetivo, aceite e rastreabilidade Notion.
title: "[TASK]: <objetivo sucinto>"
labels: []
assignees: []
---

## Objetivo
<!-- O que precisa ser entregue e por quê? -->

## Critérios de aceite
- [ ]
- [ ]

## Rastreabilidade
- **Notion (task/PRD)**: 
- **Área**: `area:ingestao` | `area:ui` | `area:api` | `area:telemetry`
- **Prioridade**: `P0` | `P1` | `P2`  *(também como label — fonte da verdade)*
- **Executor**: `exec:cursor` | `exec:claude` | `exec:github`
- **Modelo**: herdar o padrão do executor, ou slug explícito (`claude-opus`, `composer-2.5`, `copilot`)

## Escopo
### In
-

### Out
-

## Testes esperados
- [ ] `npm run lint`
- [ ] `npm test`
