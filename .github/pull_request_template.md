## Resumo
<!-- O que mudou e por quê? -->

## Rastreabilidade
- **Issue**: Closes #
- **Notion**:

## Evidências
- [ ] `npm run lint` passou localmente
- [ ] `npm test` passou localmente

```
# Cole aqui a saída resumida dos testes, se relevante
```

## Checklist (Regras de Ouro)
- [ ] **Zero Alucinação**: sem dados jurídicos/comerciais inventados; fallback `[DADO AUSENTE]` quando faltar dado
- [ ] **Disclaimer de IA**: minutas/documentos legais com *"Documento gerado por assistência de IA. Revisão humana obrigatória."*
- [ ] **Segurança**: rotas `/api/*` autenticadas; segredos fora do código; rate limit em rotas de IA
- [ ] **Resiliência**: integrações externas com fallback e `try/catch` defensivo
- [ ] **Auditoria**: alterações de estado persistidas com trilha (`updated_at`, `user_id`)
- [ ] **Higiene de Git**: diff enxuto (< 300–400 linhas); commits semânticos

## Pendências fora do escopo
- N/A
