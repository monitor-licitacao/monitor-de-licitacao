# ROADMAP DE REFATORAÇÃO MULTI-FONTE (PR #50)

## Executive Summary
Este roadmap consolida a implementação da coleta multi-fonte conforme curadoria realizada em PR #50, estruturando **3 fontes críticas** (PNCP + Compras RJ + Sistema S) sob uma arquitetura de conectores unificada com telemetria Amplitude estruturada.

**Status Crítico:**
- ✅ PNCP collector funcional (multi-tenant, multi-NCM)
- ✅ Schema multi-tenant pronto
- ✅ Tipos e interfaces definidas
- ✅ Connector Executor genérico (API/SCRAPER)
- ✅ Endpoints Compras RJ documentados (11 endpoints)
- ✅ URLs canônicas Sistema S mapeadas (5 plataformas)
- ❌ **Compras RJ collector**: Não implementado (PR #54 existe mas não está em main)
- ❌ **Sistema S collectors**: Não implementado
- ❌ **Arquitetura de conectores** baseada em interfaces/abstrações: Não consolidada
- ❌ **Telemetria estruturada** com Amplitude: Schema não validado
- ⚠️  **Orquestração multi-conector**: Scheduler único, sem pipeline

---

## FASE 1: PNCP + Compras RJ (Priority NOW) — Semana 1-2

### 1.1 Consolidação de Conectores (Base Architecture)

**Objetivo:** Criar interface comum para reutilização entre PNCP, Compras RJ e Sistema S.

#### 1.1.1 Novo arquivo: `server/lib/connectors/base/ILicitacaoCollector.ts`
```typescript
/**
 * Interface abstrata para coletores de licitações.
 * Cada implementação concreta (PNCP, Compras RJ, Sistema S) segue este contrato.
 */

export interface CollectorConfig {
  sourceId: string;
  sourceName: string;
  tenantId?: number;
  type: 'API' | 'SCRAPER';
  endpointOrUrl: string;
  selectorOrParams?: string | null;
  isActive: boolean;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface CollectorItem {
  processNumber: string;
  title: string;
  objectDescription?: string;
  ncmCode?: string;
  publishedAt: Date;
  biddingDate?: Date;
  pdfUrl?: string;
  rawUrl: string;
  estimatedValue?: string | number;
  agency?: string;
  modality?: string;
  metadata?: Record<string, any>;
}

export interface CollectorResult {
  success: boolean;
  sourceId: string;
  sourceName: string;
  tenantId?: number;
  itemsCollected: CollectorItem[];
  totalItemsFound: number;
  latencyMs: number;
  error?: string;
  nextPageToken?: string; // Para paginação
  collectedAt: Date;
}

export interface ILicitacaoCollector {
  // Identifica o conector
  readonly sourceId: string;
  readonly sourceName: string;
  readonly type: 'API' | 'SCRAPER';
  
  // Valida e normaliza configuração
  validateConfig(config: CollectorConfig): Promise<{ valid: boolean; errors?: string[] }>;
  
  // Executa coleta com fallback de retry
  collect(config: CollectorConfig, pageToken?: string): Promise<CollectorResult>;
  
  // Testa conectividade e parseabilidade
  healthCheck(config: CollectorConfig): Promise<{ healthy: boolean; message?: string }>;
  
  // Trata paginação (se aplicável)
  hasNextPage(result: CollectorResult): boolean;
}
```

#### 1.1.2 Novo arquivo: `server/lib/connectors/base/BaseCollector.ts`
```typescript
/**
 * Classe abstrata base com retry logic, telemetria comum e normalização.
 */

import { ILicitacaoCollector, CollectorConfig, CollectorResult, CollectorItem } from './ILicitacaoCollector';
import { ai } from '../amplitude-ai';

export abstract class BaseCollector implements ILicitacaoCollector {
  abstract readonly sourceId: string;
  abstract readonly sourceName: string;
  abstract readonly type: 'API' | 'SCRAPER';

  async collect(config: CollectorConfig, pageToken?: string): Promise<CollectorResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validar configuração
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          tenantId: config.tenantId,
          itemsCollected: [],
          totalItemsFound: 0,
          latencyMs: Date.now() - startTime,
          error: `Configuração inválida: ${validation.errors?.join('; ')}`,
          collectedAt: new Date(),
        };
      }

      // 2. Executar coleta com retry
      let result: CollectorResult | null = null;
      for (let attempt = 0; attempt <= (config.retryConfig?.maxRetries ?? 3); attempt++) {
        try {
          result = await this.collectImpl(config, pageToken);
          
          if (result.success || attempt === (config.retryConfig?.maxRetries ?? 3)) {
            break;
          }
          
          // Retry exponencial
          const backoff = (config.retryConfig?.backoffMs ?? 1000) * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, backoff));
        } catch (e) {
          if (attempt === (config.retryConfig?.maxRetries ?? 3)) {
            throw e;
          }
        }
      }

      // 3. Emitir evento de telemetria
      await this.trackTelemetry(result!, config);
      
      return result!;
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        tenantId: config.tenantId,
        itemsCollected: [],
        totalItemsFound: 0,
        latencyMs,
        error: error.message,
        collectedAt: new Date(),
      };
    }
  }

  // Template method — implementações concretas definem este
  protected abstract collectImpl(config: CollectorConfig, pageToken?: string): Promise<CollectorResult>;

  async validateConfig(config: CollectorConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    
    if (!config.sourceId?.trim()) errors.push('sourceId é obrigatório');
    if (!config.endpointOrUrl?.trim()) errors.push('endpointOrUrl é obrigatório');
    if (!['API', 'SCRAPER'].includes(config.type)) errors.push('type deve ser API ou SCRAPER');
    
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async healthCheck(config: CollectorConfig): Promise<{ healthy: boolean; message?: string }> {
    try {
      const result = await this.collect({ ...config, isActive: true });
      return { healthy: result.success || result.itemsCollected.length > 0, message: result.error };
    } catch (e: any) {
      return { healthy: false, message: e.message };
    }
  }

  hasNextPage(result: CollectorResult): boolean {
    return !!result.nextPageToken;
  }

  // Telemetria padrão para todos os coletores
  protected async trackTelemetry(result: CollectorResult, config: CollectorConfig): Promise<void> {
    try {
      // Emite evento estruturado: licitacao_source_polled
      ai.track({
        eventType: 'licitacao_source_polled',
        eventProperties: {
          source_id: this.sourceId,
          source_name: this.sourceName,
          source_type: this.type,
          tenant_id: config.tenantId,
          items_found: result.totalItemsFound,
          items_collected: result.itemsCollected.length,
          latency_ms: result.latencyMs,
          success: result.success,
          error_message: result.error,
          timestamp: result.collectedAt.toISOString(),
        },
      });

      // Se houve parsing, emite licitacao_items_extracted
      if (result.itemsCollected.length > 0) {
        ai.track({
          eventType: 'licitacao_items_extracted',
          eventProperties: {
            source_id: this.sourceId,
            item_count: result.itemsCollected.length,
            ncm_codes: [...new Set(result.itemsCollected.map(i => i.ncmCode).filter(Boolean))],
            tenant_id: config.tenantId,
          },
        });
      }

      // Se houve erro, emite licitacao_parse_failed
      if (!result.success && result.error) {
        ai.track({
          eventType: 'licitacao_parse_failed',
          eventProperties: {
            source_id: this.sourceId,
            error_type: result.error.split(':')[0],
            error_message: result.error,
            tenant_id: config.tenantId,
          },
        });
      }
    } catch (telemetryErr: any) {
      console.warn(`Telemetria falhou para ${this.sourceId}:`, telemetryErr.message);
    }
  }
}
```

#### 1.1.3 Refatorar: `server/lib/connectors/impl/PncpCollector.ts`
Transformar `pncp_collector.ts` em classe reutilizável:
```typescript
export class PncpCollector extends BaseCollector {
  readonly sourceId = 'src-pncp-api-01';
  readonly sourceName = 'PNCP (Portal Nacional)';
  readonly type = 'API';
  
  protected async collectImpl(config: CollectorConfig, pageToken?: string): Promise<CollectorResult> {
    // Lógica de coleta PNCP existente, mas modularizada
    // Reutiliza normalizeConnectorConfig + executeConnector do connectorExecutor.ts
  }
}
```

#### 1.1.4 Novo arquivo: `server/lib/connectors/impl/ComprasRjCollector.ts`
Implementação para Compras RJ via `/EditaisLicitacoes/paginate.action`:
```typescript
import { BaseCollector } from '../base/BaseCollector';
import { CollectorConfig, CollectorResult } from '../base/ILicitacaoCollector';

export class ComprasRjCollector extends BaseCollector {
  readonly sourceId = 'src-compras-rj-01';
  readonly sourceName = 'Compras RJ (SIGA)';
  readonly type = 'API';

  protected async collectImpl(config: CollectorConfig, pageToken?: string): Promise<CollectorResult> {
    const { endpointOrUrl, selectorOrParams, tenantId } = config;
    const startTime = Date.now();

    try {
      // Construir body para POST /EditaisLicitacoes/paginate.action
      const page = pageToken ? parseInt(pageToken) : 1;
      const pageSize = 50;
      
      const body = new URLSearchParams();
      body.append('sEcho', String(page));
      body.append('iDisplayStart', String((page - 1) * pageSize));
      body.append('iDisplayLength', String(pageSize));
      // Filtros opcionais podem vir de selectorOrParams (JSON parsed)
      if (selectorOrParams) {
        try {
          const filters = JSON.parse(selectorOrParams);
          Object.entries(filters).forEach(([key, value]) => {
            body.append(key, String(value));
          });
        } catch {}
      }

      const response = await fetch(endpointOrUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          tenantId,
          itemsCollected: [],
          totalItemsFound: 0,
          latencyMs: Date.now() - startTime,
          error: `HTTP ${response.status}`,
          collectedAt: new Date(),
        };
      }

      const data = await response.json();
      const items = data.aaData || [];
      const totalItems = data.iTotalRecords || items.length;

      // Normalizar itens Compras RJ para CollectorItem
      const collected = items.map((row: any) => ({
        processNumber: row[1] || 'N/A', // coluna 1: Número
        title: row[2] || '', // coluna 2: Edital
        objectDescription: row[3] || '', // coluna 3: Objeto
        publishedAt: new Date(row[4]) || new Date(), // coluna 4: Data Publicação
        biddingDate: new Date(row[5]) || new Date(), // coluna 5: Data Abertura
        rawUrl: row[6] || '', // coluna 6: URL/Link
        agency: row[0] || '', // coluna 0: Unidade
      }));

      return {
        success: true,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        tenantId,
        itemsCollected: collected,
        totalItemsFound: totalItems,
        latencyMs: Date.now() - startTime,
        nextPageToken: items.length === pageSize ? String(page + 1) : undefined,
        collectedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        tenantId,
        itemsCollected: [],
        totalItemsFound: 0,
        latencyMs: Date.now() - startTime,
        error: error.message,
        collectedAt: new Date(),
      };
    }
  }
}
```

**Arquivos a criar/modificar:**
- ✅ `server/lib/connectors/base/ILicitacaoCollector.ts` (novo)
- ✅ `server/lib/connectors/base/BaseCollector.ts` (novo)
- ✅ `server/lib/connectors/impl/PncpCollector.ts` (refatorar de pncp_collector.ts)
- ✅ `server/lib/connectors/impl/ComprasRjCollector.ts` (novo)
- ✅ `server/lib/connectors/registry/CollectorRegistry.ts` (novo, singleton)

---

### 1.2 Telemetria Amplitude Estruturada

**Objetivo:** Validar e registrar eventos conforme taxonomy proposta em PR #50.

#### 1.2.1 Schema de Eventos: `docs/TELEMETRY_EVENTS_SCHEMA.md`
```markdown
# Eventos Estruturados - Telemetria Amplitude

## 1. licitacao_source_polled
**Disparado:** Ao fim de cada execução do coletor (sucesso ou falha)
**Frequência:** A cada poll (padrão: 4h para PNCP, 6h para Compras RJ)
**Propriedades:**
- source_id (string): ID do coletor (src-pncp-api-01, src-compras-rj-01)
- source_name (string): Nome legível
- source_type (enum): API | SCRAPER
- tenant_id (number, opcional): Multi-tenant
- items_found (number): Total de itens encontrados na fonte
- items_collected (number): Itens extraídos com sucesso
- latency_ms (number): Tempo de resposta
- success (boolean): Coleta bem-sucedida?
- error_message (string, opcional): Se falhou
- timestamp (ISO 8601): Quando coletou

## 2. licitacao_items_extracted
**Disparado:** Quando itens forem extraídos com sucesso (items_collected > 0)
**Frequência:** Por execução com resultados positivos
**Propriedades:**
- source_id (string)
- item_count (number): Quantidade de itens
- ncm_codes (array): Códigos NCM únicos detectados
- tenant_id (number, opcional)
- modalities (array, opcional): Modalidades encontradas
- date_range (object): { min_date, max_date } de editais

## 3. licitacao_parse_failed
**Disparado:** Quando falhar parsing/extração
**Frequência:** Por falha
**Propriedades:**
- source_id (string)
- error_type (enum): TIMEOUT | PARSE_ERROR | VALIDATION_ERROR | NETWORK_ERROR
- error_message (string)
- tenant_id (number, opcional)
- retry_count (number): Quantas tentativas foram feitas
```

#### 1.2.2 Testar Schema: `__connector_telemetry__.test.ts`
```typescript
test('Telemetria estruturada: licitacao_source_polled + licitacao_items_extracted', async () => {
  const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full' }));
  const pncpAgent = mock.agent('collector-orchestrator', { userId: 'system' });

  await pncpAgent.session({ sessionId: 'collect-pncp-20260912' }).run(async (s) => {
    // Simula coleta PNCP bem-sucedida
    s.trackEvent('licitacao_source_polled', {
      source_id: 'src-pncp-api-01',
      source_name: 'PNCP',
      source_type: 'API',
      tenant_id: 1,
      items_found: 250,
      items_collected: 245,
      latency_ms: 3200,
      success: true,
    });

    s.trackEvent('licitacao_items_extracted', {
      source_id: 'src-pncp-api-01',
      item_count: 245,
      ncm_codes: ['9506.91.00', '9506.92.00'],
      tenant_id: 1,
    });
  });

  mock.assertEventTracked('licitacao_source_polled', { userId: 'system' });
  mock.assertEventTracked('licitacao_items_extracted', { userId: 'system' });
});
```

**Arquivos a criar:**
- ✅ `docs/TELEMETRY_EVENTS_SCHEMA.md` (documentação)
- ✅ `__connector_telemetry__.test.ts` (testes)
- ✅ Atualizar `server/lib/amplitude-ai.ts` com eventos estruturados

---

### 1.3 Integração ao Sistema (Scheduler + Storage)

#### 1.3.1 Novo arquivo: `server/lib/connectors/registry/CollectorRegistry.ts`
```typescript
import { ILicitacaoCollector, CollectorConfig } from '../base/ILicitacaoCollector';
import { PncpCollector } from '../impl/PncpCollector';
import { ComprasRjCollector } from '../impl/ComprasRjCollector';

export class CollectorRegistry {
  private static instance: CollectorRegistry;
  private collectors: Map<string, ILicitacaoCollector> = new Map();

  private constructor() {
    // Registrar coletores conhecidos
    this.register(new PncpCollector());
    this.register(new ComprasRjCollector());
  }

  static getInstance(): CollectorRegistry {
    if (!CollectorRegistry.instance) {
      CollectorRegistry.instance = new CollectorRegistry();
    }
    return CollectorRegistry.instance;
  }

  register(collector: ILicitacaoCollector): void {
    this.collectors.set(collector.sourceId, collector);
  }

  getCollector(sourceId: string): ILicitacaoCollector | null {
    return this.collectors.get(sourceId) || null;
  }

  getAllCollectors(): ILicitacaoCollector[] {
    return Array.from(this.collectors.values());
  }
}
```

#### 1.3.2 Refatorar Worker: `server/workers/unified_collector.ts`
```typescript
/**
 * Worker unificado de coleta.
 * Substitui pncp_collector.ts, agendado para executar todos os conectores registrados.
 */

import { CollectorRegistry } from '../lib/connectors/registry/CollectorRegistry';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';

export async function runUnifiedCollector() {
  const registry = CollectorRegistry.getInstance();
  const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });

  // 1. Carregar todas as fontes ativas
  const sources = await db.select().from(schema.sources)
    .where(eq(schema.sources.status, 'ACTIVE'));

  // 2. Para cada fonte, obter conector correspondente
  for (const source of sources) {
    const collector = registry.getCollector(source.id);
    if (!collector) {
      console.warn(`❌ Nenhum collector registrado para ${source.id}`);
      continue;
    }

    // 3. Executar coleta
    const config: CollectorConfig = {
      sourceId: source.id,
      sourceName: source.name,
      tenantId: source.tenantId,
      type: source.type as 'API' | 'SCRAPER',
      endpointOrUrl: source.endpointOrUrl,
      selectorOrParams: source.selectorOrParams,
      isActive: true,
    };

    const result = await collector.collect(config);

    // 4. Persistir resultados no banco
    for (const item of result.itemsCollected) {
      await db.insert(schema.editais).values({
        id: generateUniqueId(source.id, item.processNumber),
        tenantId: source.tenantId,
        sourceId: source.id,
        processNumber: item.processNumber,
        title: item.title,
        sourceName: source.name,
        sourceCategory: source.category || 'N/A',
        ncmCode: item.ncmCode || 'N/A',
        objectDescription: item.objectDescription,
        url: item.pdfUrl,
        rawUrl: item.rawUrl,
        status: 'OPEN',
        agency: item.agency,
        estimatedValue: item.estimatedValue ? String(item.estimatedValue) : null,
        publishedAt: item.publishedAt,
        biddingDate: item.biddingDate || item.publishedAt,
        humanReviewStatus: 'PENDING',
      }).onConflictDoNothing();
    }

    // 5. Atualizar métrica da fonte
    await db.update(schema.sources)
      .set({
        lastCheckedAt: new Date(),
        totalCollected: result.itemsCollected.length,
        status: result.success ? 'ACTIVE' : 'WARNING',
        latencyMs: result.latencyMs,
      })
      .where(eq(schema.sources.id, source.id));
  }
}

// Agendamento via cron
import cron from 'node-cron';
cron.schedule('0 */4 * * *', runUnifiedCollector); // PNCP: 4h
cron.schedule('0 */6 * * *', runUnifiedCollector); // Compras RJ: 6h
```

**Arquivos a criar/modificar:**
- ✅ `server/lib/connectors/registry/CollectorRegistry.ts` (novo)
- ✅ `server/workers/unified_collector.ts` (novo, substitui pncp_collector.ts)
- ✅ Adicionar npm script: `"worker:unified": "tsx server/workers/unified_collector.ts"`

---

## FASE 2: Sistema S (Semana 3-4)

### 2.1 Analisar Arquitetura Sistema S

**Endpoints Canônicos (PR #50):**
1. **SEST/SENAT**: `https://compras.sestsenat.org.br/portal/Mural.aspx`
2. **SESC DN**: `https://egov-br.paradigmabs.com.br/sescdn/portal/Mural.aspx`
3. **SESC SP**: `https://scr360.paradigmabs.com.br/sescsp/Default.aspx`
4. **SESC/SENAC RS**: `https://egov.paradigmabs.com.br/sesc_senac_rs/Default.aspx`
5. **SESI/SENAI RS (FIERGS)**: `https://compras.sistemafiergs.org.br/portal/Mural.aspx`

**Tecnologia Comum:** Plataforma Paradigma Business Solutions (ASP.NET)
- Seletores esperados: `table.mural`, `Mural.aspx`
- Postback: Form Data com ViewState + EventTarget
- Download anexos: `btBaixaAnexo`

### 2.2 Implementar Sistema S Collector

#### 2.2.1 Novo arquivo: `server/lib/connectors/impl/SistemaScollector.ts`
```typescript
export class SistemaScollector extends BaseCollector {
  readonly sourceId: string; // Set by constructor
  readonly sourceName: string;
  readonly type = 'SCRAPER';

  constructor(sourceId: string, sourceName: string, private paradigmaUrl: string) {
    super();
    this.sourceId = sourceId;
    this.sourceName = sourceName;
  }

  protected async collectImpl(config: CollectorConfig): Promise<CollectorResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.paradigmaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Monitor-Licitacoes/2.0)',
        },
      });

      if (!response.ok) {
        return this.failResult(Date.now() - startTime, `HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse Mural.aspx table
      const items: CollectorItem[] = [];
      $('table.mural tr').slice(1).each((i, el) => {
        const cells = $(el).find('td');
        if (cells.length >= 3) {
          const processNum = cells.eq(0).text().trim();
          const title = cells.eq(1).text().trim();
          const openDate = cells.eq(2).text().trim();

          items.push({
            processNumber: processNum,
            title,
            publishedAt: new Date(openDate),
            rawUrl: this.paradigmaUrl,
          });
        }
      });

      return {
        success: true,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        tenantId: config.tenantId,
        itemsCollected: items,
        totalItemsFound: items.length,
        latencyMs: Date.now() - startTime,
        collectedAt: new Date(),
      };
    } catch (error: any) {
      return this.failResult(Date.now() - startTime, error.message);
    }
  }

  private failResult(latencyMs: number, error: string): CollectorResult {
    return {
      success: false,
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      itemsCollected: [],
      totalItemsFound: 0,
      latencyMs,
      error,
      collectedAt: new Date(),
    };
  }
}
```

#### 2.2.2 Atualizar Registry
```typescript
export class CollectorRegistry {
  private constructor() {
    // PNCP e Compras RJ
    this.register(new PncpCollector());
    this.register(new ComprasRjCollector());

    // Sistema S (5 plataformas)
    this.register(new SistemaScollector('src-sistema-s-sest', 'SEST/SENAT', CANONICAL_SISTEMA_S_URLS.SEST_SENAT));
    this.register(new SistemaScollector('src-sistema-s-sesc-dn', 'SESC DN', CANONICAL_SISTEMA_S_URLS.SESC_DN));
    this.register(new SistemaScollector('src-sistema-s-sesc-sp', 'SESC SP', CANONICAL_SISTEMA_S_URLS.SESC_SP));
    this.register(new SistemaScollector('src-sistema-s-sesc-rs', 'SESC/SENAC RS', CANONICAL_SISTEMA_S_URLS.SESC_SENAC_RS));
    this.register(new SistemaScollector('src-sistema-s-sesi-rs', 'SESI/SENAI RS (FIERGS)', CANONICAL_SISTEMA_S_URLS.SESI_SENAI_RS_FIERGS));
  }
}
```

**Arquivos a criar/modificar:**
- ✅ `server/lib/connectors/impl/SistemaScollector.ts` (novo)
- ✅ Atualizar `server/lib/connectors/registry/CollectorRegistry.ts`
- ✅ Testes: `__sistema_s_collector__.test.ts`

---

## FASE 3: ERPs Municipais + Orquestração (Semana 5-6)

### 3.1 Otimização: PNCP por CNPJ (148 GovTechs)

**Contexto:** PR #50 mapeou 148 software houses/ERPs que já enviam para PNCP. Em vez de 148 scrapers distintos, usar PNCP API com parâmetro `cnpj=`.

#### 3.1.1 Estender PncpCollector: `server/lib/connectors/impl/PncpMunicipalCollector.ts`
```typescript
export class PncpMunicipalCollector extends PncpCollector {
  /**
   * Varia o CNPJ a cada execução para cobrir ERPs municipais.
   * Paging automático dos 148 CNPJs mapeados em PR #50.
   */
  protected async collectImpl(config: CollectorConfig, pageToken?: string): Promise<CollectorResult> {
    const cnpjIndex = parseInt(pageToken || '0');
    const catalog = loadPncpCatalog(); // From pncpSourcesCatalog.ts
    const municipal = catalog.filter(p => p.esfera === 'Municipal' && p.estrategiaConector === 'ERP_GOVTECH_API');

    if (cnpjIndex >= municipal.length) {
      return { ...emptyResult(), success: true }; // Ciclo completo
    }

    const portal = municipal[cnpjIndex];
    const url = portal.endpointConsultaPncp;

    // Executar coleta PNCP para este CNPJ
    const result = await super.collectImpl({ ...config, endpointOrUrl: url }, undefined);

    return { ...result, nextPageToken: String(cnpjIndex + 1) };
  }
}
```

### 3.2 Orquestração com Prioridades

#### 3.2.1 Novo arquivo: `server/lib/orchestrator/CollectorOrchestrator.ts`
```typescript
export interface CollectorSchedule {
  sourceId: string;
  intervalMinutes: number;
  priority: 1 | 2 | 3; // 1=altíssima, 3=baixa
  tenantIds?: number[]; // Se undefined, roda para todos
}

