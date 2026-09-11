---
name: legal-vendor-check
description: >-
  Verifica se um fornecedor/marca é idôneo antes de ser citado como
  alternativa "equivalente" em um achado ou minuta, ou antes de recomendar
  que um cliente participe de um certame com determinado fornecedor.
  Adapta "legal:vendor-check" do plugin "legal" (pensado para due diligence
  de fornecedor de SaaS) ao contexto de sanções administrativas em
  licitações públicas brasileiras. Use quando o usuário pedir para checar um
  fornecedor, uma marca "equivalente", ou se uma empresa está apta a
  licitar.
---

# Checagem de idoneidade de fornecedor/licitante

## Quando isso é necessário

- Ao sugerir, em um achado de direcionamento, que existe marca/fornecedor
  "equivalente" ao exigido no edital — a sugestão só é válida se esse
  fornecedor existir de verdade no mercado e não estiver sancionado.
- Ao avaliar se um cliente pode participar de um certame específico.

## O que checar

Cadastros públicos de sanções administrativas relevantes no Brasil:

- **CEIS** (Cadastro Nacional de Empresas Inidôneas e Suspensas) — CGU.
- **CNEP** (Cadastro Nacional de Empresas Punidas) — CGU, Lei Anticorrupção.
- **Licitantes inidôneos do TCU**.
- Situação de regularidade fiscal básica (CNPJ ativo na Receita Federal)
  quando o objetivo for confirmar que o fornecedor "equivalente" citado
  existe de fato, não apenas que ele é elegível para licitar.

## Regras não-negociáveis

- **A consulta precisa ser real.** Se a integração com esses cadastros não
  está de fato conectada nesta sessão/ambiente, isso precisa ficar visível
  para quem lê o resultado (`[BETA/MOCK]` ou equivalente) — nunca apresente
  um "parece estar tudo certo" como se fosse uma consulta ao vivo que não
  aconteceu (Regra de Ouro 2).
- **Nunca invente o nome de uma marca "equivalente"** só para preencher a
  lacuna de uma sugestão de alternativa técnica. Se você não tem uma marca
  real e verificada para sugerir, diga que não encontrou uma alternativa
  validada — inventar uma marca famosa "só para exemplificar" é
  exatamente o risco que a Regra de Ouro 1 proíbe, porque essa sugestão pode
  ir parar direto numa minuta de impugnação.
- Registre a data da consulta junto do resultado — situação de idoneidade
  muda com o tempo, e um resultado "limpo" de meses atrás não vale como
  checagem atual.
