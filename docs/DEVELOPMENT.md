# Setup local — Monitor de Licitações

**Gerenciador oficial: npm.** Não use `bun install` nem `yarn`. O CI e o deploy já rodam `npm ci`. Misturar Bun e npm no Windows quebra o shim do `tsx` (`could not find bin metadata file`).

## Requisitos

- Node.js 22+ (CI usa Node 24)
- npm 10+
- Cópia de `.env.example` → `.env` / `.env.local`

## Primeiro setup

```bash
git clone https://github.com/monitor-licitacao/monitor-de-licitacao.git
cd monitor-de-licitacao
copy .env.example .env
npm ci
npm run dev
```

No PowerShell, o `copy` acima é o cmdlet nativo. Em Git Bash use `cp .env.example .env`.

Servidor de desenvolvimento: `tsx server.ts` (script `dev`). Produção local: `npm run build` e `npm start` (`node dist/server.cjs`).

## Recuperação no Windows (erro de bin metadata)

Sintoma:

```text
error: could not find bin metadata file
Bun failed to remap this bin to its proper location within node_modules.
```

Causa típica: `node_modules` instalado ou reescrito pelo Bun, ou pasta incompleta, com `tsx` ausente.

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
if (Test-Path bun.lock) { Remove-Item -Force bun.lock }
if (Test-Path bun.lockb) { Remove-Item -Force bun.lockb }
npm ci
npm run dev
```

cmd:

```bat
rmdir /s /q node_modules
del /q bun.lock bun.lockb 2>nul
npm ci
npm run dev
```

Git Bash:

```bash
rm -rf node_modules bun.lock bun.lockb
npm ci
npm run dev
```

Workaround se o `tsx` ainda falhar: `npm run build` e `npm start` — não usam o binário `tsx`.

## Comandos

| Script | Uso |
|---|---|
| `npm ci` | Install reproduzível a partir de `package-lock.json` |
| `npm run dev` | API + Vite em desenvolvimento |
| `npm run build` | Bundle frontend + `dist/server.cjs` |
| `npm start` | Sobe o bundle de produção |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Testes Node |
| `npm run audit:sources` | Auditoria HTTP do inventário `data/source-inventory.json` |

## Regras

- Commitar só `package-lock.json`. `bun.lock` / `bun.lockb` estão no `.gitignore`.
- `package.json` declara `packageManager: npm@11.12.1` e um `preinstall` que recusa `bun install`.
- Fluxo Git: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md).
- Nunca versionar `*.har` (tokens/cookies). Ver #91. Entradas `*.har` e `doc/**/*.har` estão no `.gitignore`.
