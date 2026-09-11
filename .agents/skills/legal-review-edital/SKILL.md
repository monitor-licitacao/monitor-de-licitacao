---
name: legal-review-edital
description: >-
  Audita edital, termo de referência ou especificação técnica de licitação em
  busca de direcionamento anticompetitivo, antes de registrar um achado
  (finding) no Monitor de Licitações. Substitui a skill genérica
  "legal:review-contract" do plugin "legal" — aqui não há contrato comercial
  bilateral, há um instrumento convocatório público que precisa preservar a
  ampla competitividade. Use quando o usuário pedir para revisar um edital,
  checar se uma exigência técnica é restritiva, analisar um TR, ou classificar
  um `restrictionLevel`.
---

# Revisão de edital / TR

## Objetivo

Ler a especificação técnica de um item (tipicamente NCM de cultura física e
atletismo, conforme foco atual do produto) e decidir se ela preserva a ampla
disputa ou se direciona a um fornecedor/marca específico.

## O que checar

1. **Marca sem "ou equivalente"** — exigência de marca, modelo ou fabricante
   específico sem a cláusula de equivalência técnica é o sinal mais forte de
   direcionamento.
2. **Especificação hiper-detalhada sem justificativa técnica** — tolerâncias,
   medidas ou certificações tão específicas que só um produto do mercado as
   atende, sem que o objeto exija essa precisão.
3. **Exigência de habilitação desproporcional** — atestado de capacidade
   técnica, faturamento mínimo ou certificação que extrapola o porte do
   objeto e restringe a disputa a poucos players.
4. **Julgamento não objetivo** — critérios de julgamento subjetivos onde
   caberia julgamento objetivo por menor preço/melhor técnica mensurável.
5. **Prazo exíguo** — prazo de resposta/entrega incompatível com o mercado,
   que na prática só quem já tem o produto pronto consegue cumprir.

## Como classificar

Use exatamente o vocabulário já modelado em `src/types.ts`:

- `restrictionLevel`: `CRITICO_DIRECIONAMENTO` (marca/fabricante nomeado ou
  combinação de exigências que só um fornecedor atende) → `ALTO_RESTRITIVO`
  (fortes indícios, mas sem prova cabal) → `MODERADO_RESTRITIVO` (exigência
  discutível, vale questionamento) → `CONFORME_AMPLA_DISPUTA` (sem indício).
- `severity`: `ALTA` / `MEDIA` / `BAIXA` — impacto esperado se o
  direcionamento não for corrigido a tempo (valor do certame, prazo até a
  sessão pública, reincidência do órgão).

## Regras não-negociáveis

- **Nunca infira uma exigência que não está no texto do edital.** Se o PDF
  está incompleto ou o OCR falhou em um trecho, registre
  `[DADO NÃO ENCONTRADO]` — não complete com o que "normalmente" um edital
  desse tipo teria (Regra de Ouro 1).
- **Todo achado carrega `source_url` e o timestamp da captura**, apontando
  para a página exata do edital onde a exigência aparece (Regra de Ouro 5).
  Sem isso, o achado não é publicável, mesmo que a análise pareça correta.
- **Eficiência de tokens** (Regra de Ouro 7): não jogue o PDF inteiro de 200
  páginas no modelo. Recorte antes as seções relevantes ("Objeto",
  "Especificação Técnica", "Habilitação", "Julgamento") e analise por
  trecho.
- Ao final, produza um resumo curto adequado para `FindingsView.tsx`: uma
  frase objetiva do problema, o trecho literal do edital que o evidencia, e
  a classificação — não um parecer jurídico completo (isso é
  `legal-recurso-impugnacao`).
