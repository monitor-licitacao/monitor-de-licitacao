# 🚀 Boas Práticas e Regras para o Neon (Serverless Postgres)

Este documento define as regras operacionais para trabalharmos com o banco de dados Neon no ambiente do **Monitor de Licitações SaaS**.

## 1. Database Branching (O Poder do Neon)
Assim como o Git, o Neon permite criar branches do seu banco de dados. Nunca teste esquemas destrutivos (como `DROP TABLE`) no banco de produção.
* **Regra**: Toda nova feature grande que exija alteração de banco deve usar uma **branch do Neon**.
* **Como fazer**: 
  - Rode `npx neon branch create [nome-da-feature]`
  - Atualize seu `.env` local com a connection string gerada.
  - Teste as alterações (usando Drizzle).
  - Faça o deploy das alterações para a branch `main`/`production`.

## 2. Drizzle ORM como Fonte da Verdade
Nunca crie tabelas ou faça `ALTER TABLE` manualmente via console SQL.
* **Regra**: Toda a estrutura deve residir em `server/db/schema.ts`.
* **Fluxo obrigatório**:
  1. Modifique `schema.ts`.
  2. Rode `npx drizzle-kit generate` (gera os arquivos SQL de migração).
  3. Rode `npx drizzle-kit push` (aplica no Neon) ou migre em produção usando o seu CI/CD.

## 3. Isolamento Multi-Tenant (RLS)
Sendo um SaaS para empresas licitantes, a segurança no nível da linha (Row-Level Security) é mandatória.
* **Regra**: Toda tabela sensível (`editais`, `sources`, `tenant_configs`) deve ter uma coluna `tenant_id`.
* **Prática**: Ao conectar no Postgres via script backend, certifique-se de configurar a sessão (usando `set_config` ou equivalente) para que as policies RLS nativas do banco atuem, prevenindo vazamentos lógicos entre clientes.

## 4. Otimização de Conexões Serverless
Em ambientes como Cloudflare Workers ou funções serverless, conexões normais (TCP) podem esgotar.
* **Regra**: Sempre prefira a conexão via HTTP/WebSocket otimizada fornecida pelo driver serverless do Neon (`@neondatabase/serverless`) ao publicar o bot em produção na Cloudflare.
* Não crie uma nova connection pool a cada requisição HTTP, instancie-a fora do handler (em escopo global do worker).

## 5. Deployment Contínuo (Neon Deploy)
* O comando `npx neon deploy` deve ser disparado após validações de CI/CD para garantir que as branches de schema estejam sincronizadas.
