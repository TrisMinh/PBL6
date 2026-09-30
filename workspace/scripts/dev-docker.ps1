$ErrorActionPreference = "Stop"
$infra = Join-Path (Split-Path -Parent $PSScriptRoot) "src\infra"
Push-Location $infra
try {
  docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
}
finally {
  Pop-Location
}

Write-Host "Customer  http://localhost:5173"
Write-Host "Backoffice http://localhost:5174"
Write-Host "Gateway   http://localhost:5080"
Write-Host "Mailpit   http://localhost:8025"
Write-Host "VNPay sim http://localhost:8099"
Write-Host "Seed customer seed.customer@example.test / CustomerPass1"
Write-Host "Seed operator operator.seed@example.test / OperatorPass1"
