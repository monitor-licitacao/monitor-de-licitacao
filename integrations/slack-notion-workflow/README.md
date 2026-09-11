# Notion Task Creator — Custom Step para o Slack Workflow Builder

Cria uma tarefa no Notion e registra telemetria (Amplitude) sempre que esta etapa roda dentro de um Workflow do Slack.

## Aviso técnico importante

O pedido original descrevia a API legada **"Workflow Steps from Apps"** (`app.workflowStep()`, escopo `workflow.steps:execute`). Essa API foi **descontinuada pelo Slack em 26/09/2024** — não é mais possível habilitar esse escopo em nenhum app.

Este projeto usa o substituto oficial: **Custom Steps via Slack Functions** (`app.function()`), que cumpre exatamente o mesmo objetivo. Vantagem extra: o modal de configuração dos campos é gerado automaticamente pelo Workflow Builder a partir do `manifest.json`.

Referências oficiais:
- [Changelog da descontinuação](https://docs.slack.dev/changelog/2023-08-workflow-steps-from-apps-step-back/)
- [Custom Steps](https://docs.slack.dev/tools/bolt-js/tutorials/custom-steps/)

## Estrutura do projeto

```
slack-notion-workflow/
├── manifest.json     # Manifest do Slack App
├── app.js            # Código principal (Bolt.js)
├── package.json
├── .env.example      # Template de variáveis de ambiente
└── .gitignore
```

## Pré-requisitos

- Node.js 18+
- Uma conta no [Slack API](https://api.slack.com/apps) com permissão para criar apps
- Uma [integração interna do Notion](https://www.notion.so/my-integrations) com acesso ao banco de dados
- Uma conta no Amplitude com API Key
- [ngrok](https://ngrok.com/download) instalado (para desenvolvimento local)

## Setup

### 1. Criar o Slack App

1. Acesse https://api.slack.com/apps → **Create New App** → **From an app manifest**
2. Selecione o workspace
3. Cole o conteúdo de `manifest.json`
4. Nos placeholders `https://SEU-SUBDOMINIO.ngrok-free.app/slack/events`, use a URL que o ngrok vai gerar (passo 5)
5. Em **OAuth & Permissions**, copie o **Bot User OAuth Token** (`xoxb-...`) → `.env` como `SLACK_BOT_TOKEN`
6. Em **Basic Information**, copie o **Signing Secret** → `.env` como `SLACK_SIGNING_SECRET`

### 2. Configurar Notion

1. Crie um banco de dados no Notion com colunas:
   - `Name` (title)
   - `Description` (text, opcional)
   - `Due Date` (date, opcional)
2. Em https://www.notion.so/my-integrations, crie uma integração interna → copie o **Internal Integration Secret** → `.env` como `NOTION_API_KEY`
3. No Notion, menu `•••` → **Connections** → conecte a integração
4. Copie o ID do banco de dados da URL (32 caracteres antes de `?v=`) → `.env` como `NOTION_DATABASE_ID`

### 3. Configurar Amplitude

1. Acesse Amplitude > Configurações do Projeto > API Key
2. Copie a chave → `.env` como `AMPLITUDE_API_KEY`

### 4. Instalação local

```bash
cd integrations/slack-notion-workflow
npm install
cp .env.example .env
# edite .env com as chaves reais
```

### 5. Executar

Terminal 1:
```bash
npm start
# ⚡️ Notion Task Creator rodando na porta 3000
```

Terminal 2:
```bash
ngrok http 3000
# Forwarding  https://a1b2c3d4e5.ngrok-free.app -> http://localhost:3000
```

Copie a URL do ngrok (com `/slack/events` no final) e atualize em https://api.slack.com/apps → seu app:
- **Event Subscriptions** → **Request URL**
- **Interactivity & Shortcuts** → **Request URL**

## Testar

1. No Slack, **Automations** → **Create Workflow**
2. Escolha um disparador
3. **Add step** → **Notion Task Creator** → preencha os campos
4. Publique e execute
5. Verifique a mensagem no canal e a tarefa criada no Notion
6. Em Amplitude, busque o evento `notion_task_created_via_slack_workflow`

## Variáveis de ambiente

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `SLACK_SIGNING_SECRET` | Sim | App Config > Basic Information |
| `SLACK_BOT_TOKEN` | Sim | App Config > OAuth & Permissions |
| `NOTION_API_KEY` | Sim | notion.so/my-integrations |
| `NOTION_DATABASE_ID` | Sim | URL do banco de dados no Notion |
| `AMPLITUDE_API_KEY` | Sim | Amplitude > Configurações do Projeto |
| `PORT` | Não (padrão 3000) | — |

## Deploy em produção

Substitua ngrok por uma URL pública estável (Render, Fly.io, Railway, etc.), atualize as Request URLs no app config do Slack e mantenha o processo rodando com `pm2` ou systemd.
