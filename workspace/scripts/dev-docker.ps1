$ErrorActionPreference = "Stop"
$infra = Join-Path (Split-Path -Parent $PSScriptRoot) "src\infra"
Push-Location $infra
try {
  docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build --wait
  if ($LASTEXITCODE -ne 0) {
    throw "Docker stack did not become healthy. Check docker compose ps and logs in $infra."
  }
}
finally {
  Pop-Location
}

Write-Host "BLUE web (customer/operator/admin) http://localhost:5173"
Write-Host "Legacy backoffice http://localhost:5174"
Write-Host "Gateway   http://localhost:5080"
Write-Host "Mailpit   http://localhost:8025"
Write-Host "VNPay sim http://localhost:8099"
Write-Host "Seed customer seed.customer@example.test / CustomerPass1"
Write-Host "Seed operator operator.seed@example.test / OperatorPass1"