export const DEFAULT_SCHEDULES: CollectorSchedule[] = [
  // Fase 1
  { sourceId: 'src-pncp-api-01', intervalMinutes: 240, priority: 1 }, // 4h
  { sourceId: 'src-compras-rj-01', intervalMinutes: 360, priority: 1 }, // 6h

  // Fase 2
  { sourceId: 'src-sistema-s-sest', intervalMinutes: 480, priority: 2 }, // 8h
  { sourceId: 'src-sistema-s-sesc-dn', intervalMinutes: 480, priority: 2 },
  { sourceId: 'src-sistema-s-sesc-sp', intervalMinutes: 480, priority: 2 },
  { sourceId: 'src-sistema-s-sesc-rs', intervalMinutes: 480, priority: 2 },
  { sourceId: 'src-sistema-s-sesi-rs', intervalMinutes: 480, priority: 2 },

  // Fase 3
  { sourceId: 'src-pncp-municipal-batch', intervalMinutes: 720, priority: 3 }, // 12h
];

export class CollectorOrchestrator {
  private activeSchedules = new Map<string, NodeJS.Timeout>();

  async startScheduler() {
    const schedules = await loadSchedulesFromDb(); // Permite customização por tenant

    for (const schedule of schedules) {
      this.scheduleCollector(schedule);
    }

    console.log(`✅ Orquestrador iniciado com ${schedules.length} coletores agendados.`);
  }

