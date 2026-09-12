# SUMÁRIO EXECUTIVO - Refatoração Multi-Fonte
**Data:** 2026-09-12 | **Status:** Pronto para Implementação  
**Referência:** ROADMAP_REFACTORACAO_MULTI_FONTE.md + ANALISE_REFACTORACAO.md

---

## GAPS PRINCIPAIS (Por Que Refatorar)

| Gap | Impacto | Evidência |
|-----|---------|-----------|
| **Sem Interface Comum** | Código isolado, sem reutilização (20%) | ANALISE:45-49 |
| **Telemetria Ad-hoc** | Zero observabilidade multi-fonte | ANALISE:51-54, ROADMAP:369-413 |
| **Orquestração Manual** | Cada collector é worker isolado; sem priorização | ANALISE:56-60, ROADMAP:17 |
| **1 Collector Apenas** | ~250 editais/dia; 7 fontes não implementadas | ANALISE:6-42 |

**Saída esperada:** 8+ collectors reutilizáveis, observabilidade centralizada, ~1000+ editais/dia.

---

## 3 FASES DE IMPLEMENTAÇÃO

### ✅ FASE 1: PNCP + Compras RJ (2 semanas)
**Duração:** Semana 1-2 | **Objetivos:** Base architecture + telemetria estruturada

| Ordem | Arquivo | Ação | Dependência |
|-------|---------|------|-------------|
| 1 | `server/lib/connectors/base/ILicitacaoCollector.ts` | **Novo** | — |
| 2 | `server/lib/connectors/base/BaseCollector.ts` | **Novo** + retry + telemetry | ← 1 |
| 3 | `server/lib/connectors/registry/CollectorRegistry.ts` | **Novo** singleton | ← 1,2 |
| 4 | `server/lib/connectors/impl/PncpCollector.ts` | Refactor pncp_collector.ts | ← 1,2,3 |
| 5 | `server/lib/connectors/impl/ComprasRjCollector.ts` | **Novo** DataTables parser | ← 1,2,3 |
| 6 | `server/lib/amplitude-ai.ts` | Update eventos: `licitacao_source_polled`, `licitacao_items_extracted`, `licitacao_parse_failed` | ← 2 |
| 7 | `server/workers/unified_collector.ts` | **Novo** orchestrator | ← 1-6 |
| 8 | `docs/TELEMETRY_EVENTS_SCHEMA.md` | **Novo** schema validation | — |
| 9 | Tests | `__connector_telemetry__.test.ts`, `__compras_rj_collector__.test.ts` | ← 1-8 |

**Saída:** 2 collectors + telemetria estruturada + ~500 editais/dia  
**Ref.:** ROADMAP:21-577, ANALISE:284-290

---

### 🔄 FASE 2: Sistema S (1 semana)
**Duração:** Semana 3-4 | **Objetivos:** Coletor Paradigma genérico (5 plataformas)

| Ordem | Arquivo | Ação |
|-------|---------|------|
| 1 | `server/lib/connectors/impl/SistemaScollector.ts` | **Novo** Cheerio + Puppeteer fallback |
| 2 | `server/lib/connectors/registry/CollectorRegistry.ts` | Atualizar: registrar 5 SistemaS collectors |
| 3 | Tests | `__sistema_s_collector__.test.ts` |

**Saída:** +5 collectors (SEST/SENAT, SESC DN/SP/RS, SESI/SENAI RS)  
**Saída final:** ~700 editais/dia  
**Ref.:** ROADMAP:580-699, ANALISE:293-300

---

### 🎯 FASE 3: ERPs Municipais + Orquestração (1-2 semanas)
**Duração:** Semana 5-6 | **Objetivos:** Batch 148 GovTechs + scheduler centralizado

| Ordem | Arquivo | Ação |
|-------|---------|------|
| 1 | `server/lib/connectors/impl/PncpMunicipalCollector.ts` | **Novo** batch 148 CNPJs |
| 2 | `server/lib/orchestrator/CollectorOrchestrator.ts` | **Novo** scheduling + prioridades |
| 3 | Tests | `__orchestrator__.test.ts` E2E |

