# Monitor de Licitações

Plataforma para descobrir, coletar e interpretar dados públicos de contratações (PNCP e Compras.gov.br). Stack: React (Vite) + Express + Drizzle + Neon.

## Setup local

Use **apenas npm**. Guia completo, recuperação no Windows e o erro de `bin metadata` do Bun: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```bash
npm ci
npm run dev
```

## Documentação

- [Setup local](docs/DEVELOPMENT.md)
- [Git workflow](docs/GIT_WORKFLOW.md)
- [PRD v2](doc/PRD-v2-plataforma-inteligencia-licitacoes.md)
- [Índice docs](docs/SUMMARY.md)
- [Auditoria de fontes (#80)](docs/source-audit-issue-80.md) (`npm run audit:sources`)
- [Domain Registry PNCP (#81)](docs/pncp-domains.md) (`npm run worker:pncp-domains`)
