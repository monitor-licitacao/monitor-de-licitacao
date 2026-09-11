# 📑 PRD: Plano Estratégico de Melhorias no Produto — Monitor de Licitações (2026)

**Documento:** PRD Unificado de Melhorias do Produto  
**Status:** Proposta de Alinhamento Técnico & Negócio (Pronto para Revisão)  
**Data:** Setembro de 2026  
**Autores & Colaboradores:** Marcelo (@marcelo.abissulo), Cursor (@U0BV76QTZ4M), Claude (@U0C019QFGTW), Amplitude (@U0BVDE26BA7)  
**Repositório Oficial:** `monitor-licitacao/monitor-de-licitacao`  
**Governança & Rastreabilidade:** Regras de Ouro (`GOLDEN_RULES.md`), SOP v1 (`docs/processo/gates-operacionais.md`), Linear (`CLA-31`, `CLA-32`, `CLA-23–CLA-26`), GitHub Issue #48.

---

## 1. Sumário Executivo & Diagnóstico do Ecossistema

O **Monitor de Licitações** evoluiu de uma prova de conceito para um ecossistema com captura multicanal (PNCP, Compras.gov.br, Compras RJ, Sistema S e prefeituras), análise jurídica assistida por IA (detecção de direcionamento restritivo em NCM 9506.91 / fitness) e inteligência de vendas (RevOps e sincronização com Ploomes CRM).