**Saída:** Full pipeline, ~1000+ editais/dia, centralização observabilidade  
**Ref.:** ROADMAP:701-819, ANALISE:304-310

---

## KPIs DE SUCESSO (Antes vs Depois)

| KPI | Baseline | Target | Ganho |
|-----|----------|--------|-------|
| **Coletores** | 1 (PNCP) | 8+ (PNCP, RJ, 5×SistemaS, Municipal) | **8x** |
| **Editais/dia** | ~250 | ~1000+ | **4x** |
| **Taxa Reutilização** | 20% | 80% (BaseCollector + Registry) | **4x** |
| **Latência Média** | 3-5s | 2-3s | **2x mais rápido** |
| **Observabilidade** | 0% (ad-hoc) | 100% (3 eventos estruturados) | **∞** |
| **Fontes Monitoradas** | 1 | 8+ simultâneas | **8x** |

**Ref.:** ROADMAP:967-977, ANALISE:265-272

---

## RISCOS E MITIGAÇÕES

| Risco | Prob. | Mitigation |
|-------|-------|-----------|
| **Compras RJ muda layout HTML** | Média (40%) | Health check pre-coleta + fallback PNCP (ROADMAP:983) |
| **Sistema S Paradigma ViewState obrigatório** | Baixa (20%) | Puppeteer com retry strategy (ROADMAP:984) |
| **Taxa Amplitude quota excedida** | Baixa (10%) | Batch eventos se necessário (ROADMAP:985) |
| **Multi-tenant isolation breach** | Baixa (5%) | Validar tenantId em toda persistência + RBAC tests (ROADMAP:986) |

**Ref.:** ROADMAP:981-989, ANALISE:339-345

---

## PRÓXIMAS AÇÕES IMEDIATAS (Semana 1)

1. **Criar branch:** `feature/multi-source-collectors` (Semana 1, Dia 1)
2. **Implementar ILicitacaoCollector** (`server/lib/connectors/base/ILicitacaoCollector.ts`)  
   - Interface + tipos base (CollectorConfig, CollectorItem, CollectorResult)  
   - **Ref.:** ROADMAP:28-93
3. **Implementar BaseCollector** (`server/lib/connectors/base/BaseCollector.ts`)  
   - Retry logic exponencial + trackTelemetry()  
   - **Ref.:** ROADMAP:96-245
4. **Criar CollectorRegistry** (`server/lib/connectors/registry/CollectorRegistry.ts`)  
   - Singleton com `register()` + `getCollector()`  
   - **Ref.:** ROADMAP:455-490
5. **Refatorar PNCP** → `PncpCollector.ts` extends BaseCollector  
   - **Ref.:** ROADMAP:248-261
6. **Testes iniciais** na Fase 1 antes de avançar  
   - **Ref.:** ROADMAP:905-918

**Commit esperado (Semana 1):** `feat(connectors): abstract base class and interface` (ROADMAP:926)

---

## CRONOGRAMA SIMPLIFICADO

```
Semana 1:  Fase 1a (Base) — ILicitacaoCollector, BaseCollector, Registry
Semana 2:  Fase 1b (Impl) — ComprasRjCollector, unified_collector, telemetria
Semana 3:  Fase 2 (SistemaS) — SistemaScollector + 5 plataformas
Semana 4:  Fase 2 testes + Fase 3a (Municipal batch)
Semana 5:  Fase 3b (Orchestrator) — scheduling + prioridades
Semana 6:  E2E tests + merge + produção
```

**Esforço total:** 4-6 semanas | **Equipe:** 1-2 devs | **Risco:** Baixo-Médio

---

**Documento:** EXECUTIVO_REFACTORACAO.md  
**Última atualização:** 2026-09-12  
**Status de Implementação:** ✅ Pronto para Kickoff
