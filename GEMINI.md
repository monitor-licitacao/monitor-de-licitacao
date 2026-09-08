# 🏆 Regras de Ouro (Golden Rules) - Monitor de Licitações

Este documento define os princípios inegociáveis arquiteturais, de segurança e de desenvolvimento. Qualquer código, funcionalidade ou PR deve respeitar estritamente estas regras.

> **Importante:** Quando atuar no gerenciamento e criação de issues via Linear, o agente **deve** obrigatoriamente seguir as diretrizes documentadas em [LINEAR_RULES.md](./LINEAR_RULES.md).

---

## 1. Zero Alucinação em Minutas e Documentos Legais
* **A Regra**: É estritamente proibido utilizar modelos de IA para criar fornecedores, valores, marcas ou bases jurídicas que não existam no edital ou no banco de dados validado.
* **Por quê?**: Dados "inventados" geram responsabilidade jurídica e podem invalidar processos administrativos.
* **Como aplicar**: 
  - Fallbacks explícitos: Use `[DADO NÃO ENCONTRADO]` em vez de suposições.
  - Disclaimer: Toda minuta gerada por IA deve conter o aviso: *"Documento gerado por assistência de IA. Revisão humana obrigatória."*
  - Bloqueio de exportação: O botão "Baixar PDF" só é habilitado após o checkbox de revisão humana.

## 2. Apenas Integrações Reais (Fim da "Fachada")
* **A Regra**: É proibido subir mocks para produção sem sinalização visual explícita na UI.
* **Por quê?**: Usuários tomam decisões financeiras baseadas no status do monitoramento.
* **Como aplicar**:
  - Validadores de URL devem testar o status code real (200 OK).
  - Funcionalidades em teste devem exibir o badge `[BETA/MOCK]`.

## 3. Segurança e Custo Default-On
* **A Regra**: Nenhum endpoint que processe dados sensíveis ou consuma APIs pagas (Gemini) pode estar aberto ou sem limite.
* **Por quê?**: Prevenir ataques de negação de serviço (DoS) financeiro e vazamento de estratégia.
* **Como aplicar**:
  - Middleware de autenticação obrigatório em `/api/*`.
  - **Rate Limiting por Usuário:** Limitar chamadas de análise de IA para evitar picos de custo.
  - Chaves de API estritamente no servidor (`Process.env`).

## 4. Fonte da Verdade Persistida e Auditável
* **A Regra**: Estado crítico não vive em memória. Toda alteração de status de licitação deve deixar rastro.
* **Por quê?**: Em licitações, saber *quando* um edital foi capturado é tão importante quanto o conteúdo.
* **Como aplicar**:
  - Uso obrigatório de banco de dados (SQLite/Postgres).
  - **Log de Auditoria:** Toda alteração manual em campos de editais deve gravar `updated_at` e `user_id`.

## 5. Proveniência e Transparência (Citação de Fonte)
* **A Regra**: Nenhuma informação extraída por IA pode existir sem um link ou referência à página original do edital.
* **Por quê?**: O advogado/pregoeiro precisa conferir a fonte original rapidamente se houver dúvida.
* **Como aplicar**:
  - Sempre armazenar a `source_url` e o `timestamp` da captura.
  - Na UI, ao lado de cada resumo de IA, deve haver um ícone de "Ver no Edital Original".

## 6. Observador hospedado e privacidade
* **A Regra**: Se o produto oferece um “observer” hospedado (exibição de dashboards ou histórico), ele deve ser configurado para NÃO enviar dados sensíveis a provedores externos sem consentimento explícito.
* **Como aplicar**:
  - Use marcadores `<private>` nos modelos de dados que contenham informações de edital, fornecedor ou valores.
  - Quando o observer se conecta a um endpoint externo, inclua cabeçalho `Cache-Control: private, no-store` e garanta que o TLS esteja habilitado.
  - Documente a política de privacidade no README e nos termos de uso.
