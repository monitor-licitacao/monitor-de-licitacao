---
name: legal-compliance-check
description: >-
  Checklist de compliance para qualquer feature ou PR que toque em conteúdo
  jurídico do Monitor de Licitações (achados, minutas, assinatura,
  notificação de prazo), e apoio a fluxos operacionais menores do plugin
  "legal" (briefing de sessão pública, assinatura de contrato
  administrativo). Consolida "legal:compliance-check", "legal:brief",
  "legal:meeting-briefing" e "legal:signature-request" do plugin original.
  Use antes de shippar uma feature jurídica, ou ao preparar um briefing de
  pregão/sessão pública, ou ao lidar com assinatura de contrato
  administrativo.
---

# Compliance jurídico e fluxos operacionais

## Checklist antes de shippar uma feature jurídica

Baseado em `GOLDEN_RULES.md` / `GEMINI.md` — trate cada item como bloqueador,
não como sugestão (Regra de Ouro 5, item 1):

- [ ] Toda minuta gerada por IA exibe o aviso: *"Documento gerado por
      assistência de IA. Revisão humana obrigatória."*
- [ ] O botão de exportar/copiar (ex.: "Baixar PDF") só habilita depois do
      checkbox de revisão humana marcado.
- [ ] Todo achado carrega `source_url` + timestamp da captura, com um ícone
      "Ver no Edital Original" acessível na UI ao lado do resumo de IA.
- [ ] Nenhum campo de fornecedor/valor/marca/base legal é preenchido por
      fallback de IA sem dado real — o fallback correto é
      `[DADO NÃO ENCONTRADO]`.
- [ ] Toda integração externa (assinatura, CEIS/CNEP, notificação) que não
      está de fato conectada é sinalizada na UI (`[BETA/MOCK]` ou
      `[Em Desenvolvimento]`), nunca apresentada como ativa.
- [ ] Endpoints que processam dado sensível ou chamam a Gemini API têm
      autenticação e rate limiting.
- [ ] Alteração manual em campo de edital grava `updated_at` e `user_id`
      (trilha de auditoria).

## Briefing de sessão pública / reunião

Ao preparar um briefing (para o time interno ou para o cliente antes de um
pregão): liste, por edital, os achados já classificados
(`restrictionLevel`/`severity`), o prazo relevante mais próximo (impugnação,
recurso, sessão), e a ação recomendada — reaproveite a saída de
`legal-risk-assessment` em vez de reclassificar do zero.

## Assinatura de contrato administrativo (DocuSign)

Isso só se aplica à fase final — contrato já negociado/homologado, não à
minuta de impugnação (que não é assinada eletronicamente neste fluxo).
Antes de enviar para assinatura:

- Confirme que o texto do contrato bate com o que foi de fato homologado no
  certame — não gere um contrato "modelo" preenchido por IA sem checar
  contra o edital/ata de homologação real.
- A integração DocuSign precisa estar realmente conectada; se não estiver,
  não simule o envio (Regra de Ouro 2) — informe que o passo é manual por
  enquanto.
