# Setup GitHub Project Kanban for Monitor de Licitações
# Requires: gh auth refresh -h github.com -s project,read:project,write:project

$ErrorActionPreference = "Stop"
$Owner = "monitor-licitacao"
$Repo = "monitor-de-licitacao"
$ProjectTitle = "Monitor de Licitações"

Write-Host "==> Verificando escopo 'project' do gh..."
$status = gh auth status 2>&1 | Out-String
if ($status -notmatch "project") {
  Write-Host "Token sem escopo project. Execute:" -ForegroundColor Yellow
  Write-Host "  gh auth refresh -h github.com -s project,read:project,write:project"
  exit 1
}

Write-Host "==> Criando ou localizando Project..."
$existing = gh project list --owner $Owner --format json | ConvertFrom-Json
$project = $existing.projects | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1

if (-not $project) {
  $created = gh project create --owner $Owner --title $ProjectTitle --format json | ConvertFrom-Json
  $projectNumber = $created.number
  Write-Host "Project criado: #$projectNumber"
} else {
  $projectNumber = $project.number
  Write-Host "Project existente: #$projectNumber"
}

Write-Host "==> Vinculando repo..."
gh project link $projectNumber --owner $Owner --repo "$Owner/$Repo" 2>$null

Write-Host "==> Configurando campo Status (6 colunas)..."
$fields = gh project field-list $projectNumber --owner $Owner --format json | ConvertFrom-Json
$statusField = $fields.fields | Where-Object { $_.name -eq "Status" } | Select-Object -First 1

if (-not $statusField) {
  gh project field-create $projectNumber --owner $Owner `
    --name "Status" --data-type SINGLE_SELECT `
    --single-select-options "Backlog,Ready,In Progress,In Review,Blocked,Done"
} else {
  Write-Host "Campo Status já existe (id: $($statusField.id)). Ajuste manual se precisar renomear opções."
}

function Add-ProjectItem {
  param([string]$Url, [string]$Status)
  gh project item-add $projectNumber --owner $Owner --url $Url 2>$null | Out-Null
  if ($Status) {
    $itemId = (gh project item-list $projectNumber --owner $Owner --format json --limit 200 | ConvertFrom-Json).items |
      Where-Object { $_.content.url -eq $Url } | Select-Object -First 1 -ExpandProperty id
    if ($itemId -and $statusField) {
      gh project item-edit --id $itemId --project-id $projectNumber --field-id $statusField.id --single-select-option $Status 2>$null
    }
  }
}

Write-Host "==> Enfileirando issues e PRs abertas..."
$base = "https://github.com/$Owner/$Repo"
Add-ProjectItem "$base/issues/48" "Backlog"
Add-ProjectItem "$base/issues/60" "In Progress"
Add-ProjectItem "$base/pull/61" "In Review"
Add-ProjectItem "$base/pull/63" "In Review"
Add-ProjectItem "$base/pull/68" "In Review"
Add-ProjectItem "$base/pull/71" "In Review"

Write-Host "==> Concluído. Abra: gh project view $projectNumber --owner $Owner --web"
