# 📄 PRD: Integração Monitor de Licitações ↔ Ploomes CRM (MVP)

**Versão:** 1.0 (Integração de Pipeline)
**Status:** Definição Técnica
**Prioridade:** Alta (Bloqueador de MVP)

## 1. Visão Geral
Conectar a inteligência de captura e análise de editais diretamente ao CRM Ploomes. Quando o **Analyst Bot** classificar uma licitação como "Apta para Participação", o sistema deve criar automaticamente um **Negócio (Deal)** no Ploomes, anexando o resumo da IA e o link do edital.

## 2. Personas e Casos de Uso
*   **Gestor Comercial:** Quer ver o funil de licitações futuras dentro do Ploomes sem sair da ferramenta.
*   **Analista de Licitação:** Precisa que os documentos e prazos extraídos pela IA apareçam como "Interações" ou "Campos Personalizados" no card do Ploomes.

## 3. Requisitos Funcionais (Features)

### F1. Autenticação Segura (Managed Key)
*   Seguindo as **Regras de Ouro**, a `User-Key` do Ploomes será armazenada no **Cloudflare Secrets**.
*   O frontend nunca terá acesso à chave. Todas as chamadas passarão por uma **Cloudflare Function** (`/api/crm/sync`).

### F2. Mapeamento de Entidades (Monitor ⮕ Ploomes)
Cada licitação encontrada será convertida conforme o esquema:
*   **Negócio (Deals):** O título será `[LICITAÇÃO] - [Órgão] - [Objeto]`.
*   **Valor:** Preço estimado da licitação (extraído pelo Analyst Bot).
*   **Contato:** Se houver pregoeiro identificado, criar/vincular um Contato.
*   **Campos Personalizados:**
    *   `Data de Abertura` (Mapeado para o campo de data do Ploomes).
    *   `Link do Edital` (Link direto para a fonte).
    *   `Resumo da IA` (Inserido na primeira interação/comentário do Negócio).

### F3. Gatilho de Sincronização (Webhooks de IA)
*   O envio para o Ploomes só ocorre após a aprovação humana ou após o robô atingir um score de aderência > 80%.
*   Se o status da licitação mudar no Monitor (ex: edital suspenso), o Negócio no Ploomes deve ser atualizado ou movido para "Perdido/Suspenso".

---

## 4. Requisitos Técnicos e API (Ploomes)

### Endpoints Principais (API v2):
*   **Base URL:** `https://api2.ploomes.com/`
*   **Autenticação:** Header `User-Key: {API_KEY}`.
*   **Criação de Negócio:** `POST /Deals`
    *   *Payload Sugerido:*
        ```json
        {
          "Title": "Licitação 123/2024 - Prefeitura de Navegantes",
          "Amount": 150000.00,
          "PipelineId": 12345,
          "StageId": 67890,
          "OtherProperties": [
            { "FieldId": "link_edital", "Value": "https://..." },
            { "FieldId": "resumo_ia", "Value": "Objeto: Compra de mobiliário..." }
          ]
        }
        ```

### OData & Expansão:
*   Para verificar se uma licitação já existe no Ploomes e evitar duplicidade, usaremos filtros OData:
    *   `GET /Deals?$filter=contains(Title, '123/2024')`

---

## 5. Regras de Negócio e Compliance (Regras de Ouro)
1.  **Regra de Ouro nº 1 (Anti-Alucinação):** O resumo enviado para o Ploomes deve conter o disclaimer: *"Extraído via IA - Conferir Edital Original"*.
2.  **Regra de Ouro nº 3 (Segurança):** O sistema deve implementar *Rate Limiting* para evitar exceder o limite da API do Ploomes durante o rastreamento em massa.
3.  **Auditabilidade:** Toda criação de Negócio deve salvar o `Ploomes_ID` no nosso banco de dados (SQLite/Postgres) para rastreio futuro (Regra de Ouro nº 4).

## 6. Métricas de Sucesso
*   **SLA de Sincronização:** O negócio deve aparecer no Ploomes em menos de 10 segundos após a qualificação da IA.
*   **Integridade de Dados:** 100% dos valores financeiros extraídos da licitação devem corresponder ao campo "Valor" no Ploomes.
