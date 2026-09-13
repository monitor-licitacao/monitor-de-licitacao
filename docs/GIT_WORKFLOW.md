# 🔧 Git Workflow — Commits, Branches e Pull Requests

Este documento é a referência operacional para o fluxo de Git do projeto **Monitor de Licitações**. Ele complementa a Regra de Ouro 8 (Higiene de Git) do [GEMINI.md](../GEMINI.md) com o passo a passo prático.

> **Origem**: este guia nasceu de um incidente real em que um commit em `main` misturou 78 arquivos de tarefas diferentes (refactor de app + worker Cloudflare + lixo de build/IDE), causado por trabalhar direto em `main` e usar `git add .` sem revisão. As regras abaixo existem para que isso não se repita.

---

## 1. Regra de Ouro: `main` é somente leitura localmente

- **Nunca** rode `git commit` estando na branch `main`.
- Toda tarefa nova começa com uma branch, **antes** de tocar em qualquer arquivo:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b <tipo>/<descricao-curta>
  ```
- Convenção de nomes de branch (prefixo = tipo de mudança):
  | Prefixo | Uso |
  |---|---|
  | `feat/` | nova funcionalidade |
  | `fix/` | correção de bug |
  | `refactor/` | mudança de código sem alterar comportamento |
  | `docs/` | documentação |
  | `chore/` | manutenção, config, dependências |
  | `wip/` | trabalho em andamento, não vai a PR sem antes virar um dos tipos acima |

- **Um checkout/worktree = uma tarefa.** Não acumule múltiplas tarefas não relacionadas no mesmo diretório de trabalho sem branches separadas desde o início. Prefira worktrees isoladas (`.worktrees/<nome-da-tarefa>`) em vez do checkout principal para trabalho ativo.

## 2. Nunca use `git add .` sem revisão

`git add .` foi a causa direta do incidente (commitou `.wrangler/`, `.claude/`, e workers não relacionados junto com o refactor pretendido).

Sempre revise o escopo antes de commitar:
```bash
git status --short          # veja tudo que mudou
git diff --stat              # veja o tamanho do diff
git add -p                   # revisão interativa, hunk por hunk (preferido)
# ou, quando o escopo é claro:
git add <arquivo1> <arquivo2>   # liste os arquivos explicitamente
```
Só use `git add .` se `git status --short` já mostrar exatamente os arquivos esperados para aquela tarefa — nunca como primeiro passo às cegas.

## 3. Commits Atômicos e Semânticos (Conventional Commits)

Padrão: `<tipo>(<escopo opcional>): <descrição curta no imperativo>`

```
feat(edge): add Cloudflare Worker for licitacoes.getgymsite.com.br edge routing
fix(deploy): auto-generate missing JWT_SECRET in production
refactor: centralize id-based list updates in shared collectionUtils
docs: add GIT_WORKFLOW.md with commit/PR guidelines
chore: ignore .wrangler and .claude local dev artifacts
```

**Proibido**: `update`, `wip`, `arrumando coisas`, `fix stuff`, ou qualquer commit sem tipo/escopo claro.

Tipos disponíveis (via `npm run commit` / `git-cz`):
- `feat` — nova funcionalidade
- `fix` — correção de bug
- `docs` — documentação
- `refactor` — mudança sem alterar comportamento
- `style` — formatação, sem mudança de lógica
- `chore` — build, config, dependências
- `test` — testes

## 4. Checklist antes de cada commit

- [ ] Estou em uma branch, **não** em `main`.
- [ ] `git status --short` mostra **apenas** arquivos relacionados a esta tarefa.
- [ ] Nenhum arquivo de build/cache/IDE está staged (`.wrangler/`, `.claude/`, `node_modules/`, `dist/`, `*.sqlite*`, `.env`).
- [ ] Se `git diff --cached --name-only | wc -l` > ~15 arquivos, parei e confirmei que não há mistura de tarefas.
- [ ] Mensagem de commit segue Conventional Commits.
- [ ] `npm run lint` e `npm test` passam localmente.

## 5. Protocolo de Pull Request

- **Escopo único por PR**: um PR = uma tarefa/intenção. Se durante o trabalho você tocar em arquivos não relacionados (ex: um ajuste cosmético que "aparece no caminho"), separe em outra branch/PR — não empacote junto.
- **Tamanho**: máximo de 300–400 linhas de código por PR (Regra 8.3). PRs maiores devem ser quebrados em partes revisáveis.
- **Checklist de PR**:
  - Código compila sem erros (`npm run lint`).
  - Testes existentes passam (`npm test`).
  - Sem `console.log` de debug esquecido.
  - Respeita a Regra 1 (Zero Alucinação) se envolver conteúdo jurídico/IA.
  - Descrição do PR explica o **quê** e o **porquê**, não só lista arquivos.
- **Nunca** abrir PR com a branch em estado "dirty" (mudanças não commitadas) — rode `git status --short` antes de `create_pull_request`/`gh pr create`.

## 6. Encerramento de sessão (The Departure Rule)

Ao terminar uma tarefa:
1. **Sync**: branch atualizada com `main` (`git fetch origin && git rebase origin/main` ou merge, conforme convenção do time).
2. **No Pendings**: sem arquivos soltos. Ou commit (`wip:` apenas se for continuar depois na mesma branch, nunca em `main`), ou `git stash`.
3. **Push imediato**: código funcional deve estar no remote antes de mudar de contexto.
4. **Um PR por branch finalizada.**

## 7. Camadas de proteção automatizada

Estas camadas existem para pegar o erro humano/IA antes que ele chegue no repositório remoto:

1. **Hook local (`scripts/check-health.sh` / Husky pre-commit)**:
   - Bloqueia commit se a branch atual for `main`.
   - Avisa (e pede confirmação) se o número de arquivos staged for anormalmente alto para a tarefa.
   - Roda lint e detecta segredos (`.env`) antes de permitir o commit.
2. **`.gitignore` completo e revisado no início do projeto** — nunca deixe artefatos de build/IDE aparecerem como `??` no `git status` recorrentemente; se aparecerem, adicione ao `.gitignore` imediatamente (commit `chore:` isolado).
3. **CI no GitHub** (`.github/workflows/ci.yml`, job `quality`):
   - Roda em todo PR e push em `main`.
   - Gates: `npm run lint` (type-check) + `npm test`.
4. **Proteção de branch no GitHub** (ruleset em `main`):
   - PR obrigatório antes de merge.
   - Status check `quality` deve passar.
   - 1 approval (no time pequeno, o autor pode aprovar se não houver segundo reviewer).
   - Conversas resolvidas; squash merge como padrão.
   - Bypass só para admin em hotfix de emergência.

Essas camadas juntas (disciplina de branch + hook local + CI + proteção remota) garantem que mesmo uma falha em uma camada não resulte em `main` corrompida.

---

## 8. Kanban GitHub Project (execução)

**Notion Workbench = planejamento.** **GitHub Project = execução.** Sync manual — sem script automático.

Project: [Monitor de Licitações](https://github.com/orgs/monitor-licitacao/projects) (org `monitor-licitacao`).

**Setup inicial (uma vez):** após `gh auth refresh -h github.com -s project,read:project`, rode:

```bash
bash scripts/setup-github-kanban-project.sh
# ou no Windows:
pwsh scripts/setup-github-kanban-project.ps1
```

### Colunas (6 estados)

| Coluna | Quando usar |
|---|---|
| **Backlog** | Ideia registrada, ainda sem aceite claro |
| **Ready** | Aceite definido; pode abrir branch |
| **In Progress** | Branch aberta, desenvolvimento ativo |
| **In Review** | PR aberto, aguardando CI + review |
| **Blocked** | Impedimento externo (dependência, decisão, ambiente) |
| **Done** | Merge em `main` concluído |

### Fluxo Issue → Branch → PR

1. Criar issue (template **Task** ou **Execução por Gate** para entregas grandes).
2. Mover para **Ready** no Project quando o aceite estiver claro.
3. Abrir branch: `feat/#<numero>-<slug>` ou `fix/#<numero>-<slug>`.
4. Abrir PR; mover para **In Review**.
5. CI verde + 1 approval → squash merge → **Done**.

