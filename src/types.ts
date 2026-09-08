export type SourceType = 'API' | 'SCRAPER';

export type EntityCategory = 'ComprasNet' | 'SESC' | 'SENAT' | 'SESI' | 'Prefeitura';

export type SourceStatus = 'ACTIVE' | 'WARNING' | 'ERROR' | 'PAUSED';

export interface Source {
  id: string;
  name: string;
  category: EntityCategory;
  type: SourceType;
  uf: string;
  city?: string;
  endpointOrUrl: string;
  selectorOrParams: string;
  authType: 'NONE' | 'BEARER' | 'API_KEY' | 'SESSION';
  status: SourceStatus;
  lastCheckedAt: string;
  latencyMs: number;
  successRate: number; // 0-100%
  totalCollected: number;
  errorMessage?: string;
  format: 'JSON' | 'HTML';
  notes?: string;
}

export type MatchType = 'STRUCTURED_API' | 'REGEX_NLP' | 'FALLBACK_KEYWORD';

export type OCRConfidenceLevel = 'COMPLETE' | 'PARTIAL' | 'INCOMPLETE' | 'MANUAL_OVERRIDE';

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidenceScore: number; // 0 - 100
  hasManualOverride?: boolean;
  manualText?: string;
}

export type ConfidenceFlag = 'ALTA' | 'MEDIA' | 'INCONCLUSIVA';

export type FindingType = 
  | 'EXIGENCIA_RESTRITIVA'
  | 'NCM_DIVERGENTE'
  | 'QUALIFICACAO_TECNICA'
  | 'PRAZO_EXIGUO'
  | 'GARANTIA_EXCESSIVA'
  | 'CERTIFICACAO_INMETRO'
  | 'MARCA_ESPECIFICA'
  | 'OUTRO';

export type FindingStatus = 'ATIVO' | 'CORRIGIDO' | 'PERSISTENTE' | 'INCONCLUSIVO_RETIFICACAO';

export type HumanDecision = 'PENDING' | 'APROVADO' | 'REJEITADO' | 'INCONCLUSIVO';

export type ImpactRiskLevel = 'ALTO' | 'MEDIO' | 'BAIXO';

export type CollectionMethod =
  | 'DIRECT_HTTPX'
  | 'URL_REWRITE'
  | 'PLAYWRIGHT_INTERCEPT'
  | 'S3_CACHE_FALLBACK'
  | 'MURAL_PARADIGMA';

export type UrlValidationStatus =
  | 'VALID_DIRECT_200'
  | 'VALID_REDIRECT_RESOLVED'
  | 'REDIRECT_DESTINATION_DNS_FAILURE'
  | 'REDIRECT_DESTINATION_HTTP_ERROR'
  | 'REDIRECT_DESTINATION_TIMEOUT'
  | 'UNAVAILABLE_4XX_5XX'
  | 'INVALID_MIME'
  | 'SUSPICIOUS_SIZE';

export interface UrlValidationData {
  originalUrl: string;
  originalRequestedUrl?: string;
  validationStatus: UrlValidationStatus;
  collectionMethod?: CollectionMethod;
  httpStatusCode: number;
  finalResolvedUrl?: string;
  attemptedDestinationUrl?: string;
  mimeTypeValidated?: string;
  contentLengthBytes?: number;
  validatedAt: string;
  limitationNotice?: string;
  errorDetail?: string;
  recommendedAction?: string;
  dnsResolutionStatus?: 'RESOLVED_OK' | 'NXDOMAIN_ERROR' | 'DNS_TIMEOUT' | 'SKIPPED_DIRECT' | 'OK' | 'NXDOMAIN' | 'TIMEOUT';
  redirectChain?: string[];
  rewriteRuleApplied?: string;
  cachedVersionDate?: string;
  warningNotice?: string;
  isUnavailable?: boolean;
}

