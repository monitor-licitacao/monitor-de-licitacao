#!/bin/bash

echo "🔍 Iniciando Check-up de Regras de Ouro..."

# 1. Verificar se há arquivos não trackeados ou modificados (ignorando se SKIP_DIRTY_CHECK for true)
if [[ -z "$SKIP_DIRTY_CHECK" ]] && [[ -n "$(git status -s)" ]]; then
  echo "❌ ERRO: Você tem modificações não commitadas (Worktree Suja)."
  git status -s
  exit 1
fi

# 2. Verificar se existem 'console.log' esquecidos
if grep -r "console.log" ./src --exclude-dir=node_modules; then
  echo "⚠️ AVISO: Existem console.log no código. Remova-os antes do PR."
  # Não sai com erro, mas avisa.
fi

# 3. Verificar chaves de API expostas (Regra 3)
if grep -rE "(GEMINI_API_KEY|MONITOR_API_KEY|CERT_ENCRYPTION_KEY)\s*=\s*['\"][A-Za-z0-9_-]{8,}['\"]" ./src ./server; then
  echo "❌ CRÍTICO: Chave/segredo hardcoded detectado no código fonte!"
  exit 1
fi

# 3b. MONITOR_API_KEY nunca no bundle do browser (Regra 3).
# Amplitude VITE_AMPLITUDE_API_KEY é client-side por design e não entra nesta regra.
if grep -rE "VITE_MONITOR_API_KEY" ./src ./.env.example 2>/dev/null; then
  echo "❌ CRÍTICO: VITE_MONITOR_API_KEY detectado (iria para o client bundle — Regra 3)."
  exit 1
fi

if grep -rn "monitor-dev-key" ./src ./server ./.env.example 2>/dev/null; then
  echo "❌ CRÍTICO: Fallback público 'monitor-dev-key' ainda presente."
  exit 1
fi

# 3c. .env.example é trackeado (!.env.example) — nunca pode conter chave real.
# Placeholders seguros: YOUR_*_HERE / CHANGE_ME_IN_PRODUCTION.
if grep -E '^[[:space:]]*XAI_API_KEY=.*(xai-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,})' ./.env.example 2>/dev/null; then
  echo "❌ CRÍTICO: XAI_API_KEY real detectada em .env.example (Regra 3). Use YOUR_XAI_API_KEY_HERE."
  exit 1
fi
if grep -E '^[[:space:]]*(GEMINI_API_KEY|NOTION_TOKEN|OLLAMA_API_KEY|AMPLITUDE_AI_API_KEY|JWT_SECRET|MONITOR_API_KEY|CERT_ENCRYPTION_KEY)=' ./.env.example 2>/dev/null \
  | grep -vE '(YOUR_|CHANGE_ME|placeholder|HERE|example)' ; then
  echo "❌ CRÍTICO: Segredo com valor não-placeholder em .env.example (Regra 3)."
  exit 1
fi

# 4. Build real (o commit anterior deste projeto já foi quebrado por um
# build que ninguém rodou antes de comitar - Regra de Ouro: nunca de novo).
echo "🔨 [4/4] Rodando build de produção (vite + esbuild)..."
if ! npm run build; then
  echo "❌ ERRO: Build falhou. Corrija antes de comitar/dar push."
  exit 1
fi

echo "✅ Tudo limpo! Pronto para o Push/PR."
exit 0
