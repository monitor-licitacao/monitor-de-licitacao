# Auditoria de fontes — issue #80

**Status:** TECNICAMENTE CONCLUÍDA, COM FOLLOW-UPS DE EVIDÊNCIA.  
**Data da execução:** 2026-09-13T20:17:52.773Z  
**Issue:** [#80](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/80) · follow-ups [#84](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/84) (Radar) e [#85](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/85) (Licinexus)  
**Método:** HEAD; se inconclusivo (405, 403, 404, falha) → GET. Redirects seguidos (máx. 8 hops). User-Agent `MonitorLicitacao-SourceAudit/1.0`. Sequencial, 300 ms entre URLs. Sem bypass de WAF, sem login.  
**Runtime:** TypeScript/Node (`npm run audit:sources`). A issue pedia Python; este Windows não tem interpretador Python e o CI do repo já usa `node --test`.

## 1. O que existia no repositório

Não havia inventário competitivo versionado. Localizado:

| Arquivo | Papel | Alterado? |
|---|---|---|
| `server/db/schema.ts` (`sources`) | Fontes operacionais por tenant | Não |
| `server/db/seed-real-sources.ts` | Seed PNCP + Sistema S | Não |
| Planilha Drive `.xlsm` | Inventário externo | Não parseada (MIME) |

Arquivos novos (fonte da verdade desta auditoria):

- `data/source-inventory.json`
- `data/source_http_audit/latest.json`
- `data/source_http_audit/snapshots/`
- `server/lib/sourceHttpAudit.ts`
- `scripts/source_http_audit.ts`
- `__source_http_audit__.test.ts`

## 2. Totais

| Métrica | Valor |
|---|---:|
| Fontes no inventário | 34 |
| Probes HTTP | 46 |
| OK | 42 |
| REDIRECT | 2 |
| BLOCKED | 1 |
| UNKNOWN | 1 |
| TIMEOUT / DNS_ERROR / TLS_ERROR / HTTP_ERROR | 0 |
| Evidência da fonte CONFIRMADO | 2 |
| Evidência da fonte PARCIAL | 6 |
| Evidência da fonte NAO_CONFIRMADO | 26 |
| Stack da fonte inteira CONFIRMADO | 0 |
| API CONFIRMADA | 2 (PNCP, Compras.gov) |

## 3. HTTP relevante

- **PNCP portal** `https://pncp.gov.br/` — `fetch failed` / UNKNOWN neste runner. Swagger e `GET /v1/contratacoes/publicacao` = OK.
- **Compras.gov raiz** — 302 → `/swagger-ui/index.html` (REDIRECT). CATMAT GET 200 após fallback HEAD 404 → GET.
- **BLL app** — 302 → `/Home/Login`. Header `Server: Microsoft-IIS/10.0` é observação, não prova de stack.
- **Licitanet** — 403 BLOCKED (`awselb/2.0`). Sem contorno.

## 4. Prioritários

### PNCP

REST / HTTP / JSON / OpenAPI = **CONFIRMADO** ([Swagger](https://pncp.gov.br/api/consulta/swagger-ui/index.html) + endpoint de publicação 200). Java / Spring / PostgreSQL / AWS / Kubernetes = **NAO_CONFIRMADO**.

### Compras.gov.br

API pública oficial REST/dados abertos = **CONFIRMADO**. Stack interno do Comprasnet = **NAO_CONFIRMADO**. A inconsistência original (“Confirmado publicamente” vs critério PARCIAL) foi resolvida: API ≠ stack.

### Licinexus

- API/integração: **PARCIAL** — termos declaram APIs dos modelos; `/api/explorar` 200, mas o HTML obtido foi landing, não spec OpenAPI.
- X-API-Key: **NAO_CONFIRMADO** nesta auditoria.
- Stack: **PARCIAL**, com itens first-party nos [Termos v2026-08-23](https://www.licinexus.com.br/termos-uso): PostgreSQL RDS `sa-east-1`, EC2/VPC, Cognito, S3, SES, bcrypt.

### Radar de Licitação

Claims históricas (Python 3.12, FastAPI, Pydantic, Next.js 15, React 19, TypeScript, Tailwind, PostgreSQL, SQLAlchemy, pg_trgm, BRIN, APScheduler, MCP) **preservadas** em `historical_claims`. Corpo do post de Paulo Serrano não extraído. Texto idêntico aparece no post de [Gilberto J.](https://pt.linkedin.com/posts/gilbertojrr_python-fastapi-nextjs-activity-7495456270603341825-D7Wy) sobre *Radar de Licitações*. Entidades **não fundidas**. Site de produto = `[DADO AUSENTE]`. Status: **REVALIDATE**.

### ConLicitação

Evidência individual no HTML do marketing (2026-09-13): WordPress, Elementor, NitroPack, Cloudflare, gtag = **PARCIAL**. JetEngine, RD Station, New Relic = **NAO_CONFIRMADO**. BuiltWith não vale como bloco único.

### LicitaAI

IA Claude = **PARCIAL** (string no HTML de [licita.pro](https://www.licita.pro/)). Framework / banco / cloud = **NAO_CONFIRMADO**.

## 5. Identidade

- ComprasBR ≠ SIGA-RJ
- Licita Mais Brasil ≠ Licita Mais (FGE)
- LiciteGov (inventário) ≈ LicitaGov ([licitagov.org](https://licitagov.org/)) — CONFLICT de nome

## 6. Tabela

| Fonte | URL | HTTP | Final URL | API | Stack | Evidência | Status auditoria |
|---|---|---:|---|---|---|---|---|
| PNCP | https://pncp.gov.br/ | UNKNOWN | | CONFIRMADO | NAO_CONFIRMADO | CONFIRMADO | VERIFIED |
| Compras.gov.br | https://dadosabertos.compras.gov.br/ | 200 REDIRECT | https://dadosabertos.compras.gov.br/swagger-ui/index.html | CONFIRMADO | NAO_CONFIRMADO | CONFIRMADO | VERIFIED |
| Licitações-e (Banco do Brasil) | https://www.licitacoes-e.com.br/ | 200 | https://www.licitacoes-e.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| BLL Compras | https://bll.org.br/ | 200 | https://bll.org.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| BBMNET Licitações | https://bbmnet.com.br/ | 200 | https://bbmnet.com.br/ | NAO_CONFIRMADO | PARCIAL | PARCIAL | PARTIAL |
| BNC Compras | https://bnc.org.br/ | 200 | https://bnc.org.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Portal de Compras Públicas | https://www.portaldecompraspublicas.com.br/ | 200 | https://www.portaldecompraspublicas.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Licitanet | https://licitanet.com.br/ | 403 BLOCKED | https://licitanet.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Licitar Digital | https://licitar.digital/fornecedor/ | 200 | https://licitar.digital/fornecedor/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| ComprasBR | https://comprasbr.com.br/ | 200 | https://comprasbr.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | CONFLICT |
| Licita Mais Brasil | https://licitamaisbrasil.com.br/ | 200 | https://licitamaisbrasil.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| M2A Compras | https://compras.m2atecnologia.com.br/ | 200 | https://compras.m2atecnologia.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| ConLicitação | https://conlicitacao.com.br/ | 200 | https://conlicitacao.com.br/ | NAO_CONFIRMADO | PARCIAL | PARCIAL | PARTIAL |
| Licitei | https://www.licitei.com.br/ | 200 | https://www.licitei.com.br/ | NAO_CONFIRMADO | PARCIAL | PARCIAL | PARTIAL |
| Radar de Licitação | [DADO AUSENTE] | — | — | PARCIAL | PARCIAL | PARCIAL | REVALIDATE |
| Licita Já | https://www.liciteja.com.br/home.php | 200 | https://www.liciteja.com.br/home.php | PARCIAL | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| LicitaBrasil | https://licita-brasil.com/ | 200 | https://licita-brasil.com/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Visão Licita | https://www.visaolicita.com.br/ | 200 | https://www.visaolicita.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Atlas Público | https://licitacoes.atlaspublico.com.br/monitoramento/ | 200 | https://licitacoes.atlaspublico.com.br/monitoramento/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| PainelGov | https://www.painelgov.com.br/ | 200 | https://www.painelgov.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Licinexus | https://www.licinexus.com.br/ | 200 | https://www.licinexus.com.br/ | PARCIAL | PARCIAL | PARCIAL | PARTIAL |
| Edital.net | https://edital.net/precos | 200 | https://edital.net/precos | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Licitação Alerta | https://www.licitacaoalerta.com/ | 200 | https://www.licitacaoalerta.com/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| LicitaAI | https://www.licita.pro/ | 200 | https://www.licita.pro/ | PARCIAL | PARCIAL | PARCIAL | PARTIAL |
| Quero Licitação | https://querolicitacao.com.br/planos | 200 | https://querolicitacao.com.br/planos | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Licita Mais (FGE) | https://fgelicitamais.com.br/ | 200 | https://fgelicitamais.com.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| LicitaGov | https://licitagov.org/ | 200 | https://licitagov.org/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | CONFLICT |
| Portal de Compras SC | https://compras.sc.gov.br/ | 200 | https://compras.sc.gov.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Compras RJ / SIGA | https://compras.rj.gov.br/ | 200 | https://compras.rj.gov.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| SISLOG Goiás | https://sislog.go.gov.br/ | 200 | https://sislog.go.gov.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Portal de Compras MG | https://compras.mg.gov.br/ | 200 | https://compras.mg.gov.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Central de Compras PI | https://centraldecompras.sead.pi.gov.br/licitacoes/ | 200 | https://centraldecompras.sead.pi.gov.br/licitacoes/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Compras PR / PCA-E | https://www.planejamento.pr.gov.br/Pagina/PCA-E | 200 | https://www.planejamento.pr.gov.br/Pagina/PCA-E | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |
| Compras Pará | https://www.compraspara.pa.gov.br/ | 200 | https://www.compraspara.pa.gov.br/ | NAO_CONFIRMADO | NAO_CONFIRMADO | NAO_CONFIRMADO | PARTIAL |

## 7. Gaps: bloqueantes vs não bloqueantes

O aceite original da #80 pede inventário, URL ou `[DADO AUSENTE]`, HTTP (incluindo falha), evidência classificada, stack sem inferência, inconsistências documentadas e Swagger PNCP/Compras.gov. **Não** exige `CONFIRMADO` em Radar, Licinexus ou na planilha Drive.

`NAO_CONFIRMADO`, `CONFLICT`, `BLOCKED` e `REVALIDATE` são resultados válidos de auditoria.

| Gap | Classe | Bloqueia #80? | Destino |
|---|---|---|---|
| Radar: identidade / fonte primária / site de produto | evidência externa | Não | [#84](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/84) |
| Licinexus: spec da API / `X-API-Key` | evidência externa | Não | [#85](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/85) |
| Planilha Drive `.xlsm` | dado externo | Não — fora do aceite original | Só abrir issue se o time quiser importar |
| Licitanet 403 | HTTP `BLOCKED` | Não — a #80 pede registrar falha | Inventário |
| PNCP raiz `UNKNOWN` | HTTP neste runner | Não — Swagger/API OK | Inventário |

## 8. Como reproduzir

```bash
npm test -- __source_http_audit__.test.ts
npm run audit:sources
```

CI (`npm test`) cobre só os testes mockados. A auditoria viva **não** roda no push.
