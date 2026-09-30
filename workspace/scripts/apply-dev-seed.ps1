$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $root
$infra = Join-Path $root "src\infra"
$password = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }
$seed = Join-Path $repo "docs\database\identity\011_dev_login_seed.sql"

if (-not (Test-Path $seed)) {
  throw "Missing $seed"
}

Push-Location $infra
try {
  docker compose cp $seed postgres:/tmp/011_dev_login_seed.sql
  docker compose exec -T postgres psql -U platform -d identity -v ON_ERROR_STOP=1 -f /tmp/011_dev_login_seed.sql
  docker compose exec -T postgres psql -U platform -d identity -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename, applied_at) VALUES ('011_dev_login_seed.sql', NOW()) ON CONFLICT (filename) DO NOTHING;"
}
finally {
  Pop-Location
}

Write-Host "Applied identity 011_dev_login_seed.sql"
