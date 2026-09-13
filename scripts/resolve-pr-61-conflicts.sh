#!/bin/bash
# resolve-pr-61-conflicts.sh
# Automatiza resolução de conflitos no PR #61
# Uso: bash scripts/resolve-pr-61-conflicts.sh

set -e

echo "🔧 Iniciando resolução de conflitos do PR #61..."
echo ""

# 1. Fetch da main atualizada
echo "1️⃣  Fetchando origin/main..."
git fetch origin main
echo "✅ Fetch completo"
echo ""

# 2. Verificar status atual
echo "2️⃣  Status atual da branch:"
git status
echo ""

# 3. Tentar rebase com resolução automática para arquivos óbvios
echo "3️⃣  Iniciando rebase sobre origin/main..."
git rebase origin/main || true
echo ""

# 4. Listar arquivos em conflito
CONFLICTS=$(git diff --name-only --diff-filter=U)

if [ -z "$CONFLICTS" ]; then
    echo "✅ Nenhum conflito detectado! Branch está limpa."
    git rebase --abort 2>/dev/null || true
    exit 0
fi

echo "⚠️  Arquivos em conflito:"
echo "$CONFLICTS"
echo ""

# 5. Resolver .agents/mcp_config.json (conflito conhecido)
if echo "$CONFLICTS" | grep -q "\.agents/mcp_config\.json"; then
    echo "🔧 Resolvendo .agents/mcp_config.json..."
    
    # Usar versão da branch (remover chave vazia é o padrão)
    git checkout --theirs .agents/mcp_config.json
    
    # Garantir que a chave Linear está vazia (segurança)
    if [ -f ".agents/mcp_config.json" ]; then
        sed -i.bak 's/"LINEAR_API_KEY": "[^"]*"/"LINEAR_API_KEY": ""/' .agents/mcp_config.json
        rm -f .agents/mcp_config.json.bak
        echo "✅ .agents/mcp_config.json resolvido (chave vazia)"
        
        git add .agents/mcp_config.json
    fi
fi

# 6. Verificar se restam conflitos
REMAINING=$(git diff --name-only --diff-filter=U)

if [ -z "$REMAINING" ]; then
    echo ""
    echo "✅ Todos os conflitos foram resolvidos!"
    echo ""
    echo "📋 Resumo de mudanças:"
    git diff --cached --stat
    echo ""
    echo "⏭️  Continuando rebase..."
    git rebase --continue
    echo ""
    echo "✅ Rebase concluído com sucesso!"
else
    echo ""
    echo "⚠️  Conflitos restantes que precisam de resolução manual:"
    echo "$REMAINING"
    echo ""
    echo "🔍 Para continuar:"
    echo "   1. Resolva os arquivos acima manualmente"
    echo "   2. Execute: git add <arquivo>"
    echo "   3. Execute: git rebase --continue"
    exit 1
fi

echo ""
echo "🚀 Pronto para push!"
echo "   Execute: git push origin cursor/cursor-80a5 -f"
