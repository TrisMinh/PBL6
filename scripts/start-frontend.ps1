param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
# The original frontend is standalone. Do not include the live SePay/API override.
$composeArgs = @('compose', '--env-file', '.env', '-f', 'workspace/src/infra/docker-compose.yml', '-f', 'workspace/src/infra/docker-compose.apps.yml', '-f', 'workspace/src/infra/docker-compose.sepay-local.yml', 'up', '-d', '--no-deps', '--wait')
if (-not $NoBuild) { $composeArgs += '--build' }
$composeArgs += @('customer-web', 'operator-web', 'admin-web')
& docker @composeArgs
if ($LASTEXITCODE -ne 0) { throw 'Frontend startup failed.' }
Write-Host 'Customer: http://localhost:5173'
Write-Host 'Operator: http://localhost:5174'
Write-Host 'Admin: http://localhost:5175'
Write-Host 'Original standalone UI. No live API integration is enabled.'