export interface Finding {
  id: string;
  editalId: string;
  page: number;
  snippet: string;
  legalBasis: string; // e.g. "Art. 9º, I da Lei 14.133/2021", "Art. 12 do Regulamento de Licitações do SESC"
  findingType: FindingType;
  explanation: string;
  confidence: ConfidenceFlag;
  status: FindingStatus;
  humanDecision: HumanDecision;
  impactRisk?: ImpactRiskLevel;
  contextBefore?: string;
  contextAfter?: string;
  reviewerComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INCONCLUSIVE';

export interface Edital {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceCategory: EntityCategory;
  sourceType: SourceType;
  processNumber: string;
  title: string;
  objectDescription: string;
  ncmCode: string; // e.g. "9506.91.00"
  ncmDescription: string;
  matchType: MatchType;
  modality: 'Concorrência' | 'Pregão Eletrônico' | 'Credenciamento' | 'Dispensa Eletrônica' | 'Tomada de Preços';
  publicationDate: string;
  openingDate: string;
  budgetEstimated?: number;
  rawUrl: string;
  s3StorageKey: string;
  sha256Hash: string;
  fileSizeBytes: number;
  version: number;
  retificationOfId?: string;
  retificationStatus?: 'ORIGINAL' | 'RETIFICADO';
  ocrStatus: OCRConfidenceLevel;
  ocrConfidenceAvg: number;
  ocrPages: OCRPage[];
  findings: Finding[];
  urlValidation?: UrlValidationData;
  collectionMethod?: CollectionMethod;
  humanReviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  publishedInternally: boolean;
  city?: string;
  uf: string;
  url?: string;
  agency?: string;
  estimatedValue?: string | number;
  ploomesDealId?: number | null;
}

export interface WhatsAppNotification {
  id: string;
  editalId: string;
  entityName: string;
  processNumber: string;
  recipientPhone: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'QUEUED';
  messageBody: string;
  sentAt: string;
  deepLink: string;
  templateName: string;
}

export interface RetificationDiff {
  id: string;
  originalEditalId: string;
  retifiedEditalId: string;
  processNumber: string;
  entityName: string;
  dateAnalyzed: string;
  summary: string;
  addedClauses: { page: number; text: string }[];
  removedClauses: { page: number; text: string }[];
  modifiedClauses: { page: number; oldText: string; newText: string; field: string }[];
  findingsTransitions: {
    findingId: string;
    previousSnippet: string;
    newStatus: 'CORRIGIDO' | 'PERSISTENTE' | 'INCONCLUSIVO_RETIFICACAO';
    justification: string;
  }[];
}

export interface SchedulerState {
  isRunning: boolean;
  intervalMinutes: number;
  lastRunAt: string;
  nextRunAt: string;
  totalRunsCompleted: number;
  activeSourcesCount: number;
  lastExecutionDurationSeconds: number;
  logs: {
    id: string;
    timestamp: string;
    sourceId: string;
    sourceName: string;
    sourceType: SourceType;
    status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
    message: string;
    latencyMs: number;
    itemsFound: number;
  }[];
}

export interface LexicalTerm {
  id: string;
  term: string;
  type: 'INCLUSIVE' | 'EXCLUSIVE';
  isActive: boolean;
  createdAt: string;
}

export interface NCMRecord {
  id: number | string;
  code: string;
  description: string;
  active: boolean;
  isPrimary?: boolean;
  createdAt?: string;
}

export interface NCMConfig {
  id: number;
  ncmCode: string;
  ncmDescription: string;
  updatedAt: string;
  updatedBy: string;
  terms: LexicalTerm[];
  ncms?: NCMRecord[];
}

export interface NCMClassificationResult {
  status: 'CONFIRMED' | 'LIKELY' | 'REJECTED' | 'INCONCLUSIVE' | 'AMBIGUOUS';
  confidence: number;
  method: 'EXACT_NCM' | 'SEMANTIC_MATCH' | 'NEGATIVE_FILTER' | 'INSUFFICIENT_EVIDENCE';
  hasExactNcm: boolean;
  inclusiveHits: string[];
  exclusiveHits: string[];
  inclusiveScore: number;
  exclusiveScore: number;
  reason?: string;
  evidence?: string[];
}

export interface NCMConfigItem {
  code: string;
  description: string;
  keywords: string[];
  isPrimary: boolean;
}

export interface ProductSupplierMatch {
  id: string;
  brandName: string;
  manufacturer: string;
  productModel: string;
  category: string;
  absorptionTechnologyName: string;
  absorptionCharacteristics: string;
  impactAttenuationPercent: string;
  isProprietaryModel: boolean;
  marketPriceRangeEstimate?: string;
  complianceVerdict: 'EQUIVALENTE_DIRETO' | 'TECNOLOGIA_PROPRIETARIA' | 'EQUIVALENTE_SUPERIOR' | 'NAO_EQUIVALENTE';
  notes: string;
}

export interface RestrictiveSpecAnalysis {
  id: string;
  clauseRawText: string;
  analyzedAt: string;
  sourceContext?: string;
  restrictionLevel: 'CRITICO_DIRECIONAMENTO' | 'ALTO_RESTRITIVO' | 'MODERADO_RESTRITIVO' | 'CONFORME_AMPLA_DISPUTA';
  technologyIdentified: {
    name: string;
    description: string;
    patentStatus: string;
    knownHolders: string[];
  };
  restrictiveElements: {
    element: string;
    snippet: string;
    legalViolation: string;
    jurisprudence: string;
    severity: 'ALTA' | 'MEDIA' | 'BAIXA';
  }[];
  deadlineAnalysis: {
    deadlineFound?: string;
    verdict: 'PRAZO_EXIGUO_FAVORECIMENTO' | 'PRAZO_RAZOAVEL' | 'NAO_INFORMADO';
    rationale: string;
    recommendedDeadline: string;
  };
  matchingSuppliersAndProducts: ProductSupplierMatch[];
  competitiveAssessment: {
    marketCompetitiveness: string;
    estimatedAvailableBidders: number;
    riskOfFrustration: string;
  };
  recommendedActionPlan: {
    actionType: 'IMPUGNACAO_EDITAL' | 'PEDIDO_ESCLARECIMENTO' | 'ACEITACAO_EQUIVALENCIA' | 'MONITORAR';
    title: string;
    description: string;
    legalGrounding: string;
    draftArgumentation: string;
  };
}

export * from './types/mural';
