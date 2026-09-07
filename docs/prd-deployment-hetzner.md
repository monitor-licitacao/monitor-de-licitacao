# PRD: Deploy na Infraestrutura Hetzner (VPS)

**Versão 2.0** — reescrito após inspeção real do servidor `gymsite-api` em
04/09/2026 (via SSH, comandos somente-leitura: `ss -tlnp`, `docker ps -a`,
`free -h`, `df -h`, e leitura do `docker-compose.prod.yml` e
`cloudflared/config.yml` reais). A v1.0 deste documento continha suposições
que o servidor real contradiz — ver seção 7.

Este documento define os requisitos, a arquitetura e o fluxo de implantação do
sistema **Monitor de Licitações** na VPS Hetzner `gymsite-api`.

---

## 1. Visão Geral da Arquitetura

Monorepo em **React (Vite) + Express (Node.js) + Drizzle ORM**, conectando a um
**Neon DB (PostgreSQL Serverless)** externo e à API Gemini. O repositório já
contém os workers de scraping (`server/workers/pncp_collector.ts`,
`scraper_puppeteer_sesc.ts`, `sesc_sp_scraper.ts`) e `puppeteer` está no
`package.json` — mas nenhum deles é importado por `server.ts` nem entra no
bundle de produção; são scripts npm separados (`worker:pncp`, `worker:sescsp`)
disparados manualmente, fora deste deploy por enquanto (ver seção 3.3).

Componente único hoje:
1. **App**: processo Express único, servindo o build estático do Vite E as
   rotas de API na mesma porta (**3000**, não 3001 — corrigido da v1.0).

---

## 2. Infraestrutura: consolidado na VPS existente

Decisão: **não** provisionar uma VPS nova. Vamos consolidar na `gymsite-api`
(Hetzner CX33, Falkenstein), que já roda o backend do GymSite.

Confirmado por inspeção direta (SSH, 04/09/2026):

| Recurso | Total | Em uso | Observação |
| --- | --- | --- | --- |
| RAM | 7,6 GB | ~1 GB por processos | 6,3 GB "available" (resto é cache reaproveitável) |
| Disco (/) | 75 GB | 39 GB (54%) | 34 GB livres |
| CPU | 4 vCPU | carga 0.03 | ociosa |
| Swap | 0 B | — | **recomendo criar 2–4 GB de swap** como rede de segurança antes de subir mais um serviço |

Containers já rodando: `gymsite-api-1` e `gymsite-worker-1` (Python/FastAPI via
uvicorn — stack diferente da do Monitor de Licitações, que é Node), `redis`
(fila interna do GymSite), `uptime-kuma` (monitoramento), `cloudflared`.

Se algum dia a carga real (CPU/RAM) mostrar que os dois produtos competem por
recurso, ou se surgir necessidade de isolar por segurança (ex: um scraper com
Puppeteer consumindo memória de forma imprevisível), migramos o Monitor de
Licitações para uma VPS própria — o app já roda em container, então essa
migração é só apontar o compose para outra máquina.

---

## 3. Modelo de Implantação

### 3.1 Sem Caddy — reaproveitar o Cloudflare Tunnel existente

A v1.0 deste PRD assumia Nginx ou Caddy expondo as portas 80/443. Isso **não
existe** no servidor real: `ss -tlnp` mostra só a porta 22 (SSH) escutando. O
acesso público ao `gymsite-api` acontece 100% via **Cloudflare Tunnel**
(`cloudflared`), que faz conexão de saída para a borda da Cloudflare — nenhuma
porta de entrada precisa ficar aberta no host.

Decisão: o Monitor de Licitações usa o **mesmo túnel** (tunnel ID
`12675577-d94b-4a19-b1df-a86713dbaf80`), adicionando uma nova regra de
`ingress` no `cloudflared/config.yml` apontando para o novo container por
alias de rede Docker, exatamente como já é feito para o `gymsite-api` e o
`uptime-kuma`. Isso elimina toda a complexidade de certificado TLS/Let's
Encrypt da v1.0 — a Cloudflare cuida disso na borda.

### 3.2 Docker

Multi-stage, base **`node:20-bookworm-slim`** (Debian) — mantido da v1.0,
continua sendo a escolha certa porque facilita rodar os workers com Puppeteer
neste mesmo container no futuro, sem trocar a base da imagem. Por ora o build
seta `PUPPETEER_SKIP_DOWNLOAD=true` para não baixar o Chromium (~300MB) à toa,
já que os workers não rodam neste deploy ainda.