  private scheduleCollector(schedule: CollectorSchedule) {
    const intervalMs = schedule.intervalMinutes * 60 * 1000;

    // Executa imediatamente
    this.executeSchedule(schedule);

    // Depois agenda repetição
    const timeoutId = setInterval(() => this.executeSchedule(schedule), intervalMs);
    this.activeSchedules.set(schedule.sourceId, timeoutId);
  }

  private async executeSchedule(schedule: CollectorSchedule) {
    const registry = CollectorRegistry.getInstance();
    const collector = registry.getCollector(schedule.sourceId);

    if (!collector) {
      console.warn(`❌ Collector ${schedule.sourceId} não encontrado`);
      return;
    }

    // Executar para todos os tenants ou apenas os especificados
    const tenants = schedule.tenantIds
      ? await db.select().from(schema.tenants).where(inArray(schema.tenants.id, schedule.tenantIds))
      : await db.select().from(schema.tenants);

    for (const tenant of tenants) {
      const config: CollectorConfig = {
        sourceId: schedule.sourceId,
        sourceName: collector.sourceName,
        tenantId: tenant.id,
        type: collector.type,
        endpointOrUrl: /* carregado do banco */,
        isActive: true,
      };

      await collector.collect(config);
    }
  }

  stopScheduler() {
    for (const timeoutId of this.activeSchedules.values()) {
      clearInterval(timeoutId);
    }
    console.log('✅ Orquestrador parado.');
  }
}
```

**Arquivos a criar:**
- ✅ `server/lib/orchestrator/CollectorOrchestrator.ts`
- ✅ `server/lib/connectors/impl/PncpMunicipalCollector.ts`

---

## ARQUIVOS CRÍTICOS A CRIAR/REFATORAR

### Estrutura Recomendada
```
server/
├── lib/
│   ├── connectors/
│   │   ├── base/
│   │   │   ├── ILicitacaoCollector.ts         [NOVO]
│   │   │   └── BaseCollector.ts               [NOVO]
│   │   ├── impl/
│   │   │   ├── PncpCollector.ts               [NOVO, refactor pncp_collector.ts]
│   │   │   ├── ComprasRjCollector.ts          [NOVO]
│   │   │   ├── SistemaScollector.ts           [NOVO]
│   │   │   └── PncpMunicipalCollector.ts      [NOVO]
│   │   ├── registry/
│   │   │   └── CollectorRegistry.ts           [NOVO]
│   │   └── utils/
│   │       └── collector-utils.ts             [NOVO]
│   ├── orchestrator/
│   │   └── CollectorOrchestrator.ts           [NOVO]
│   ├── connectorExecutor.ts                   [EXISTENTE - manter]
│   ├── sistemaSUrls.ts                        [EXISTENTE - manter]
│   ├── pncpSourcesCatalog.ts                  [EXISTENTE - estender]
│   └── amplitude-ai.ts                        [ATUALIZAR com novos eventos]
├── workers/
│   ├── unified_collector.ts                   [NOVO - substitui pncp_collector.ts]
│   ├── pncp_collector.ts                      [DESCONTINUAR ou convertir em alias]
│   ├── historical_pncp_extractor.ts           [MANTER]
│   └── scraper_puppeteer_sesc.ts              [MANTER, integrar ao registry depois]
└── db/
    └── schema.ts                              [EXISTENTE, adicionar columns para tracking]

