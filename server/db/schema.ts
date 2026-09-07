import { pgTable, serial, text, timestamp, jsonb, boolean, integer, numeric } from 'drizzle-orm/pg-core';

// Tenants (Empresas Clientes)
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#000000'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Configurações do Tenant (Metadata)
export const tenantConfigs = pgTable('tenant_configs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  searchKeywords: jsonb('search_keywords').$type<string[]>(),
  // Ploomes Integration "Plug and Play" Config (De-Para)
  ploomesConfig: jsonb('ploomes_config').$type<{
    pipelineId?: number;
    stageId?: number;
    fieldIdResumoIa?: string;
    fieldIdLinkEdital?: string;
    isActive?: boolean;
  }>(),
  pncpConfig: jsonb('pncp_config').$type<{
    certificatePath?: string;
    certificatePassword?: string;
    isActive?: boolean;
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
});


// Usuários com acesso ao sistema (login)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// NCMs Monitorados pelo Tenant
export const tenantNcms = pgTable('tenant_ncms', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  code: text('code').notNull(),
  description: text('description').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Fontes (Portais) monitorados pelo Tenant
export const sources = pgTable('sources', {
  id: text('id').primaryKey(), // Using text to match frontend string IDs
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  category: text('category').default('Prefeitura'),
  type: text('type').notNull(), // 'API' | 'SCRAPER'
  uf: text('uf'),
  city: text('city'),
  endpointOrUrl: text('endpoint_or_url').notNull(),
  selectorOrParams: text('selector_or_params'),
  authType: text('auth_type').default('NONE'),
  status: text('status').notNull(), // 'ACTIVE' | 'INACTIVE' | 'ERROR'
  lastCheckedAt: timestamp('last_checked_at'),
  latencyMs: integer('latency_ms'),
  successRate: integer('success_rate'),
  totalCollected: integer('total_collected').default(0),
  format: text('format').default('HTML'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Editais encontrados para o Tenant
export const editais = pgTable('editais', {
  id: text('id').primaryKey(), // Text to match frontend 'edital-1' etc
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  sourceId: text('source_id').references(() => sources.id).notNull(),
  processNumber: text('process_number').notNull(),
  title: text('title').notNull(),
  sourceName: text('source_name').notNull(),
  sourceCategory: text('source_category').notNull(),
  ncmCode: text('ncm_code').notNull(),
  objectDescription: text('object_description'),
  url: text('url'),
  rawUrl: text('raw_url').notNull(),
  s3StorageKey: text('s3_storage_key'),
  sha256Hash: text('sha256_hash'),
  fileSizeBytes: integer('file_size_bytes'),
  humanReviewStatus: text('human_review_status').default('PENDING'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  publishedInternally: boolean('published_internally').default(false),
  ocrStatus: text('ocr_status'),
  ocrPages: jsonb('ocr_pages').$type<any[]>(),
  findings: jsonb('findings').$type<any[]>(),
  urlValidation: jsonb('url_validation').$type<any>(),
  publishedAt: timestamp('published_at').notNull(),
  biddingDate: timestamp('bidding_date').notNull(),
  status: text('status').notNull(),
  agency: text('agency'),
  estimatedValue: numeric('estimated_value'),
  ploomesDealId: integer('ploomes_deal_id'), // To satisfy auditability rule
  createdAt: timestamp('created_at').defaultNow(),
});

// CRM INTERNAL TABLES

export const crmStages = pgTable('crm_stages', {
  id: text('id').primaryKey(), // e.g. "novo", "qualificacao", "proposta", "ganho", "perdido"
  name: text('name').notNull(),
  order: integer('order').notNull(),
});

export const crmDeals = pgTable('crm_deals', {
  id: text('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id),
  editalId: text('edital_id').references(() => editais.id).notNull(),
  stageId: text('stage_id').references(() => crmStages.id).notNull(),
  title: text('title').notNull(),
  value: numeric('value'),
  notes: text('notes'),
  assignedAgent: text('assigned_agent'), // e.g., 'sdr_agent' ou 'human'
  status: text('status').default('OPEN'), // OPEN, WON, LOST
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const crmLogs = pgTable('crm_logs', {
  id: text('id').primaryKey(),
  dealId: text('deal_id').references(() => crmDeals.id).notNull(),
  actor: text('actor').notNull(), // 'sdr_agent', 'closer_agent', ou 'user_uuid'
  action: text('action').notNull(), // 'move_stage', 'add_note', 'draft_email'
  details: jsonb('details').$type<any>(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// STATUS CATALOG (5 famílias do Sistema S / Paradigma)
export const statusCatalog = pgTable('status_catalog', {
  id: serial('id').primaryKey(),
  family: text('family').notNull(), // 'ProcessoDeContratacao' | 'ProcessosPresenciais' | 'CotacaoDeOrcamento' | 'PregaoEletronico' | 'CompraDireta'
  code: text('code').notNull(), // Stable identifier, e.g. 'HOMOLOGADO', 'EM_ANDAMENTO'
  label: text('label').notNull(), // Editable label
  description: text('description'), // Editable description
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