Compose **separado** do `docker-compose.prod.yml` do GymSite (arquivo
`docker-compose.licitacoes.yml` próprio), conectado à mesma rede Docker
`gymsite` como `external: true`. Isso isola o ciclo de vida dos dois deploys —
atualizar o Monitor de Licitações nunca reinicia os containers do GymSite.

### 3.3 Workers/Scrapers — código existe, execução em produção adiada

`pncp_collector.ts`, `scraper_puppeteer_sesc.ts` e `sesc_sp_scraper.ts` já
existem no repositório, mas não fazem parte deste deploy: `server.ts` não os
importa, e a imagem de produção nem baixa o Chromium do Puppeteer
(`PUPPETEER_SKIP_DOWNLOAD=true`). Quando forem colocados para rodar em
produção, falta decidir a orquestração (`node-cron` num processo de vida longa
vs. containers que sobem e morrem por agendamento), instalar as libs de
sistema que o Chromium exige na imagem, e dimensionar memória de acordo com o
que o Puppeteer realmente consumir na prática.

---

## 4. Fluxo de CI/CD

GitHub Actions builda a imagem, publica em
`ghcr.io/monitor-licitacao/monitor-de-licitacao` e faz deploy via SSH para um
usuário **`deploy`** dedicado (membro do grupo `docker`, não root), usando uma
chave SSH própria do CI — nunca a chave pessoal do desenvolvedor.

Deploy roda `docker compose pull && docker compose up -d` e aguarda o
healthcheck do container (`GET /api/health`) ficar `healthy` antes de considerar
sucesso. Há uma janela curta de indisponibilidade durante a recriação do
container — aceitável para uma ferramenta interna B2B.

---

## 5. Segurança

| Área | Aplicação |
| --- | --- |
| Acesso SSH do CI | Usuário `deploy` dedicado, sem privilégio de root, chave própria (não a pessoal) |
| Segredos | `GEMINI_API_KEY` e `DATABASE_URL` só em `.env.production` na VPS (não versionado) e nos GitHub Secrets — nunca na imagem Docker |
| Superfície de rede | Nenhuma porta nova aberta no host — tudo via túnel Cloudflare, igual ao GymSite |
| Isolamento entre apps | Compose separado do GymSite, `mem_limit` de 1 GB no container para conter picos |
| Backup | Dados ficam no Neon (gerenciado). Nenhum estado persistente local hoje — se isso mudar (ex: cache de PDFs), revisitar |

---

## 6. Próximos Passos (Action Items)

- [x] Dockerfile multi-stage (`node:20-bookworm-slim`)
- [x] `docker-compose.licitacoes.yml` (rede externa `gymsite`, sem porta no host)
- [x] Workflow `.github/workflows/deploy.yml` (build + push GHCR + deploy SSH)
- [x] `DEPLOY_NOTES.md` com o passo a passo manual de primeira configuração
- [ ] Criar usuário `deploy` na VPS e chave SSH dedicada (passo manual, ver DEPLOY_NOTES.md)
- [x] Domínio definido: `licitacoes.getgymsite.com.br`
- [ ] Criar `/opt/licitacoes/.env.production` na VPS com as chaves reais
- [ ] Adicionar a regra de `ingress` no `cloudflared/config.yml` e rotear o DNS do túnel
- [ ] Criar swap de 2–4 GB na VPS como margem de segurança
- [ ] (Futuro) Decidir orquestração e colocar os workers de scraping (código já existe) para rodar em produção

---

## 7. O que mudou da v1.0 (para rastreabilidade)

| v1.0 assumia | Realidade confirmada |
| --- | --- |
| VPS nova (CPX21/CPX31) | Consolidado na VPS existente `gymsite-api`, com folga de recursos |
| Backend na porta 3001 | Porta real é **3000** (`server.ts`) |
| Nginx ou Caddy nas portas 80/443 | Nenhuma porta 80/443 aberta — tudo via Cloudflare Tunnel já existente |
| Workers `pncp_collector.ts` / `scraper_puppeteer_sesc.ts` já implementados com `node-cron` | Os arquivos **existem** e estão commitados, mas sem `node-cron`/agendamento — são scripts npm disparados manualmente, fora deste deploy por enquanto |
| "Zero downtime" no deploy | Há uma janela curta de indisponibilidade na recriação do container (aceitável) |
