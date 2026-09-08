import { z } from 'zod';

// Validação de UUID no formato Notion (32 hex chars, com/sem hífens)
const NotionDatabaseId = z
  .string()
  .refine(
    (id) => /^[0-9a-f]{32}$/i.test(id.replace(/-/g, '')),
    'databaseId deve ser um UUID válido do Notion (32 caracteres hex)'
  );

export const AuditDataSchema = z.object({
  title: z.string().min(1, 'title obrigatório').max(200, 'title max 200 chars'),
  sourceUrl: z.string().url('sourceUrl deve ser uma URL válida').optional(),
  financialAnalysis: z.string().max(50000, 'financialAnalysis excede limite').optional(),
  legalAnalysis: z.string().max(50000, 'legalAnalysis excede limite').optional(),
  webSearchResults: z.string().max(50000, 'webSearchResults excede limite').optional(),
  finalSummary: z.string().min(1, 'finalSummary obrigatório').max(50000, 'finalSummary excede limite'),
  warnings: z.string().max(5000, 'warnings excede limite').optional(),
});

export const CreateAuditPageRequest = z.object({
  databaseId: NotionDatabaseId,
  data: AuditDataSchema,
});

export type AuditData = z.infer<typeof AuditDataSchema>;
export type CreateAuditPageRequest = z.infer<typeof CreateAuditPageRequest>;
