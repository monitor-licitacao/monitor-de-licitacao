# Notas de Deploy — Monitor de Licitações na VPS gymsite-api

Passo a passo para colocar o Monitor de Licitações rodando na mesma VPS Hetzner
que já hospeda o `gymsite-api` (CX33, 4 vCPU / 8 GB — confirmado com folga de
~6,3 GB de RAM e 34 GB de disco livres em 04/09/2026), reaproveitando o túnel
Cloudflare já existente em vez de abrir portas novas.

## 0. Gerar uma chave SSH dedicada para o CI/CD (não reaproveitar a sua)

No seu computador (Git Bash):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy-licitacoes" -f ~/.ssh/licitacoes_deploy_key
```

Isso cria `~/.ssh/licitacoes_deploy_key` (privada) e `~/.ssh/licitacoes_deploy_key.pub` (pública).
Usar uma chave própria pro GitHub Actions (em vez da sua pessoal) significa que,
se um dia precisar revogar o acesso do CI, você não perde o seu próprio acesso.

## 1. Criar um usuário de deploy dedicado na VPS (em vez de usar root)

Ainda com sua sessão SSH normal (`ssh -i ~/.ssh/hetzner_gymsite root@142.132.189.186`):

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# cole aqui o conteúdo de ~/.ssh/licitacoes_deploy_key.pub (a chave PÚBLICA gerada no passo 0)
echo "COLE_A_CHAVE_PUBLICA_AQUI" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Isso limita o que o GitHub Actions consegue fazer na VPS: o usuário `deploy` só
tem permissão de usar Docker (via grupo `docker`), não é root pleno.

## 2. Preparar o diretório do app

```bash
mkdir -p /opt/licitacoes
chown deploy:deploy /opt/licitacoes
```

Copie para `/opt/licitacoes/` os arquivos `docker-compose.licitacoes.yml` deste
repositório, e crie `/opt/licitacoes/.env.production` com:

```
GEMINI_API_KEY=...
DATABASE_URL=postgres://... (a connection string do seu Neon)
APP_URL=https://licitacoes.getgymsite.com.br
```

(domínio de produção)

## 3. Subir o container pela primeira vez

Como o `deploy`:

```bash
su - deploy
cd /opt/licitacoes
docker compose -f docker-compose.licitacoes.yml up -d
docker ps   # confira que "licitacoes-licitacoes-1" aparece e fica "healthy"
```

## 4. Rotear o hostname no túnel Cloudflare existente

Edite (como root) `/opt/gymsite/cloudflared/config.yml` e adicione uma entrada
**antes** da linha `- service: http_status:404` (a ordem importa — o Cloudflare
Tunnel usa a primeira regra que casar):

```yaml
  - hostname: licitacoes.getgymsite.com.br
    service: http://licitacoes-api:3000
    originRequest:
      connectTimeout: 30s
      keepAliveTimeout: 90s
      keepAliveConnections: 100
```

Depois:

```bash
# cria a rota DNS do túnel pro novo hostname (uma vez só)
docker exec gymsite-cloudflared-1 cloudflared tunnel route dns 12675577-d94b-4a19-b1df-a86713dbaf80 licitacoes.getgymsite.com.br

# aplica o config.yml novo reiniciando só o cloudflared (não mexe no gymsite-api)
cd /opt/gymsite
docker compose -f docker-compose.prod.yml restart cloudflared
```

Teste: `curl -I https://licitacoes.getgymsite.com.br/api/health` deve responder `200`.

## 5. Configurar os secrets do GitHub Actions

No repositório, em Settings → Secrets and variables → Actions, adicione:

| Secret | Valor |
| --- | --- |
| `HETZNER_HOST` | `142.132.189.186` |
| `HETZNER_USER` | `deploy` |
| `HETZNER_SSH_KEY` | conteúdo do arquivo `~/.ssh/licitacoes_deploy_key` (a chave PRIVADA do passo 0) |

A partir daí, todo push na `main` builda a imagem, publica em
`ghcr.io/monitor-licitacao/monitor-de-licitacao` e faz o deploy automático via
SSH, sem downtime perceptível fora da janela de troca do container.

## O que este plano NÃO inclui ainda

Os workers de scraping (`pncp_collector.ts`, `scraper_puppeteer_sesc.ts`,
`sesc_sp_scraper.ts`) já existem no repositório e usam Puppeteer, mas não
rodam neste deploy: `server.ts` não os importa, e o build seta
`PUPPETEER_SKIP_DOWNLOAD=true` para não baixar o Chromium à toa na imagem.
Este deploy cobre só a aplicação web (Express + Vite) que já existe hoje.
Quando decidir colocar os workers para rodar em produção, é preciso: remover
`PUPPETEER_SKIP_DOWNLOAD`, instalar as libs de sistema que o Chromium exige
(a base Debian já ajuda aqui) e adicionar os serviços de worker no
`docker-compose.licitacoes.yml` (ou um agendamento via `node-cron`).

## 4b. Status cutover Monitor (2026-09-06)

Feito na VPS:
- Container `licitacoes-licitacoes-1` healthy; alias Docker `licitacoes-api:3000`
- Regra adicionada em `/opt/gymsite/cloudflared/config.yml` para `licitacoes.getgymsite.com.br` → `http://licitacoes-api:3000` (backup `.bak.licitacoes`)
- Health local: `GET /api/health` → 200

Bloqueado / manual (Marcelo):
- O `cloudflared` desta VPS aplica **config remota** do Zero Trust (`Updated to new configuration … version=7`), que **sobrescreve** o ingress local. A regra do yaml ainda não entra em vigor até existir o Public Hostname no painel.
- `cloudflared tunnel route dns` falha sem `cert.pem` (origin cert) no container — não há `cloudflared login` nesta máquina.
- **Ação:** Cloudflare Zero Trust → Networks → Tunnels → tunnel `12675577-d94b-4a19-b1df-a86713dbaf80` → Public Hostname:
  - Hostname: `licitacoes.getgymsite.com.br`
  - Service: `http://licitacoes-api:3000`
- Ou CNAME DNS: `licitacoes.getgymsite.com.br` → `12675577-d94b-4a19-b1df-a86713dbaf80.cfargotunnel.com` (proxied) **e** a mesma hostname no tunnel remoto.
- Teste final: `curl -I https://licitacoes.getgymsite.com.br/api/health` → 200

## 4c. Host live (2026-09-06)

- **Produção atual:** `https://licitacoes.getgymsite.com.br` (CNAME na zona getgymsite → túnel; ingress remoto Zero Trust → `http://licitacoes-api:3000`).
- Health: `GET /api/health` → 200.
- `licitacoes-gymsite.com.br` fica como hostname futuro só quando a zona existir nesta conta Cloudflare; o ingress remoto já pode incluir os dois.
