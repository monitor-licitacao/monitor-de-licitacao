---
name: legal-risk-assessment
description: >-
  Classifica severidade e decide escalonamento para achados (findings) já
  identificados em um edital — quando alertar o time jurídico/pregoeiro do
  cliente, quando é urgente por causa do prazo de impugnação, e quando pode
  esperar o próximo ciclo de curadoria. Adapta "legal:legal-risk-assessment"
  do plugin "legal" ao fluxo de FindingsView do Monitor de Licitações. Use
  quando o usuário pedir para priorizar achados, decidir o que é bloqueante,
  ou avaliar risco de um conjunto de editais monitorados.
---

# Avaliação de risco jurídico

## Entrada esperada

Um ou mais achados já classificados por `legal-review-edital`
(`restrictionLevel` + evidência) para um edital monitorado.

## Como decidir escalonamento

Siga a ordem de prioridade da Regra de Ouro 5 — bloqueadores jurídicos e de
segurança sempre na frente de qualquer coisa cosmética:

1. **`CRITICO_DIRECIONAMENTO` + prazo de impugnação/recurso ainda aberto** →
   escalar imediatamente. É o único cenário em que uma ação corretiva ainda
   é possível antes da sessão pública.
2. **`CRITICO_DIRECIONAMENTO` com prazo vencido** → escalar mesmo assim, mas
   como registro para eventual representação ao órgão de controle (TCU/
   Tribunal de Contas estadual) ou base para editais futuros do mesmo órgão,
   não como impugnação tempestiva.
3. **`ALTO_RESTRITIVO`** → escalar se o valor estimado do certame for
   relevante ou se o órgão for reincidente (verifique o histórico de achados
   anteriores do mesmo órgão antes de decidir "aguardar").
4. **`MODERADO_RESTRITIVO`** e **`CONFORME_AMPLA_DISPUTA`** → registrar sem
   escalar; entram no relatório executivo do ciclo normal.

## O que nunca fazer

- Não "arredonde para cima" a severidade para forçar uma escalada — e não
  arredonde para baixo para reduzir ruído. A classificação decide ações
  reais de terceiros (o cliente pode protocolar impugnação com base nisso).
- Não decida escalonamento sem saber o prazo real da sessão pública/data
  limite de impugnação do edital em questão — busque essa data no próprio
  edital, nunca assuma um prazo padrão de memória.
- Se dois achados do mesmo edital têm evidências conflitantes, não descarte
  silenciosamente uma delas: aponte o conflito no relatório e marque para
  revisão humana.

## Saída

Um resumo priorizado (mais crítico primeiro) com: achado, `restrictionLevel`,
`severity`, prazo relevante, e recomendação de ação (impugnar agora, incluir
no relatório, monitorar). Se a ação recomendada for impugnar ou recorrer,
aponte para a skill `legal-recurso-impugnacao` em vez de redigir a minuta
aqui.