docs/
├── TELEMETRY_EVENTS_SCHEMA.md                 [NOVO]
└── REFACTORING_ROADMAP.md                     [ESTE ARQUIVO]

tests/
├── __connector_pipeline__.test.ts             [EXISTENTE]
├── __connector_telemetry__.test.ts            [NOVO]
├── __compras_rj_collector__.test.ts           [NOVO]
├── __sistema_s_collector__.test.ts            [NOVO]
└── __orchestrator__.test.ts                   [NOVO]
```

---

## ORDEM DE EXECUÇÃO (Dependency Graph)

```
FASE 1 — Base Architecture
├── 1. server/lib/connectors/base/ILicitacaoCollector.ts
├── 2. server/lib/connectors/base/BaseCollector.ts
├── 3. server/lib/connectors/registry/CollectorRegistry.ts
├── 4. server/lib/connectors/impl/PncpCollector.ts (refactor)
├── 5. server/lib/connectors/impl/ComprasRjCollector.ts
├── 6. Update server/lib/amplitude-ai.ts (telemetria)
└── 7. server/workers/unified_collector.ts

FASE 2 — Sistema S
├── 1. server/lib/connectors/impl/SistemaScollector.ts
├── 2. Update CollectorRegistry (adicionar 5 plataformas)
└── 3. Tests: __sistema_s_collector__.test.ts

