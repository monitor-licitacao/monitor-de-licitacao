#!/usr/bin/env bash
# Setup GitHub Project Kanban for Monitor de Licitações
# Requires: gh auth refresh -h github.com -s project,read:project

set -euo pipefail

OWNER="monitor-licitacao"
REPO="monitor-de-licitacao"
PROJECT_TITLE="Monitor de Licitações"

echo "==> Verificando escopo 'project' do gh..."
if ! gh auth status 2>&1 | grep -q 'project'; then
  echo "Token sem escopo project. Execute:"
  echo "  gh auth refresh -h github.com -s project,read:project"
  exit 1
fi

echo "==> Criando ou localizando Project..."
PROJECT_NUMBER="$(gh project list --owner "$OWNER" --format json \
  | jq -r --arg t "$PROJECT_TITLE" '.projects[] | select(.title == $t) | .number' | head -n1)"

if [[ -z "$PROJECT_NUMBER" ]]; then
  PROJECT_NUMBER="$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json | jq -r '.number')"
  echo "Project criado: #$PROJECT_NUMBER"
else
  echo "Project existente: #$PROJECT_NUMBER"
fi

echo "==> Vinculando repo..."
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$OWNER/$REPO" 2>/dev/null || true

echo "==> Configurando campo Status (6 colunas)..."
if ! gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | jq -e '.fields[] | select(.name == "Status")' >/dev/null; then
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" \
    --name "Status" --data-type SINGLE_SELECT \
    --single-select-options "Backlog,Ready,In Progress,In Review,Blocked,Done"
else
  echo "Campo Status já existe. Ajuste manual se precisar renomear opções."
fi

add_item() {
  local url="$1"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" >/dev/null 2>&1 || true
}

echo "==> Enfileirando issues e PRs abertas..."
while IFS= read -r url; do
  [ -n "$url" ] || continue
  add_item "$url"
  echo "  + $url"
done < <(gh issue list --repo "$OWNER/$REPO" --state open --limit 100 --json url --jq '.[].url'; gh pr list --repo "$OWNER/$REPO" --state open --limit 100 --json url --jq '.[].url')

echo "==> Concluído. Abra: gh project view $PROJECT_NUMBER --owner $OWNER --web"