* **Motivo**: Licitações contêm informações estratégicas que não podem ser expostas inadvertidamente a terceiros, especialmente em ambientes de nuvem pública.

## 7. Eficiência de Tokens (Custo-Benefício)
* **A Regra**: Não envie o PDF inteiro para a IA se apenas uma seção for necessária.
* **Por quê?**: PDFs de licitação podem ter 200 páginas. Enviar tudo quebra o contexto e encarece o projeto.
* **Como aplicar**:
  - Filtragem prévia: Use lógica de busca por palavras-chave para recortar trechos (ex: "Objeto", "Cronograma", "Habilitação") antes de enviar ao Gemini.

## 8. Higiene de Git e Fluxo de Encerramento (Zero Debt)
* **A Regra**: É proibido encerrar uma sessão de trabalho ou abrir um PR com "Worktree Suja" (arquivos modificados não commitados) ou mensagens de commit genéricas.
* **Por quê?**: Para evitar a perda de progresso em caso de falhas locais e garantir que a IA (e outros desenvolvedores) entenda o histórico real do que foi implementado.

### 8.1. Commits Atômicos e Semânticos
- **Padrão**: Use [Conventional Commits](https://www.conventionalcommits.org/).
  - `feat:` para novas funcionalidades.
  - `fix:` para correção de bugs.
  - `docs:` para mudanças em documentação/regras.
  - `refactor:` para melhorias de código sem mudar lógica.
- **Proibição**: Commits genéricos como "update", "arrumando coisas" ou "wip" são inaceitáveis.

### 8.2. Encerramento de Sessão (The Departure Rule)
Ao terminar uma tarefa ou o dia de trabalho:
1. **Sync**: Branch atualizada com a `main`.
2. **No Pendings**: Não deixe arquivos soltos. Use `git stash` ou commit `wip:`.
3. **Push Imediato**: O código funcional deve estar no remote.

### 8.3. Protocolo de Pull Request (PR)
- **Checklist de PR**: Código compila sem erros, limpo de logs, e respeitando a Regra 1 (Zero Alucinação).
- **Small PRs**: Máximo de 300-400 linhas de código por PR.

### 8.4. Deploy Seguro
- **Estado da Main**: A branch `main` é sagrada e sempre "pronta para deploy".
- **Migrações e Neon Database**: O banco de dados SaaS (PostgreSQL via Neon) deve usar a técnica de **Database Branching**. Alterações de banco (`drizzle-kit generate`) acompanham a feature branch. Consulte [NEON_RULES.md](./docs/NEON_RULES.md) para políticas de RLS e deploys seguros de esquema.

## 9. Abstração de Infraestrutura de IA (Managed AI)
* **A Regra**: A inteligência deve ser nativa e o gerenciamento de tokens centralizado.
* **Por quê?**: Segurança (impede vazamento de chaves), consistência de regras e monetização (AI-as-a-Service).
* **Como aplicar**:
  - Nunca solicite ao usuário uma chave de API para funções nativas do sistema.
  - Se houver falha de cota, instrua o usuário a verificar o saldo no dashboard e não a trocar chaves de API.
  - Use sempre o endpoint `/api/proxy/gemini` (ou equivalente no Cloudflare/backend) para operações de LLM.

## 10. Priorização Baseada em Bloqueadores
* **A Regra**: A cosmética nunca passa na frente da fundação.
* **Hierarquia de Implementação**:
  1. Integridade Jurídica (Zero alucinação).
  2. Segurança e Autenticação.
  3. Estabilidade da Conexão/Scraping.
  4. Persistência de Dados.
  5. Refinamento de UI/UX.

---

> **Comando de Sistema / Instrução para Agentes IA:**
> Sempre que finalizar uma implementação, você deve sugerir o comando de commit adequado seguindo os Conventional Commits e lembrar o usuário de verificar se há arquivos pendentes antes de mudar de contexto.
## 10. Automação e Fiscalização (Compliance)
* **Pre-commit Hook**: É obrigatório o uso de Husky/Lint-staged para impedir commits que quebrem o linter ou contenham segredos (`.env`).
* **Conventional Commits**: Bloquear commits que não sigam o padrão `type: description`.
* **Clean Worktree**: Antes de cada PR, rodar o script `npm run check-health`.

### Comandos de Atalho:
- `npm run commit`: Guia assistido para criar um commit semântico.
- `npm run pr`: Checklist automático de segurança antes do push.

## 🛠️ SKILLS & EXECUTION (Comandos de Ativação)

Sempre que eu usar uma palavra-chave com `/`, ative a skill correspondente seguindo as regras abaixo:

### /audit
- **Ação**: Revise o código atual comparando-o com as Regras de Ouro.
- **Saída**: Liste apenas o que viola as regras e sugira a correção imediata.

### /scrape [URL]
- **Ação**: Ative a skill `Legal_Scraper_Architect`.
- **Regra**: Proponha uma estratégia de retry e um fallback para caso o seletor mude. Verifique se a URL é válida (Regra 2).

### /minuta [CONTEÚDO]
- **Ação**: Ative `Anti_Hallucination_Writer`.
- **Regra**: Se o [CONTEÚDO] não tiver o valor da licitação ou nome do órgão, insira `[DADO AUSENTE]` e nunca invente um valor. Use tom formal jurídico.

### /db-sync
- **Ação**: Ative `SQL_Persistence_Guardian`.
- **Regra**: Verifique se a nova funcionalidade está salvando o estado no banco. Se estiver usando `useState` para dados globais, sugira a migração para a camada de persistência.

### /ship
- **Ação**: Ative `Git_Workflow_Manager`.
- **Regra**: Verifique o status da worktree, sugira o comando de commit semântico e gere um resumo para o Pull Request focado no impacto técnico.

### /ploomes
- **Ação**: Ative `Ploomes_Integrator`.
- **Regra**: Você conhece a API v2 do Ploomes (OData). Sempre que gerar código para o CRM, use o padrão de Cloudflare Functions ou integrações serverless. Nunca use a chave do Ploomes no código estático (use variáveis de ambiente). Sempre verifique se o 'Deal' já existe antes de criar um novo (Upsert Logic via `$filter=contains()`). O resumo enviado deve conter *"Extraído via IA - Conferir Edital Original"*.

### Regras de Invocação das Skills:
1. **O Gatilho Visual**: Ao iniciar uma Skill, comece a resposta com `[SKILL ATIVA: Nome da Skill]`.
2. **Contexto Mínimo**: Se faltar contexto (ex: schema do banco, link do edital), não prossiga. Peça os dados que faltam antes de gerar código.
3. **Cadeia de Pensamento**: Para `/scrape` e `/minuta`, use a técnica Step-by-Step. Planeje a extração/redação, verifique contra as Regras de Ouro e só então entregue o resultado final.

## 🏁 Protocolo de Encerramento de Task e Sessão
Sempre que eu disser que terminei uma tarefa ou o meu dia de trabalho, você (IA) DEVE iniciar o fluxo automatizado respondendo estritamente com:

1. **Validação de Regra 1**: "Você confirmou que não há dados alucinados inseridos antes de fecharmos?"
2. **Resumo do Ship**: Gere um breve resumo do que foi implementado.
3. **Automação Obrigatória**: Sugira que eu rode imediatamente o comando de encerramento via terminal.
   > **Execute o comando abaixo para finalizar:**
   > `npm run auto-ship`

*(Nota: O script `auto-ship.sh` cuida sequencialmente de rodar o `check-health`, fazer o `git add .`, iniciar o `git-cz` (commit semântico) e dar `git push`. Merge e Deploy seguem via CI/CD no repositório remoto).*