FASE 3 — Otimizações + Orquestração
├── 1. server/lib/connectors/impl/PncpMunicipalCollector.ts
├── 2. server/lib/orchestrator/CollectorOrchestrator.ts
└── 3. Tests: __orchestrator__.test.ts

Testes Transversais
├── __connector_telemetry__.test.ts
├── __compras_rj_collector__.test.ts
└── Integration tests (E2E)
```

---

## TESTES ESPERADOS

### Fase 1
- ✅ `__connector_pipeline__.test.ts` - Normalização e validação de conectores (EXISTENTE)
- ✅ `__connector_telemetry__.test.ts` - Schema de eventos licitacao_source_polled, etc.
- ✅ `__compras_rj_collector__.test.ts` - Parsing de DataTables Compras RJ
- ✅ Unit tests para BaseCollector (retry logic, tracking)

### Fase 2
- ✅ `__sistema_s_collector__.test.ts` - Scraping Paradigma Mural.aspx

### Fase 3
- ✅ `__orchestrator__.test.ts` - Scheduling e prioridades
- ✅ E2E: Executar unified_collector em sandbox e validar DB inserts

---

## COMMITS PROPOSTOS

### Fase 1
```
commit 1: feat(connectors): abstract base class and interface for multi-source collectors
  - Novo: ILicitacaoCollector.ts
  - Novo: BaseCollector.ts com retry + telemetria

