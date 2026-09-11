---
name: legal
description: >-
  Visão geral do domínio jurídico do Monitor de Licitações — customização do
  plugin de mercado "legal" (pensado para jurídico interno genérico: revisão
  de contrato, triagem de NDA, vendor-check, etc.) para o nosso negócio real:
  monitoramento de editais públicos brasileiros e detecção de direcionamento
  anticompetitivo. Comece aqui para rotear para a skill certa. Use quando
  "edital", "licitação", "pregão", "direcionamento", "impugnação", "recurso
  administrativo", "Lei 14.133", "achado jurídico"/"finding", "restrictionLevel",
  "fornecedor inidôneo", "CEIS", "CNEP", "minuta", ou o plugin "legal" (e
  qualquer uma de suas skills originais: review-contract, compliance-check,
  legal-risk-assessment, legal-response, triage-nda, vendor-check, brief,
  meeting-briefing, signature-request) forem mencionados.
---

# Legal — Monitor de Licitações

O plugin de mercado "legal" foi desenhado para jurídico interno genérico
(SaaS B2B: NDA, contrato de fornecedor, brief de reunião). Nosso negócio é
diferente: monitoramos **editais de licitação pública brasileira**
(ComprasNet, Sistema S, Compras RJ, PNCP) e existimos para detectar
**direcionamento** — quando uma especificação técnica restringe
artificialmente a competição a um fornecedor/marca específica, violando o
princípio da ampla competitividade (Lei 14.133/2021 e, residualmente, Lei
8.666/93). Isso já está modelado no código: `src/types.ts` define
`restrictionLevel` (`CRITICO_DIRECIONAMENTO` | `ALTO_RESTRITIVO` |
`MODERADO_RESTRITIVO` | `CONFORME_AMPLA_DISPUTA`) e `severity` (`ALTA` |
`MEDIA` | `BAIXA`) para os achados exibidos em `FindingsView.tsx`.

Toda skill jurídica aqui herda as **Regras de Ouro** do projeto
(`GOLDEN_RULES.md` / `GEMINI.md`), que não são opcionais:

1. **Zero alucinação em minutas e documentos legais** — nunca inventar
   fornecedor, valor, marca ou base legal que não exista no edital ou no
   banco validado. Falta de dado é `[DADO NÃO ENCONTRADO]`, nunca um
   preenchimento plausível.
2. **Revisão humana obrigatória** antes de qualquer exportação/cópia de
   minuta gerada por IA.
3. **Proveniência** — todo achado carrega `source_url` + timestamp da
   captura; nunca afirme algo sobre um edital sem apontar de onde veio.
4. **Sem simulação silenciosa** — se uma integração (assinatura, CEIS,
   notificação) não está realmente conectada, isso deve ficar visível na UI
   (`[BETA/MOCK]`), nunca implícito.

## Como rotear

| Preciso de… | Skill | Substitui, no plugin original |
| --- | --- | --- |
| Auditar um edital/TR para achar direcionamento antes de publicar um achado | `legal-review-edital` | `legal:review-contract` |
| Classificar severidade/`restrictionLevel` e decidir escalonamento | `legal-risk-assessment` | `legal:legal-risk-assessment` |
| Redigir impugnação ao edital ou recurso administrativo | `legal-recurso-impugnacao` | `legal:legal-response` + `legal:triage-nda` |
| Checar se um fornecedor/marca é idôneo antes de citá-lo como alternativa | `legal-vendor-check` | `legal:vendor-check` |
| Checklist de compliance antes de shippar uma feature jurídica; brief de pregão; assinatura de contrato administrativo | `legal-compliance-check` | `legal:compliance-check` + `legal:brief` + `legal:meeting-briefing` + `legal:signature-request` |

## Pesquisa jurisprudencial

Quando uma minuta ou avaliação de risco precisa de fundamentação (acórdão do
TCU sobre direcionamento, jurisprudência do STJ/STF sobre julgamento
objetivo, súmulas), use o MCP **Jusratio** em vez de citar de memória —
número de acórdão, relator e data errados são exatamente o tipo de
alucinação que a Regra de Ouro 1 proíbe. Apresente o resultado como um
advogado apresentaria (tese em prosa, fonte no formato Tribunal/Relator/
Data/CNJ, link "Inteiro teor"), nunca expondo a mecânica da busca.

## Integrações do plugin original

O plugin de mercado traz `atlassian`, `box`, `docusign`, `egnyte`, `gmail`,
`google calendar`, `slack`. Para nós, as relevantes de fato são `docusign`
(assinatura de contratos administrativos/termos de aceite de revisão
humana) e `gmail`/`slack`/`google calendar` (notificação de prazos de
impugnação e recurso, briefing de sessão pública). `atlassian`, `box` e
`egnyte` não têm uso natural neste domínio — não assuma que estão
conectados nem finja que uma dessas integrações existe (Regra de Ouro 2).