A análise transversal de todo o material (histórico de PRs #1 a #55, PRDs em `docs/`, curadorias de fontes, telemetria em `server/lib/amplitude-ai.ts` e backlog no Linear) identificou três realidades fundamentais:
1. **Vertical especializada com alto valor competitivo:** O foco em compras públicas do segmento Fitness/Equipamentos (NCM 9506.91, Sistema S, Compras RJ e PNCP) tem barreira técnica e jurídica que concorrentes horizontais genéricos não cobrem.
2. **Débito de persistência e unificação de ponta a ponta:** Há peças robustas (banco Neon DB, workers PNCP, scraper paginado Compras RJ, motor SDR e RevOps), mas fluxos como o Cofre GCS de Editais (Issue #48) e a interface de gestão de oportunidades (Linear `CLA-31`) ainda possuem pontas desacopladas.
3. **Maturidade de IA e Telemetria (Amplitude Agent Analytics):** O projeto já conta com `@amplitude/ai` e 4 agentes rastreados (`sdr-agent`, `revops-agent`, `edital-ncm-analyzer`, `technical-spec-auditor`). É hora de alavancar esses dados para orientar decisões de produto e funil.

---

## 2. Princípios Inegociáveis (Golden Rules Aplicadas ao Escopo)

Toda melhoria neste PRD deve respeitar rigorosamente as **Regras de Ouro**:
1. **Zero Alucinação Jurídica:** Proibido inventar dados. Fallbacks obrigatórios para `[DADO NÃO ENCONTRADO]`. Minutas de impugnação/recurso exigem disclaimer visual e **Aceite de Revisão Humana** explícito antes de cópia/exportação.
2. **Apenas Integrações Reais:** Fim de mocks silenciosos em produção. Se uma integração externa ou fonte estiver em teste, deve exibir a badge `[BETA/MOCK]`.
3. **Segurança Default-On:** Sem rotas abertas; autenticação JWT/Tenant obrigatória, rate limiting em rotas de IA, TLS obrigatório em requisições de coleta.
4. **Fonte da Verdade Persistida:** Nenhum dado operacional em memória volátil. Tudo via Drizzle ORM no PostgreSQL Neon com isolamento por `tenant_id`.
5. **Priorização por Bloqueadores:** Riscos jurídicos e integridade de dados precedem estética e cosmética visual.
6. **Privacidade e Observer:** Sanitização e redação de PII (CNPJ, valores monetários internos) antes de envio para provedores externos de analytics.

---

## 3. Matriz de Clusterização do Escopo: Fluxos, Prioridades e Responsabilidades

O escopo de melhorias foi clusterizado em **4 grandes fluxos de trabalho**, ordenados por ordem decrescente de prioridade estratégica e operacional:

| Cluster | Fluxo de Responsabilidade | Prioridade | Dono / Liderança | Objetivos Principais |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | **Ingestão, Pipeline de Fontes & Cofre de Documentos** | **P0 (Crítico / Bloqueador)** | Engenharia de Dados & Infra | Finalizar contrato do Cofre GCS (Issue #48), estabilizar scrapers de Compras RJ e Sistema S, e ingestão incremental no Neon DB. |
| **C2** | **Governança Jurídica, IA Confiável & Human-in-the-Loop** | **P0 (Crítico / Jurídico)** | Produto Jurídico & IA | Zero alucinação, trava de revisão humana para impugnações, compliance com Lei 14.133/2021 e classificação de restritividade. |
| **C3** | **RevOps, CRM & Funil de Oportunidades (Ploomes/Gestão)** | **P1 (Alto Impacto / Negócio)** | RevOps & Comercial | Interface visual para aprovação de deals, descarte de ervas daninhas (estagnados), sync bidirecional Ploomes e métricas de conversão. |
| **C4** | **Produto Analytics, Telemetria Amplitude & Experiência** | **P2 (Diferenciação & Escala)** | Product Growth & Amplitude | Agent Analytics em tempo real, painel executivo de funil, alertas proativos de renovação contratual (30/60/90/180 dias) e white-label. |

---

## 4. Detalhamento dos Clusters e Épicos

### 📦 Cluster 1: Ingestão, Pipeline de Fontes & Cofre de Documentos (Prioridade P0)
*Liderança: Engenharia de Backend / Infraestrutura*

#### Épico 1.0 — Ingestão em 2 Níveis & Cache Lazy de Documentos (Benchmark Todas Licitações)
- **Aprendizado Competitivo:** O modelo do *Todas Licitações* comprova que indexar previamente apenas metadados leves (objeto, órgão, datas, valores, município/UF) e hidratar itens/documentos **sob demanda (on-demand/lazy) com cache local** reduz drasticamente o custo de computação e storage, permitindo cobrir alto volume sem onerar a infraestrutura.
- **Implementação no Monitor:**
  1. **Nível 1 (Lote Leve):** Sincronização periódica PNCP apenas para índice pesquisável no Neon DB (`editais`), sem download antecipado de PDFs pesados de todo o universo.
  2. **Nível 2 (Hidratação Sob Demanda / Trigger de Negócio):** O download de PDFs, OCR e anexos para o Cofre GCS só é disparado quando: (a) o edital possui aderência ao NCM/termo de negócio do tenant (ex.: 9506.91), ou (b) o usuário abre o detalhe da oportunidade no app.
  3. **Camada de Cache de Borda/Local:** Respostas de detalhes de itens ficam cacheadas para evitar reconsultas desnecessárias à API pública do PNCP (respeitando rate limits).

#### Épico 1.1 — Cofre Canônico de Editais (Gate 1 / Issue #48)
- **Problema:** O campo `editais.s3_storage_key` é um ponteiro legado mantido por compatibilidade. PDFs originais de editais ainda não contam com upload idempotente e seguro no GCS/S3 com isolamento multitenant.
- **Entregas:**
  1. Concluir migração da tabela `edital_documents` com chave composta `(edital_id, tenant_id)` e hash SHA-256 para desduplicação.
  2. Implementar endpoint seguro de URL assinada (`GET /api/editais/:id/vault-url`) com validação de tenant (prevenção de IDOR).
  3. Worker de ingestão automática de arquivos anexos dos editais qualificados.
- **Critérios de Aceite:**
  - Nenhuma requisição a arquivos permite download cross-tenant.
  - Parser compatível com `s3://`, `gs://` e `gcs://`.

#### Épico 1.2 — Estabilização e Orquestração dos Coletores
- **Problema:** Scrapers pontuais dependem de execuções manuais ou scripts CLI desacoplados (ex.: `historico_precos_familia19_classe7830.py`, `pncp_collector.ts`).
- **Entregas:**
  1. Integrar o coletor paginado do Compras RJ e os conectores da API PNCP ao agendador central (`schedulerState`).
  2. Implementar resiliência com circuit-breaker, retry exponencial e checkpoint persistente no banco de dados.
  3. Suporte a multi-NCM dinâmico por tenant (`tenant_ncms`), permitindo que clientes monitorem seus próprios catálogos.

---

### ⚖️ Cluster 2: Governança Jurídica, IA Confiável & Human-in-the-Loop (Prioridade P0)
*Liderança: Jurídico & Engenharia de IA*

#### Épico 2.1 — Trava de Revisão Humana Obrigatória (HITL)
- **Problema:** Risco de utilização acidental de minutas jurídicas geradas por IA contendo alucinações de marcas ou jurisprudências não checadas.
- **Entregas:**
  1. Bloqueio no frontend do botão "Copiar Minuta" ou "Exportar PDF" até que o analista humano marque o checkbox de auditoria dos itens identificados.
  2. Exibição explícita de `source_url`, data de captura e hash do edital em todo parecer de achado (`Finding`).
  3. Inclusão compulsória do marcador `[DADO NÃO ENCONTRADO]` e disclaimer padrão em qualquer saída gerada por LLM.

#### Épico 2.2 — Motor de Análise de Restritividade de Especificação Técnica
- **Problema:** Editais com descrições sob medida (direcionamento velado) que desclassificam produtos equivalentes.
- **Entregas:**
  1. Aprimorar o `technical-spec-auditor` para cruzar o Termo de Referência com a biblioteca de jurisprudência (TCU / Lei 14.133).
  2. Geração automática de minuta de pedido de esclarecimento e impugnação administrativa fundamentada.
  3. Auditoria de idoneidade de fornecedores alternativos sugeridos via bases públicas (CEIS/CNEP).

---

### 💼 Cluster 3: RevOps, CRM & Funil de Oportunidades (Prioridade P1)
*Liderança: RevOps & Equipe Comercial*

#### Épico 3.1 — Dashboard Gerencial de Oportunidades & Aprovação (Linear CLA-31)
- **Problema:** O motor autônomo (SDR Agent e RevOps Agent) calcula métricas e sugere movimentações de negócios, mas a equipe comercial precisa de uma tela visual para validar ações críticas.
- **Entregas:**
  1. Nova view no frontend (`/crm`) com indicadores em tempo real: Win Rate, Conversão de Coorte e Oportunidades Estagnadas.
  2. Interface de "Aprovação de Ações Rápidas": botão para aprovar ou rejeitar o arquivamento de negócios estagnados (limpeza de funil).
  3. Renderização visual do Briefing Estratégico com skeleton loader para mitigar a latência da IA.

#### Épico 3.2 — Sincronização Bidirecional com Ploomes CRM
- **Problema:** A sincronização atual cria o Deal no Ploomes, mas atualizações subsequentes (ex.: edital suspenso, revogado ou retificado) não refletem no CRM externo.
- **Entregas:**
  1. Webhook de notificação de retificações e atualizações de status para o Ploomes.
  2. Mapeamento de campos customizados por tenant (`tenant_configs.ploomes_config`).
  3. Rastreio de SLA de resposta e datas de pregão com alerta no canal comercial.

---

### 📊 Cluster 4: Produto Analytics, Telemetria Amplitude & Experiência (Prioridade P2)
*Liderança: Product Growth & Amplitude*

#### Épico 4.1 — Amplitude Agent Analytics & Governança de Sessões
- **Problema:** É necessário visibilidade contínua de custo, tokens, latência e taxa de sucesso dos 4 agentes ativos no produto.
- **Entregas:**
  1. Monitorar sessões dos agentes (`sdr-agent`, `revops-agent`, `edital-ncm-analyzer`, `technical-spec-auditor`) garantindo sessionId estável por entidade de negócio.
  2. Criação de dashboards de observabilidade de IA: taxa de fallback heurístico, distribuição de modelos (Gemini vs Grok/xAI) e custo por tenant.
  3. Telemetria de engajamento do usuário final: quais editais foram revisados, tempo gasto na análise e taxa de conversão em lances.

#### Épico 4.2 — Radar de Renovação Contratual & Prova Social
- **Problema:** Identificado no dossiê comparativo de mercado: oportunidade de antecipar contratos públicos que estão para expirar em 30, 60, 90 e 180 dias.
- **Entregas:**
  1. Mapeamento de Atas de Registro de Preço e Contratos anteriores para emitir alertas preditivos de renovação.
  2. Módulo de Preços Homologados Históricos para embasamento de propostas e inteligência competitiva.

#### Épico 4.3 — Estratégia de Aquisição Orgânica (SEO Programático & Hubs Públicos)
- **Aprendizado Competitivo:** O *Todas Licitações* constrói tração orgânica em massa sem custos de tráfego pago gerando URLs semânticas e hubs hierárquicos SSR (`/licitacoes/{categoria}/{uf}/{municipio}`).
- **Implementação no Monitor (Top-of-Funnel B2B):**
  1. Criar camada pública de hubs por segmento (ex.: `/licitacoes/equipamentos-fitness-academias`, `/licitacoes/sistema-s/{uf}`) expondo dados agregados e listagem leve.
  2. Call-to-action nos hubs para conversão direta no SaaS: *"Quer ser alertado quando sair edital deste órgão com minuta pronta de impugnação? Teste o Monitor"*.
  3. Manter a separação estrita: páginas públicas em SSR leve para aquisição; inteligência pesada (IA, auditoria de restrição, pipeline Ploomes) restrita ao workspace privado do assinante.

---

## 5. Matriz de Rastreabilidade e Mapeamento de Responsabilidades (RACI)

| Entrega / Épico | Marcelo (Product Lead) | Cursor (Engenharia Full-Stack) | Claude (Arquitetura & Refinamento) | Amplitude (Analytics & Métricas) |
| :--- | :---: | :---: | :---: | :---: |
| **Cofre de Editais (Issue #48)** | Aprovador | Executor Principal | Revisor de Contrato | Validador de Eventos |
| **Coletores e Scrapers (Compras RJ/PNCP)** | Aprovador | Executor | Suporte & Curadoria | Monitor de Confiabilidade |
| **Governança Jurídica & Trava HITL** | Aprovador | Executor Frontend/Backend | Auditor de Prompts & Compliance | Validador de Métricas de Uso |
| **Dashboard RevOps & Tela CRM (CLA-31)** | Aprovador | Desenvolvedor UI/API | Revisor de UX & Negócio | Monitor de Adoção de Features |
| **Sincronização Ploomes CRM** | Aprovador | Integrador API | Validador de Contrato | Monitor de Erros |
| **Telemetria de Agentes & Dashboards** | Stakeholder | Instrumentador de Código | Revisor de Taxonomia | Liderança Técnica de Métricas |

*Legenda: Aprovador (Accountable), Executor (Responsible), Revisor/Suporte (Consulted), Validador/Monitor (Informed).*

---

## 6. Plano de Entregas Fatiadas (Roadmap Operacional)

```
Sprint Atual (Fundação & Segurança):
├─ [x] Mapeamento e Curadoria de Portais e Fontes (PNCP, Compras RJ, Sistema S)
├─ [x] Coletor com TLS, retry e checkpoint (PR #55)
├─ [ ] Fechar Contrato do Cofre GCS de Editais (Gate 1 / Issue #48)
└─ [ ] Implementar Trava de Revisão Humana Obrigatória na UI

Sprint +1 (Adoção & Operação Comercial):
├─ [ ] Dashboard RevOps & Ações Rápidas de Higiene (Linear CLA-31)
├─ [ ] Sincronização Bidirecional com Ploomes CRM
└─ [ ] Dashboards de Agent Analytics no Amplitude

Sprint +2 (Expansão & Inteligência Competitiva):
├─ [ ] Radar de Renovação de Contratos (30/60/90/180 dias)
├─ [ ] Pipeline Multi-Agente Grok com Taxonomia NELCA (Linear CLA-32)
└─ [ ] Suporte a Multi-NCM por Tenant
```

---

## 7. Critérios de Sucesso e KPIs (Métricas Amplitude)

1. **Eficiência Operacional:**
   - Redução do tempo de triagem de editais por analista de ~4 horas para < 20 minutos.
   - 100% dos editais aprovados no CRM com rastreabilidade auditável (`ploomes_deal_id`).
2. **Qualidade & Segurança:**
   - 0 ocorrências de desclassificação ou sanção decorrente de alucinação de IA (100% das minutas com auditoria e aceite humano).
   - 100% de chamadas externas de dados com TLS habilitado e sanitização PII ativa.
3. **Métricas de Agent Analytics:**
   - Cobertura de 100% das sessões dos agentes com identidade, latência e contagem de tokens reportadas no Amplitude.
   - Taxa de falha/fallback de LLM inferior a 2%.
