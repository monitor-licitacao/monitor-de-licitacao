# 🏆 Regras de Ouro (Golden Rules) do Projeto

Este documento define os princípios inegociáveis arquiteturais, de segurança e de desenvolvimento para o **Monitor de Licitações**. Qualquer código, funcionalidade ou PR adicionado ao projeto deve respeitar estritamente estas regras.

---

## 1. Zero Alucinação em Minutas e Documentos Legais
* **A Regra**: É estritamente proibido utilizar modelos de IA Generativa para criar fornecedores, valores, marcas ou bases jurídicas que não existam no edital ou no banco de dados validado. 
* **Por quê?**: O sistema gera peças para processos administrativos legais. Dados "inventados" (hallucinations) geram alto risco de responsabilidade jurídica para o usuário.
* **Como aplicar**: 
  - Todo fallback de IA deve ser explícito sobre a falta de dados (ex: `[DADO NÃO ENCONTRADO]`) em vez de preencher com valores genéricos (como nomes de marcas famosas).
  - Toda minuta gerada por IA deve possuir um aviso visual de que passou por IA.
  - Exigir "Aceite de Revisão Humana" antes de permitir a cópia/exportação de documentos.

## 2. Apenas Integrações Reais (Fim da "Fachada")
* **A Regra**: É proibido subir para produção (ou para a branch principal) simulações de regras de negócio críticas (mocks) sem que a UI deixe explicitamente claro que é uma simulação.
* **Por quê?**: Para evitar que usuários e stakeholders confiem em dados não validados (ex: achar que um site está ativo quando não está, ou que um e-mail/WhatsApp foi enviado quando não foi).
* **Como aplicar**:
  - Validadores de URL (`/validate-url`) devem realizar chamadas de rede autênticas.
  - Acionamentos externos (notificações) que não estejam conectados devem estar desativados ou marcados com tag `[Em Desenvolvimento]`.

## 3. Segurança Default-On
* **A Regra**: Nenhum endpoint que processe dados sensíveis, altere estado do banco ou consuma APIs pagas (como a Google Gemini) pode estar aberto.
* **Por quê?**: Prevenir abusos, vazamento de dados estratégicos de licitações e custos desenfreados de cloud/LLM.
* **Como aplicar**:
  - Middleware de autenticação é obrigatório em todas as rotas `/api/*`.
  - Rate limiting deve proteger rotas pesadas.
  - Chaves de API (`GEMINI_API_KEY`, etc.) só existem no backend e **nunca** transitam para o client.

## 4. Fonte da Verdade Persistida
* **A Regra**: Variáveis em memória não são banco de dados.
* **Por quê?**: O ciclo de vida do servidor (restart, deploy, crash) não pode significar perda do histórico de monitoramento de editais.
* **Como aplicar**:
  - Todo estado persistente (Sources, Editais, Notificações) deve ser escrito em um banco de dados real (SQLite no mínimo).

## 5. Priorização Baseada em Bloqueadores
* **A Regra**: A cosmética nunca passa na frente da fundação.
* **Como aplicar**:
  1. Bloqueadores de uso (Riscos jurídicos, Segurança).
  2. Fundações técnicas (Banco de dados, Integrações reais).
  3. Fluxos principais do usuário.
  4. Resiliência (Timeout, tratamento de erro).
  5. Refinamento de UI/UX.
