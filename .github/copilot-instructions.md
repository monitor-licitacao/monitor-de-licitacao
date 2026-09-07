# Instruções Customizadas do GitHub Copilot (Monitor de Licitações)

Este repositório possui Regras de Ouro inegociáveis. Como assistente de IA, você **deve** seguir estas diretrizes em todas as sugestões de código, refatorações ou explicações:

## 1. Zero Alucinação (Obrigatório)
- **Nunca invente** dados jurídicos, valores de licitação, CNPJs, nomes de fornecedores ou referências a artigos de lei que não existam no contexto ou no banco de dados.
- Ao redigir minutas ou PDFs, adicione explicitamente o disclaimer: *"Documento gerado por assistência de IA. Revisão humana obrigatória."*
- Na falta de um dado, utilize a string de fallback `[DADO AUSENTE]`.

## 2. Apenas Integrações Reais
- **Não crie Mocks de UI** (dados fixos) sem incluir um badge claro na interface indicando `[BETA/MOCK]`.
- Assegure-se de que testes de URL (web scraping) sempre verifiquem por HTTP 200 OK.

## 3. Segurança e Custos
- Endpoints em `/api/*` precisam de middleware de autenticação obrigatório.
- Funcionalidades envolvendo IA (como Gemini) devem considerar controle de *Rate Limiting*.
- Senhas, chaves de API e segredos nunca devem aparecer hardcoded; utilize sempre variáveis de ambiente e injete via servidor.

## 4. Eficiência e Tratamento de Erros
- Implemente rotinas de fallback (*Graceful Degradation*) ao consultar fontes externas instáveis (ex: portais do governo).
- Não envie textos integrais de PDFs para APIs de LLM caso apenas fragmentos sejam necessários. Implemente cortes lógicos primeiro.
- Adicione blocos de `try/catch` de forma defensiva em conexões e scrapers.

## 5. Banco de Dados e Auditoria
- As alterações de estado devem ser salvas no banco com trilhas de auditoria (`updated_at`, `user_id`, etc).
- Para integrações externas (ex: Ploomes), verifique se o recurso existe antes de criar (lógica de *Upsert*).

## 6. Qualidade de Código (Clean Code)
- Respeite sempre a estrutura existente. No Frontend (React), não adicione frameworks de CSS indiscriminadamente se não solicitado (use os padrões do projeto base).
- Evite refatorações longas e cosméticas que deixem de lado os problemas bloqueadores originais.
- Certifique-se de que os imports estão sendo feitos corretamente das dependências existentes (veja o `package.json`).

> **Nota para o Copilot**: Sempre avalie as sugestões considerando se a resposta está compatível com as 6 regras acima. Em caso de dúvidas estruturais, baseie-se nos padrões de arquivos vizinhos no projeto.
