param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
# Start the original portal interfaces with the persistent application services.
$composeArgs = @('compose', '--env-file', '.env', '-f', 'workspace/src/infra/docker-compose.yml', '-f', 'workspace/src/infra/docker-compose.apps.yml', '-f', 'workspace/src/infra/docker-compose.sepay-local.yml', 'up', '-d', '--wait')
if (-not $NoBuild) { $composeArgs += '--build' }
$composeArgs += @('customer-web', 'operator-web', 'admin-web', 'mailpit')
& docker @composeArgs
if ($LASTEXITCODE -ne 0) { throw 'Frontend startup failed.' }

# Refresh the sandbox callback when the portal is configured to use a Quick Tunnel.
$localConfig = [IO.File]::ReadAllText((Join-Path (Get-Location).Path '.env'))
if ($env:SEPAY_ENVIRONMENT -ne 'production' -and
    $localConfig -notmatch '(?m)^\s*SEPAY_ENVIRONMENT\s*=\s*["'']?production\b' -and
    $localConfig -match '(?m)^\s*CUSTOMER_PUBLIC_ORIGIN\s*=\s*["'']?https://[a-z0-9-]+\.trycloudflare\.com["'']?\s*$') {
    & (Join-Path $PSScriptRoot 'start-sepay-local.ps1') -RefreshTunnelOnly
}

Write-Host 'Customer: http://localhost:5173'
Write-Host 'Operator: http://localhost:5174'
Write-Host 'Admin: http://localhost:5175'
Write-Host 'Verification email (local development): http://localhost:8025'
