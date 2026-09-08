# DNS — Monitor de Licitações (getgymsite.com.br)

Tunnel ID: `12675577-d94b-4a19-b1df-a86713dbaf80`  
Target CNAME: `12675577-d94b-4a19-b1df-a86713dbaf80.cfargotunnel.com`

## Registros atuais (zona getgymsite.com.br)

| Nome | Tipo | Conteúdo | Proxy | Papel |
|---|---|---|---|---|
| `licitacoes.getgymsite.com.br` | CNAME | `…cfargotunnel.com` | Proxied | **Público hoje** (Tunnel direto; health 200) |
| `licitacoes-origin.getgymsite.com.br` | CNAME | `…cfargotunnel.com` | Proxied | Origin para o Worker edge |

Ingress remoto do túnel inclui ambos + placeholder `licitacoes-gymsite.com.br` (sem zona ainda).

## Se for ativar o Worker (`wrangler deploy`)

Custom Domain **cria DNS sozinho** e **não pode** coexistir com o CNAME do Tunnel no mesmo hostname.

1. Remover CNAME `licitacoes.getgymsite.com.br` → túnel  
2. `npx wrangler deploy` em `workers/licitacoes-edge`  
   → Cloudflare cria o DNS do Custom Domain apontando ao Worker  
3. Manter `licitacoes-origin.getgymsite.com.br` → túnel (ORIGIN_URL)

## Domínio do DEPLOY_NOTES (`licitacoes-gymsite.com.br`)

Ainda **não** é zona neste Cloudflare. Quando existir:

```text
# DNS na zona licitacoes-gymsite.com.br
Type: CNAME
Name: @  (ou www)
Content: 12675577-d94b-4a19-b1df-a86713dbaf80.cfargotunnel.com
Proxy: ON
```

Ou Custom Domain no Worker:

```jsonc
{ "pattern": "licitacoes-gymsite.com.br", "custom_domain": true }
```

## Testes

```bash
# Tunnel direto (hoje)
curl -I https://licitacoes.getgymsite.com.br/api/health

# Origin dedicado (Worker upstream)
curl -I https://licitacoes-origin.getgymsite.com.br/api/health

# Depois do Worker + custom domain
curl -I https://licitacoes.getgymsite.com.br/api/health
```