Deploy dispara automaticamente no push em `main` (workflow `deploy.yml`).

---

## 9. Labels mínimas

Tipo de issue usa **Issue Types** nativos da org (Task / Bug / Feature). Labels adicionais:

**Prioridade:** `P0`, `P1`, `P2`

**Área:**
- `area:ingestao` — coleta PNCP, scrapers, portais
- `area:ui` — React, layout, UX
- `area:api` — Express, rotas, auth, banco
- `area:telemetry` — Amplitude, observabilidade, KPIs

Não é obrigatório retaggar issues antigas.

---

## 10. Sync manual com Notion

Board compartilhado: [Workbench / Tasks](https://app.notion.com/p/76217dab7efd460aa0d9fa5c2ac37b7b).

**Não altere os status do Workbench** — são compartilhados entre projetos. Os 6 estados granulares vivem só no GitHub Project.

| Notion (Tasks) | GitHub Project |
|---|---|
| Not started | Backlog (ou Ready se já tiver aceite) |
| In progress | In Progress |
| Blocked | Blocked |
| Done / Archived | Done |

**Ready** e **In Review** existem só no GitHub — não têm coluna equivalente no Notion.

Em cada task Notion em execução, colar a URL da issue GitHub no campo **Note**.

Projeto Notion: [Monitor de Licitações](https://app.notion.com/p/3d2f1fc77c6b81e8ac98d5e95da14c76).

---

## 11. Merge e emergência

- **Estratégia padrão:** squash merge (histórico limpo, 1 commit por entrega).
- **Requisitos:** CI `quality` verde + 1 approval + conversas resolvidas.
- **Hotfix:** admin pode usar bypass do ruleset apenas em emergência de produção; documentar no PR o motivo.

---

**Ver também**: [GEMINI.md](../GEMINI.md) (Regras de Ouro), [NEON_RULES.md](./NEON_RULES.md) (migrações de banco em feature branches).
