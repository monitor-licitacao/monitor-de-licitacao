require('dotenv').config();
const { App } = require('@slack/bolt');
const axios = require('axios');
const { Client: NotionClient } = require('@notionhq/client');

const requiredEnvVars = ['SLACK_SIGNING_SECRET', 'SLACK_BOT_TOKEN', 'NOTION_API_KEY', 'NOTION_DATABASE_ID'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.warn(
    `[config] Variáveis de ambiente ausentes: ${missingEnvVars.join(', ')}. ` +
      'Preencha o arquivo .env antes de rodar em produção (veja .env.example).'
  );
}

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: false,
  port: process.env.PORT || 3000,
});

const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });

const FUNCTION_CALLBACK_ID = 'create_notion_task';
const TELEMETRY_EVENT_TYPE = 'notion_task_created_via_slack_workflow';

async function trackMetric(eventName, properties = {}) {
  try {
    if (process.env.AMPLITUDE_API_KEY) {
      await axios.post('https://api2.amplitude.com/2/httpapi', {
        api_key: process.env.AMPLITUDE_API_KEY,
        events: [
          {
            event_type: eventName,
            user_id: properties.user_id || 'unknown',
            event_properties: properties,
            time: Date.now(),
          },
        ],
      });
      return;
    }

    if (process.env.TELEMETRY_WEBHOOK_URL) {
      await axios.post(process.env.TELEMETRY_WEBHOOK_URL, {
        event_type: eventName,
        ...properties,
      });
      return;
    }

    console.warn(
      '[trackMetric] Nenhum destino configurado (AMPLITUDE_API_KEY ou TELEMETRY_WEBHOOK_URL). Evento descartado:',
      { event_type: eventName, ...properties }
    );
  } catch (err) {
    console.error('[trackMetric] Falha ao enviar evento de telemetria:', err.message);
  }
}

async function createNotionTask({ title, description, dueDate }) {
  const properties = {
    Name: {
      title: [{ text: { content: title } }],
    },
  };

  if (description) {
    properties.Description = {
      rich_text: [{ text: { content: description } }],
    };
  }

  if (dueDate) {
    properties['Due Date'] = {
      date: { start: dueDate },
    };
  }

  return notion.pages.create({
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties,
  });
}

app.function(FUNCTION_CALLBACK_ID, async ({ inputs, client, complete, fail }) => {
  const startedAt = Date.now();
  const { task_title, task_description, due_date, channel_id, slack_user_id } = inputs;

  let workspaceId = 'unknown';
  try {
    const authInfo = await client.auth.test();
    workspaceId = authInfo.team_id;
  } catch (authError) {
    console.warn('[create_notion_task] Não foi possível resolver workspace_id:', authError.message);
  }

  try {
    const notionPage = await createNotionTask({
      title: task_title,
      description: task_description,
      dueDate: due_date,
    });

    const durationMs = Date.now() - startedAt;
    const notionPageUrl = notionPage.url;

    if (channel_id) {
      await client.chat.postMessage({
        channel: channel_id,
        text: `✅ Tarefa criada no Notion: *${task_title}*\n${notionPageUrl}`,
      });
    }

    await trackMetric(TELEMETRY_EVENT_TYPE, {
      user_id: slack_user_id,
      workspace_id: workspaceId,
      success: true,
      duration_ms: durationMs,
    });

    await complete({
      outputs: {
        notion_page_url: notionPageUrl,
        success: true,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error('[create_notion_task] Erro ao executar a etapa:', error);

    if (channel_id) {
      try {
        await client.chat.postMessage({
          channel: channel_id,
          text: `❌ Falha ao criar tarefa no Notion: *${task_title}*\n\`\`\`${error.message}\`\`\``,
        });
      } catch (postError) {
        console.error('[create_notion_task] Falha ao notificar o canal sobre o erro:', postError.message);
      }
    }

    await trackMetric(TELEMETRY_EVENT_TYPE, {
      user_id: slack_user_id,
      workspace_id: workspaceId,
      success: false,
      duration_ms: durationMs,
      error_message: error.message,
    });

    await fail({ error: `Falha ao criar tarefa no Notion: ${error.message}` });
  }
});

(async () => {
  await app.start();
  console.log(`⚡️ Notion Task Creator rodando na porta ${process.env.PORT || 3000}`);
})();
