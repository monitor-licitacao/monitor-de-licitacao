# Decisão: snapshot vs. worktree atual

**Data:** 2026-09-13  
**Status:** Aprovado para execução  
**Repo:** [monitor-de-licitacao](https://github.com/monitor-licitacao/monitor-de-licitacao)

## Contexto

O plano de correção foi gerado a partir de um **snapshot (.tar)** com módulos que nunca entraram no `main` (`tokenEfficiency.ts`, `resilientFetch.ts`, `auditLog.ts`, `rateLimiter.ts`, `aiProxy.ts`). O `main` evoluiu com arquitetura distinta (Drizzle/Neon, `express-rate-limit` inline, rotas `/api/gemini/*`, auditoria via Notion).

## Decisão (passo 1)

**Não integrar o `.tar` diretamente.** Manter o snapshot como artefato de referência isolado (fora do repo) e **reimplementar** os invariantes de segurança/resiliência contra o código atual.

| Item do snapshot | Destino no `main` |
|---|---|
| `crypto.ts` fallback `monitor-dev-key` | ✅ Já corrigido (PR #42) |
| `tokenEfficiency.ts` | Reimplementado em `server/lib/tokenEfficiency.ts` |
| `resilientFetch.ts` | Reimplementado em `server/lib/resilientFetch.ts` |
| `auditLog.ts` | Reimplementado com tabela `audit_log` (Neon) |
| `rateLimiter.ts` | Reimplementado com tabela `rate_limit_counters` (Neon) |
| `aiProxy.ts` | Reimplementado como router Express `/api/proxy/gemini` |

## Governança de integração

- **Proibido** merge direto de worktree derivada do snapshot sem rebase em `main` e revisão de PR.
- `npm run check-health` bloqueia worktree suja antes do push.
- CI (`ci.yml`) e deploy (`deploy.yml`) exigem `npm test` verde, incluindo `__golden_rules_compliance__.test.ts`.

## Fail-open vs fail-closed

| Módulo | Produção | Desenvolvimento |
|---|---|---|
| Rate limit (DB) | **Fail-closed** — sem DB, rejeita requisição | Fallback em memória |
| Audit log (DB) | **Fail-open** — falha de persistência não bloqueia fluxo principal; erro logado | Skip silencioso se sem DB |

## Próxima revisão

Reavaliar após migration `0003_audit_rate_limit.sql` aplicada no branch Neon da feature.
