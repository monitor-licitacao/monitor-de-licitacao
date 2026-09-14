> GitHub: https://github.com/monitor-licitacao/monitor-de-licitacao/issues/96

## 1. Objetivo

Persistir o **grafo de fatos do edital** em PostgreSQL: hash + versão + extração produzindo `facts`, `requirements`, `risks` e `evidence` com âncora no oficial.

**Por quê:** necessidade competitiva (Licinexus já extrai requisitos × perfil). Catálogo (#93) só lista PDFs. Chunk de RAG responde pergunta; **fato estruturado calcula decisão**. Análise **não** gera o OpportunityScore — gera evidências que alimentam fatores.

Não é graph database. Não é RAG.

## 2. Critérios de aceite

### Negócio

- [ ] Golden Pregão 224/2026 Passex (`00394452000103-1-019732/2026`): ≥1 fact, ≥1 requirement e ≥1 risk com `source_page` + `source_anchor` (ex.: entrega Bento Gonçalves, SRP sem garantia, ME/EPP)
- [ ] Fato sem âncora **não persiste**
- [ ] `fact_kind`: `FACT` | `REQUIREMENT` | `RISK`
- [ ] Relações: `REQUIRES`, `APPLIES_TO`, `REFERENCES`, `SUPERSEDES`, `CONTRADICTS`, `DEPENDS_ON`
- [ ] UI da ficha: lista fatos + âncora (não módulo novo). Clique abre trecho oficial
- [ ] Nenhum embedding/chunk indexado como entrega deste GATE

### Técnico

- [ ] `document_fact`: `contratacao_id`, `document_id`, `document_version_id`, `fact_kind`, `fact_type`, `value_json`, `confidence`, `source_page`, `source_anchor`, `extraction_method`
- [ ] `fact_relation`: `from_fact_id`, `relation_type`, `to_fact_id`
- [ ] Hash + versão do binário via contrato de storage #48 — sem reinventar blob
- [ ] Extração on-demand da contratação (não dump nacional)
- [ ] Testes com fixture Passex; `extraction_method` explícito (`text` | `table` | `ocr`)
- [ ] `npm test` + `npm run lint` verdes

## 3. Escopo

### In

1. Schema + persist idempotente por `(document_version_id, fact_type, source_anchor)`
2. Extração mínima de texto/tabela o suficiente para 1 golden
3. API de leitura na ficha

### Out

- OCR/RAG genérico; embeddings; chat no PDF
- `LLM → score` (o grafo não calcula OpportunityScore)
- Download-em-massa nacional
- Graph DB (Neo4j etc.)
- Duplicar o catálogo de #93

## 4. Riscos

- **#93 ainda sem anexos reais:** GATE bloqueado até Anexos(4) no Passex
- **#48 storage indefinido:** não criar terceiro contrato de blob; esperar ou puxar o mínimo do #48
- **Alucinação de fato:** sem âncora = rejeitar. Confiança baixa ≠ inventar

## 5. Rastreabilidade

- **PRD:** `doc/PRD-produto-copiloto-decisao.md` (seção grafo)
- **Roadmap:** Fase 1 seguinte / desbloqueia Fase 3 e Match V2
- **Depende:** #93, #48
- **Área:** `area:ingestao`, `area:api`
- **Prioridade:** P1
- **Executor:** `exec:cursor`
