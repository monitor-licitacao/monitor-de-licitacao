# PRD de produto — Copiloto de decisão comercial

**Produto:** Monitor de Licitações · **Versão:** 1.1 · **Status:** Aprovado (tese + emenda vídeo/edital 14/09/2026)  
**Camada de dados:** [PRD v2](./PRD-v2-plataforma-inteligencia-licitacoes.md) (contrato intacto)  
**Roadmap:** [ROADMAP-decisao.md](./plans/ROADMAP-decisao.md)  
**Epic:** [#94](https://github.com/monitor-licitacao/monitor-de-licitacao/issues/94)

## Duas camadas, um sistema

```text
PRD v2        = como os dados existem, entram, se relacionam e mantêm rastreabilidade
PRD copiloto  = como esses dados viram decisão para uma empresa
```

Este documento **não** muda coleta, normalização, identificação nem reconciliação. Responde só: o que fazemos com isso para uma empresa decidir.

```text
PRD Produto
     ↓
PRD Dados (v2)
     ↓
Schema / ingestão / pipelines
```

## Visão

Não somos um buscador de licitações. Não somos uma plataforma horizontal com dezenas de módulos.

Somos um **motor de decisão comercial para vendas ao governo**.

Unidade conceitual: **empresa × oportunidade**, não “licitação”. O mesmo edital produz scores diferentes para empresas diferentes.

Slogan: **Saiba em quais licitações entrar — e por quê.**

Três perguntas de produto (não comprimir num único %):

```text
1. POSSO PARTICIPAR?     perfil × edital (habilitação + capacidade)
2. VALE A PENA?          viabilidade (preço + concorrência + risco + SRP)
3. COMO GANHAR?          inteligência competitiva (histórico, disputa, deságio)
```

Diferencial frente à Licinexus (já comercializa esta narrativa): **decisão explicável, verificável e auditável** — cada fator clica até trecho oficial + documento da empresa + cobertura. Não “IA → NÃO PARTICIPAR”.

## Não-metas

- Copiar a árvore de módulos da Licinexus (ERP, SICAF, patrimônio, marketplace, vertical governo).
- Matching só por CNAE.
- LLM resumindo PDF como produto.
- `LLM → score 87` (análise gera **fatos**, não o número).
- Segundo motor de score (`chance` / `match` / `aderência` / `probabilidade` como conceitos paralelos).
- Rotular a UI como **“chance de vitória”** ou “probabilidade de vitória” sem calibração estatística em resultados reais.
- `score > 80` = PARTICIPAR.
- Média com fator impeditivo (`habilitação = 0`).
- `dados ausentes = 0`.
- Inflar `tenant_party` com inteligência comercial.
- Misturar perfil comercial e habilitação na mesma entidade.
- Grafo documental como chunks de RAG.
- Rotas novas (`/radar`, `/copiloto`, `/intelligence`) para o que cabe na ficha `/contratacoes/:id`.
- Versionar HAR com token. Ver #91.

## Cadeia de decisão (spine)

```text
OPORTUNIDADE → EDITAL + ANEXOS → FATOS → ADERÊNCIA
     → PREÇO → RISCO → GATES → RECOMENDAÇÃO → RESULTADO → FEEDBACK
```

## Contratos estruturais

### 1. Score ≠ confidence (copy: Aderência)

Nome técnico: `OpportunityScore`. Copy de produto: **Aderência à oportunidade /100** + **Confiança da análise**. Só usar “probabilidade de vitória: N%” com corpus histórico suficiente para calibrar.

```text
opportunity_score
├── score              0–100 (só fatores SUPPORTED)
├── confidence         0–1 (cobertura de evidência)
├── formula_version    1 | 2 | …
├── calculated_at
└── factors[]
      ├── key
      ├── value
      ├── weight
      ├── confidence
      ├── evidence_count
      ├── status           SUPPORTED | UNKNOWN | CONFLICTING
      └── explanation
```

`87` com 95% dos dados ≠ `87` com 35% dos dados. A UI mostra os dois.

### 2. Evidence é entidade de primeira classe

Toda recomendação aponta para `evidence[]`. Cadeia: **fator → evidência → fonte**.

Fonte: `source_record` | `document_page` | `document_fact` | `company_profile` | `price_observation` | `historical_result`.

Nenhuma entidade derivada sem âncora (princípio 4 do PRD v2). Clique no fator abre trecho oficial (página/cláusula) + doc da empresa + cobertura %.

### 3. Recommendation ≠ OpportunityScore ≠ CommercialViability

Score mede aderência (Posso / combina). CommercialViability mede se vale (preço + concorrência + SRP). Recommendation junta os dois + `critical_gates`.

Exemplo válido: score `91`, viability baixa, recommendation `NAO_PARTICIPAR`, reason “concorrência alta + preço abaixo da faixa histórica”.

Alta aderência pode ser má economia. Nunca: `score > 80 = PARTICIPAR`.

### 4. Outcome no modelo desde o dia 1

`opportunity_outcome` agora; UI na Fase 5. Campos: `motivo_perda`, `motivo_nao_participacao`, `preco_ofertado`, `preco_vencedor`, `concorrente_vencedor`, `resultado`.

### 5. `critical_gate` (veto, não média)

Estados: `PASS` | `FAIL` | `UNKNOWN` | `NOT_APPLICABLE`.

Exemplos: impedimento legal, SICAF, certificação compulsória, capacidade técnica mínima.

Score 89 + gate `FAIL` → recommendation `NAO_PARTICIPAR`. Proibido diluir impedimento na média.

## Pipeline: análise gera fatos, não o score

```text
EDITAL + TR + ANEXOS
        ↓
extração
        ↓
facts / requirements / risks
        ↓
evidências
        ↓
comparação com perfil da empresa
        ↓
fatores do OpportunityScore
        ↓
score + confidence + critical_gates
        ↓
recommendation
```

## Regra UNKNOWN

Fator sem evidência: `UNKNOWN`, **sai da média**. Nunca `ausente = 0` nem `50`.

## OpportunityScore versionado

`#86` = `formula_version = 1`. Este PRD = `formula_version = 2` no mesmo motor.

- **Match V1:** objeto, itens, UF, valor, CNAE, CATMAT.
- **Match V2:** requisitos extraídos do grafo. Sem grafo → `UNKNOWN`.

### Catálogo de fatores v2 (sem pesos arbitrários agora)

Construir fatos confiáveis primeiro. Alvo, não fórmula fechada:

`PRODUCT_FIT` (nível **item**, não contratação) · `REGION_FIT` · `TICKET_FIT` · `TECHNICAL_FIT` · `HABILITATION_FIT` · `PRICE_FIT` · `COMPETITION_FIT` · `BUYER_RELATIONSHIP` (empresa × órgão) · `LOGISTICS_FIT` · `COMMERCIAL_ATTRACTIVENESS` (inclui `CONTRACTING_CERTAINTY` / SRP) · `COMPETITIVE_ADVANTAGE` (ME/EPP).

Preço: sugerido + faixa P25–P75 + anomalia (edital vs distribuição). Concorrentes: **histórico observado** separado de **inferência**. Nunca inventar nome.

## Perfil: dois domínios, não inflar `tenant_party`

`tenant_party` = identidade (CNPJ, razão).

- **Comercial** `company_interest` — CNAE, CATMAT/CATSER, produtos, UF, município, ticket
- **Capacidade** `company_capability` — tipo, valor, validade, evidência
- **Habilitação** `company_document` — `type`, `file`, `issued_at`, `expires_at`, `status` (certidão vencida é aceite)

## Grafo documental (core moat)

PostgreSQL, não graph DB. **Não é RAG.** Chunk responde pergunta; fato calcula decisão.

Saídas formais: `facts`, `requirements`, `risks`, `evidence`.

```text
document_fact
  fact_kind            FACT | REQUIREMENT | RISK
  fact_type, value_json, confidence
  source_page, source_anchor, extraction_method

fact_relation
  REQUIRES | APPLIES_TO | REFERENCES | SUPERSEDES | CONTRADICTS | DEPENDS_ON
```

Depende de #93 + #48. Sem dump nacional.

Golden: Pregão 224/2026 Passex `00394452000103-1-019732/2026` — itens, entrega Bento Gonçalves/RS, ME/EPP, SRP sem garantia de contratação (cláusula de ata), inexequibilidade &lt; 50%, disputa aberta 1%.

Fatos-exemplo deste golden: `DELIVERY_LOCATION`, `FREIGHT_INCLUDED`, `SRP` + `GuaranteedDemand=false`, `DISPUTE_PROFILE`, `ME_EPP_BENEFIT`, `INEXEQUIBILITY_THRESHOLD`.

## Superfície (ficha auditável)

`/contratacoes/:id` — sem módulo novo. “Analisar edital” é etapa do motor, não feature isolada de IA.

```text
ADERÊNCIA À OPORTUNIDADE          87/100
Confiança da análise                 82%

Produto 96 ✓   Habilitação 78 ⚠   Logística 83 ✓
Preço 61 ⚠     Concorrência 72 ⚠  Órgão 91 ✓

Critical gates: PASS
Recommendation: VALIDAR ANTES DE PARTICIPAR

⚠ Certificação técnica não confirmada → TR requisito 4.x
⚠ SRP sem garantia de contratação integral → cláusula 11.6

[ Ver análise completa ]  → clique no fator → âncora oficial + doc empresa
```

Saved search (estado, raio, período, valor, palavra-chave): feature simples, não módulo.

## Entidade `tenant_opportunity`

`tenant_id`, `contratacao_id`, `score`, `confidence`, `recommendation`, `pipeline_status`, `owner`, `outcome`.

## Aquisição pública (estacionada)

SEO só depois do Match V1 ter “combina com sua empresa?” verdadeiro.

## Norte (não escopo)

As seis frases do copiloto. Agente (Fase 6) só com empresa + documentos + requisitos + preços + pipeline + resultados. Agente = consulta estruturada, não “resuma este PDF”.

## Segurança de capturas

HAR com tokens não se versiona. Ver #91.
