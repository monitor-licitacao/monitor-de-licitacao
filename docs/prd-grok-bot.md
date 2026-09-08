# 📄 PRD: Módulo de Agentes Autônomos - Monitor de Licitações
**Versão:** 2.0 (Foco em Infraestrutura Gerenciada e Deprecação de Chaves Externas)
**Público-Alvo:** Analistas de Licitação, Bidders, Equipes de Vendas B2G (Business-to-Government).

## 1. Mudança de Paradigma: Managed AI (Fim da Chave de API)
*   **Status Atual:** O usuário/desenvolvedor insere uma `GEMINI_API_KEY` manualmente.
*   **Nova Regra:** A inteligência é nativa. O sistema utiliza um **Proxy Gerenciado via Cloudflare Workers**, ocultando a complexidade e o custo direto do usuário final.
*   **Por quê?**:
    1.  **Segurança:** Impede o vazamento de chaves no frontend.
    2.  **Consistência:** Garante que todos os bots usem a mesma versão do modelo e as mesmas "Regras de Ouro".
    3.  **Monetização:** Permite criar planos (Ex: Plano Básico = 50 análises de editais/mês; Plano Pro = Ilimitado).

---

## 2. O Problema (Visão Geral)
Participar de licitações exige um esforço operacional massivo:
* Monitorar dezenas de portais governamentais diariamente requer logins manuais.
* Ler editais em PDF de 50 a 100 páginas para encontrar requisitos específicos.
* Fazer o upload manual de propostas e dezenas de certidões negativas em portais lentos.
* Erros humanos por desatenção podem desclassificar a empresa.

---

## 3. Como Funcionaria (A Solução)
O sistema utilizará uma "frota" de bots especializados que operam em máquinas virtuais na nuvem (24/7), navegando pelos portais governamentais como se fossem usuários humanos (já que não há APIs abertas consistentes).

### 🔄 Fluxo de Trabalho Integrado (O "Caminho Feliz")
1. **Rastreamento (Scout Bot):** O bot acessa os portais diariamente, faz login, aplica os filtros da empresa e traz as oportunidades para o dashboard.
2. **Análise de Edital (Analyst Bot):** Ao encontrar uma licitação aderente, o bot baixa o Edital, lê o documento completo e extrai um resumo para o analista humano.
3. **Montagem do Dossiê (Compiler Bot):** O bot acessa as pastas da empresa, coleta as certidões e atestados solicitados, gerando um pacote pronto para envio.
4. **Submissão e Pregão (Sniper Bot):** Com a proposta aprovada pelo humano, o bot faz o upload dos documentos e, no pregão, insere lances automaticamente respeitando o piso.

---

## 4. Arquitetura dos Agentes (Os "Trabalhadores de Borda")
O sistema funcionará através de Cloudflare Browser Rendering ou VMs dedicadas, orquestradas pelo `GEMINI.md`.

### 🤖 Agent A: O Scout (Buscador)
*   **Missão:** Navegar em portais como ComprasNet sem API.
*   **Habilidade:** Identificar botões de "Login" e "Busca" via visão computacional (Gemini 1.5 Vision).
*   **Saída:** JSON com lista de novas licitações.

### 🤖 Agent B: O Analyst (Leitor de Edital)
*   **Missão:** Ler PDFs de 100 páginas.
*   **Habilidade:** Extrair "Cláusulas Impeditivas" e "Datas Críticas".
*   **Regra de Ouro:** Seguir a Regra 1 (Zero Alucinação). Se ambíguo, marcar para revisão humana.

---

## 5. Requisitos do Produto (Épicos e Features)

### Épico 1: Automação de Interface (UI Navigation)
* **Feature 1.1 - Login Unificado:** Cofre seguro no sistema para e-CPF/e-CNPJ. Os bots usam essas credenciais para os portais.
* **Feature 1.2 - "Teach a Task":** Usuário grava a tela fazendo um fluxo, e o bot aprende onde clicar.

### Épico 2: Orquestração e Colaboração de Bots
* **Feature 2.1 - Squad de Licitação:** Perfis especializados (Scout, Analyst, Compiler, Sniper).
* **Feature 2.2 - Hand-off Automático:** O Scout passa oportunidades pro Analyst automaticamente.

### Épico 3: Supervisão Humana (Human-in-the-Loop)
* **Feature 3.1 - Barreira de Aprovação Financeira:** O bot **nunca** submete proposta sem clique de "Aprovar Estratégia de Preço".
* **Feature 3.2 - Revisão de Documentos:** Checklist visual antes da submissão.

### Épico 4: Memória Contextual
* **Feature 4.1 - Histórico de Concorrentes:** Armazena preços ganhadores do passado.
* **Feature 4.2 - Base de Conhecimento:** Sabe cruzar catálogos da empresa com o Termo de Referência.

### Épico 5: Infraestrutura de IA e Segurança
*   **Feature 5.1 - Centralização de Tokens:** Implementação de `AI Gateway`. O frontend chama um endpoint interno `/api/proxy/gemini` (via Cloudflare Workers), que injeta a chave secreta. O usuário final não gerencia tokens.
*   **Feature 5.2 - Rate Limiting e Quotas por Usuário:** Contador de consumo de tokens associado à assinatura do cliente.

### Épico 6: Plataforma SaaS (Multi-Tenant & White-label)
*   **Feature 6.1 - Multi-Tenancy (Isolamento de Dados):** O sistema será vendido para múltiplos clientes comerciais. O banco de dados (PostgreSQL via Supabase) utilizará Row Level Security (RLS) associado ao `tenant_id` para garantir que um cliente jamais acesse dados, fontes ou editais de outro.
*   **Feature 6.2 - UI White-label:** Interface dinâmica que puxa o logotipo (`logo_url`) e as cores da marca (`primary_color`) do banco de dados de acordo com o `tenant` logado, permitindo revenda corporativa customizada.

---

## 6. Requisitos de Fluxo (Managed Agent Flow)
1.  **Requisição:** O frontend solicita a análise de um edital.
2.  **Auth Proxy:** A Cloudflare Function valida se o usuário tem saldo/assinatura.
3.  **Injeção de Contexto:** A Function anexa as Regras de Ouro como `System Instruction`.
4.  **Processamento:** O Gemini processa o PDF e retorna os dados.
5.  **Entrega:** Usuário recebe o resumo pronto.

---

## 7. Plano de Deprecação (Migration Path)
1.  **Fase 1 (Sprints 1-2):** Manter suporte opcional à chave manual para desenvolvedores (Legacy Mode).
2.  **Fase 2 (Sprints 3-4):** Introduzir o "Proxy do Monitor". Incentivar migração para infra gerenciada.
3.  **Fase 3 (Encerramento):** Remover campo de chave das configurações. Inteligência vira nativa da assinatura.

---

## 8. Métricas de Sucesso (KPIs)
* **Tempo de Descoberta a Proposta (TDP):** Redução do tempo médio de 4 horas para 15 minutos.
* **Volume de Participação:** Aumento de licitações mensais.
* **Taxa de Desclassificação Técnica:** Redução a zero de desclassificações por falta de documentos.
