---
name: code-review
description: Diretrizes de Code Review automatizado e manual para Pull Requests no GitHub, auditando conformidade com as Regras de Ouro, segurança, zero alucinação jurídica e higienização de commits.
---

# 🔍 Skill: GitHub Code Review — Monitor de Licitações

Esta skill define as diretrizes obrigatórias de **Code Review** para Pull Requests (PRs) e auditorias de código no repositório do Monitor de Licitações.

---

## 🎯 Objetivo

Garantir que todo código submetido via PR atenda estritamente aos padrões de **qualidade executiva, segurança, resiliência operacional, higiene de Git e conformidade jurídica (Zero Alucinação)**.

---

## 🛡️ Pilares de Auditoria (Regras de Ouro)

Sempre que realizar a revisão de um código ou PR, verifique rigorosamente os 6 pilares abaixo:

### 1. Zero Alucinação Jurídica (Regra 1)
- [ ] **Sem dados fictícios:** Nenhuma IA ou lógica de código pode inventar fornecedores, valores, marcas ou CNPJs inexistentes no edital original.
- [ ] **Fallbacks explícitos:** O código utiliza `[DADO NÃO ENCONTRADO]` em vez de suposições quando faltam dados.
- [ ] **Disclaimer obrigatório:** Toda minuta gerada por IA inclui o aviso: *"Documento gerado por assistência de IA. Revisão humana obrigatória."*
- [ ] **Exportação protegida:** O botão de download em PDF de minutas exige validação/checkbox de revisão prévia.

### 2. Integrações Reais & Resiliência (Regras 2 e 6)
- [ ] **Sem mocks em produção:** Não há endpoints ou conectores que simulam dados sem o badge visual `[BETA/MOCK]`.
- [ ] **Graceful Degradation:** Chamadas a APIs externas (PNCP, Sesc, Paradigma) possuem timeouts rigorosos (`AbortSignal.timeout`) e tratam falhas sem derrubar o servidor.
- [ ] **Mensagens de erro limpas:** Portais fora do ar retornam avisos de desatualização cacheada em vez de erro de execução (crash 500).

### 3. Segurança & Proteção de Custos (Regra 3 & 9)
- [ ] **Autenticação de API:** Endpoints sob `/api/*` possuem middleware de autenticação (JWT Bearer ou header `x-api-key`).
- [ ] **Sem vazamento de chaves:** Chaves de API (Gemini, XAI, Notion, Hetzner, Amplitude) são lidas exclusivamente de `process.env` e protegidas no `.gitignore`.
- [ ] **Rate Limiting:** Rotas que consomem chamadas de LLM ou tarefas pesadas possuem limitadores de taxa (express-rate-limit).
- [ ] **Managed AI Proxy:** Chamadas de IA utilizam a abstração do servidor em vez de expor credenciais no frontend.

### 4. Proveniência & Persistência Auditável (Regras 4 e 5)
- [ ] **Rastro de alterações:** Mudanças de status de licitações ou deals registram `updated_at`, `user_id` e logs de auditoria (`crm_logs`).
- [ ] **Citação de fonte:** Toda informação extraída por IA mantém a referência (`source_url`) e link para o edital original.
- [ ] **Cofre GCS (PDF Vault):** Editais possuem hash `sha256_hash` e armazenamento seguro no Google Cloud Storage quando baixados.

### 5. Telemetria & Analytics (Amplitude Integration)
- [ ] **Agent Analytics (`@amplitude/ai`):** Interações de IA disparam eventos `[Agent] User Message`, `[Agent] AI Response` e `[Agent] Tool Call` com contagem de tokens e latência.
- [ ] **Client Tracking (`@amplitude/unified`):** Ações críticas da UI disparam eventos no formato `Verbo Objeto` (ex: `Viewed GCS Vault PDF`).

### 6. Higiene de Git & Tamanho de PR (Regra 8)
- [ ] **Conventional Commits:** Commits seguem o padrão `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- [ ] **PRs Atômicos:** O PR tem no máximo 300-400 linhas alteradas e foca em um único objetivo.
- [ ] **Worktree Limpa:** Sem arquivos temporários (`.env`, `.wrangler/`, `dist/`, logs) inclusos no PR.

---

## 📝 Formato de Parecer do Code Review

Ao finalizar a revisão de um PR, responda com o parecer no formato estruturado abaixo:

```markdown
## 🔍 Parecer de Code Review

### Status: [ 🟢 APROVADO | 🟡 APROVADO COM RESSALVAS | 🔴 ALTERAÇÕES SOLICITADAS ]

#### Summary das Mudanças
- Briefing conciso das alterações do PR.

#### Checklist de Conformidade (Regras de Ouro)
- [x] Zero Alucinação Jurídica & Disclaimers
- [x] Segurança (Auth / Rate Limiting / Env Secrets)
- [x] Resiliência & Timeouts HTTP
- [x] Telemetria Amplitude / Agent Analytics
- [x] Commits Semânticos & Worktree Limpa

#### Pontos de Atenção / Sugestões
1. **[Linha XX]**: Sugestão de melhoria ou correção.

#### Comando de Verificação Recomendado
`npm run test`
```

---

## 🚀 Como Ativar esta Skill

No chat ou workflow do GitHub Actions, ative utilizando a tag:
`/review` ou invocando a skill `code-review`.