commit 2: feat(connectors): implement Compras RJ collector via DataTables AJAX
  - Novo: ComprasRjCollector.ts
  - Novo: CollectorRegistry.ts
  - Atualizar: amplitude-ai.ts com eventos estruturados

commit 3: refactor(workers): consolidate into unified collector orchestrator
  - Novo: unified_collector.ts
  - Refactor: pncp_collector.ts → PncpCollector.ts

commit 4: test(connectors): telemetry schema and collector unit tests
  - Novo: __connector_telemetry__.test.ts
  - Novo: __compras_rj_collector__.test.ts
```

### Fase 2
```
commit 5: feat(connectors): implement Sistema S collector for Paradigma portals
  - Novo: SistemaScollector.ts
  - Atualizar: CollectorRegistry.ts (5 plataformas)

commit 6: test(connectors): Sistema S scraping integration tests
  - Novo: __sistema_s_collector__.test.ts
```

### Fase 3
```
commit 7: feat(orchestrator): scheduling with priorities and multi-tenant support
  - Novo: CollectorOrchestrator.ts
  - Novo: PncpMunicipalCollector.ts

commit 8: test(orchestrator): integration tests for full pipeline
  - Novo: __orchestrator__.test.ts
```

---

## MÉTRICAS DE SUCESSO

| Métrica | Baseline | Target (Pós-Roadmap) |
|---------|----------|----------------------|
| **Coletores Suportados** | 1 (PNCP) | 8 (PNCP, Compras RJ, 5×Sistema S, Municipal Batch) |
| **Taxa de Reutilização de Código** | Mínima (pncp_collector.ts isolado) | 80% (BaseCollector + Registry) |
| **Latência de Coleta** | 3-5s/execução | 2-3s/execução (otimizado) |
| **Disponibilidade de Fontes** | 1 fonte ativa | 8+ fontes simultâneas |
| **Cobertura de Editais** | ~250/dia (PNCP) | ~1.000+/dia (3 fontes + 148 ERPs) |
| **Eventos Telemetria** | Ad-hoc | Estruturado (3 tipos) |
| **Teste Coverage** | 70% | 90%+ (todos coletores) |

---

## RISCOS E MITIGATION

| Risco | Impacto | Mitigation |
|-------|--------|-----------|
| **Compras RJ mudança de layout** | Alta | Monitorar `healthCheck()` antes de cada coleta; fallback para PNCP |
| **Sistema S Paradigma ASP.NET ViewState** | Média | Usar Puppeteer se POST form falhar (fallback strategy) |
| **Taxa de chamadas 148 GovTechs** | Média | Batch collection em horários off-peak (madrugada) |
| **Amplitude quota** | Baixa | Aggregar eventos se necessário (batching de lotes) |
| **Multi-tenant isolation** | Alta | Validar tenantId em toda persistência; testes de RBAC |

---

## Próximos Passos (Após Roadmap)

1. **Fase 4 (Semana 7-8):** Integrar histórico Atas de Registro de Preço (Compras RJ)
2. **Fase 5 (Semana 9):** Detectar retificações automáticas (compara hash de editais)
3. **Fase 6 (Semana 10+):** Scrapers para Compras MG, Compras São Paulo (outros estados)

---

**Última Atualização:** 2026-09-12  
**Roadmap ID:** RM-2026-Q3-MULTIFONTE  
**Status:** ✅ Pronto para Implementação
