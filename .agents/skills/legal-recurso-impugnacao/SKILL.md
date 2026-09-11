---
name: legal-recurso-impugnacao
description: >-
  Redige minuta de impugnação a edital ou recurso administrativo contra ato
  de licitação, a partir de um achado já classificado. Substitui
  "legal:legal-response" e "legal:triage-nda" do plugin "legal" — não há NDA
  neste domínio, há prazo processual e legitimidade de quem assina. Use
  quando o usuário pedir uma minuta de impugnação, recurso, contrarrazões,
  ou triagem de "isso ainda dá tempo de questionar?".
---

# Minuta de impugnação / recurso administrativo

## Antes de redigir

1. **Confirme o prazo.** Impugnação e recurso administrativo têm prazos
   processuais estritos e contados de formas diferentes conforme a
   modalidade e a lei aplicável ao certame (Lei 14.133/2021 para editais
   publicados sob o novo regime; Lei 8.666/93 ainda pode reger certames em
   transição). **Não assuma o prazo de memória** — leia a data-limite e a
   modalidade no próprio edital, ou confirme via `Jusratio`/consulta ao
   texto legal antes de afirmar "ainda dá tempo". Se o prazo já passou, diga
   isso claramente em vez de redigir uma peça que nascerá intempestiva.
2. **Confirme a legitimidade.** Impugnação de edital pode ser apresentada por
   qualquer interessado; recurso contra ato do certame (habilitação,
   julgamento) normalmente exige ser licitante no processo. Não presuma que
   o cliente tem legitimidade para o tipo de peça pedida sem checar isso.
3. **Reúna só o que está validado**: o achado de `legal-review-edital`
   (trecho literal + `source_url`), e, se aplicável, jurisprudência buscada
   via `Jusratio` (nunca citada de memória — número de acórdão/CNJ errado
   invalida a peça).

## Redigindo

- Estrutura mínima: qualificação do impugnante/recorrente, síntese do ato
  questionado, fundamentação (o trecho do edital + a lei/jurisprudência que
  ele viola), pedido.
- **Nunca preencha fornecedor, valor, marca ou base jurídica que não exista
  no edital ou no achado validado.** Onde faltar dado, escreva
  `[DADO NÃO ENCONTRADO]` — não complete com um exemplo plausível (Regra de
  Ouro 1). Isso vale mesmo para detalhes "óbvios" como o nome do órgão, se
  ele não estiver confirmado na fonte.
- **Todo trecho de fundamentação factual deve levar de volta ao `source_url`
  do achado** que a originou — quem revisar precisa conferir a fonte em um
  clique (Regra de Ouro 5).

## Antes de entregar

- A minuta sai com o aviso obrigatório: *"Documento gerado por assistência
  de IA. Revisão humana obrigatória."* — isso não é opcional nem
  configurável por skill.
- Não trate a minuta como pronta para protocolo. Ela é insumo para o
  advogado/pregoeiro do cliente revisar e assinar; a skill
  `legal-compliance-check` descreve o gate de revisão humana que precisa
  estar ativo na UI antes de qualquer exportação.
- Se o fluxo envolver assinatura eletrônica do documento final (ex.: um
  contrato administrativo já negociado, não a minuta de impugnação), isso é
  tratado em `legal-compliance-check`, não aqui.
