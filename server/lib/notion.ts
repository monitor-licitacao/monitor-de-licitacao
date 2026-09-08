import { Client } from "@notionhq/client";
import { AuditData, AuditDataSchema } from "./notionSchema.js";

const NOTION_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const NOTION_TEXT_LIMIT = 2000;
const NOTION_CHILDREN_LIMIT = 100;

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: NOTION_TIMEOUT_MS,
});

function chunkText(text: string, limit: number = NOTION_TEXT_LIMIT): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + limit, text.length);
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      const lastSpace = text.lastIndexOf(' ', end);
      const splitPoint = Math.max(lastNewline, lastSpace);
      if (splitPoint > offset) end = splitPoint + 1;
    }
    chunks.push(text.substring(offset, end).trim());
    offset = end;
  }
  return chunks.filter(chunk => chunk.length > 0);
}

function createTextBlocks(heading: string, text: string | undefined) {
  if (!text || !text.trim()) {
    return [{
      object: 'block' as const,
      type: 'paragraph' as const,
      paragraph: { rich_text: [{ type: 'text' as const, text: { content: `${heading}: Sem dados.` } }] },
    }];
  }
  const chunks = chunkText(text);
  return chunks.map((chunk) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: { rich_text: [{ type: 'text' as const, text: { content: chunk } }] },
  }));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempt: number = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.status === 429 || error.status >= 500;
    if (isRetryable && attempt < MAX_RETRIES) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      const retryAfter = error.headers?.['retry-after'];
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : delayMs;
      console.warn(`[Notion] Retry ${attempt + 1}/${MAX_RETRIES}, aguardando ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return retryWithBackoff(fn, attempt + 1);
    }
    throw error;
  }
}

export async function createAuditPage(databaseId: string, data: AuditData, requestId?: string) {
  const logPrefix = `[Notion${requestId ? `:${requestId}` : ''}]`;

  if (!process.env.NOTION_TOKEN) {
    console.error(`${logPrefix} NOTION_TOKEN não configurado`);
    return { skipped: true, reason: 'missing_token' };
  }

  if (!databaseId) {
    console.error(`${logPrefix} databaseId vazio`);
    return { skipped: true, reason: 'missing_database_id' };
  }

  try {
    AuditDataSchema.parse(data);
  } catch (validationError: any) {
    const msg = validationError.errors?.[0]?.message || 'Validação falhou';
    console.error(`${logPrefix} ${msg}`);
    throw new Error(`Invalid audit data: ${msg}`);
  }

  const sanitize = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');

  try {
    const children: any[] = [
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: 'Auditoria gerada por Multi-Agent (Grok 4.20)' },
          }],
          icon: { type: 'emoji', emoji: '🤖' },
          color: 'blue_background',
        },
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Resumo Final' } }],
        },
      },
      ...createTextBlocks('Resumo', sanitize(data.finalSummary)),
    ];

    if (data.warnings) {
      children.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: sanitize(data.warnings) } }],
          icon: { type: 'emoji', emoji: '⚠️' },
          color: 'red_background',
        },
      });
    }

    children.push(
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🔍 Raciocínio dos Sub-Agentes' } }],
        },
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Análise Jurídica' } }],
        },
      },
      ...createTextBlocks('Legal', sanitize(data.legalAnalysis || 'Sem dados')),
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Análise Financeira' } }],
        },
      },
      ...createTextBlocks('Financial', sanitize(data.financialAnalysis || 'Sem dados')),
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: '🌐 Pesquisas Web' } }],
        },
      },
      ...createTextBlocks('Web', sanitize(data.webSearchResults || 'Sem dados'))
    );

    if (data.sourceUrl) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: 'Fonte: ' } },
            { type: 'text', text: { content: data.sourceUrl, link: { url: data.sourceUrl } } },
          ],
        },
      });
    }

    if (children.length > NOTION_CHILDREN_LIMIT) {
      console.warn(
        `${logPrefix} ${children.length} children excede limite (${NOTION_CHILDREN_LIMIT})`
      );
    }

    const response = await retryWithBackoff(async () =>
      await notion.pages.create({
        parent: { type: 'database_id', database_id: databaseId },
        properties: {
          'Task name': {
            title: [{ text: { content: sanitize(data.title) } }],
          },
          Status: { select: { name: 'Completed' } },
        },
        children: children.slice(0, NOTION_CHILDREN_LIMIT),
      })
    );

    console.log(`${logPrefix} Página criada. ID: ${response.id}`);
    return { success: true, pageId: response.id };
  } catch (error: any) {
    const userMessage = 'Falha ao registrar auditoria no Notion';
    console.error(`${logPrefix} ${userMessage}:`, {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    throw new Error(userMessage);
  }
}
