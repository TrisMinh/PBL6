[CmdletBinding()]
param(
    [string]$EnvFile
)

$ErrorActionPreference = "Stop"

if ($EnvFile) {
    $resolved = (Resolve-Path -LiteralPath $EnvFile).Path
    foreach ($line in Get-Content -LiteralPath $resolved) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $name, $value = $line -split '=', 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
    }
}

$required = @(
    'POSTGRES_PASSWORD', 'RABBITMQ_PASSWORD', 'JWT_SIGNING_KEY', 'API_ALLOWED_HOSTS',
    'CUSTOMER_ORIGIN', 'BACKOFFICE_ORIGIN', 'SMTP_HOST', 'SMTP_FROM',
    'SMTP_USERNAME', 'SMTP_PASSWORD', 'VNPAY_CHECKOUT_URL', 'VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'
)
$secretNames = @('POSTGRES_PASSWORD', 'RABBITMQ_PASSWORD', 'JWT_SIGNING_KEY', 'SMTP_PASSWORD', 'VNPAY_HASH_SECRET')
$placeholder = '(?i)(replace|change.?me|local.?dev|example\.test|password$|secret$|guest$|postgres$)'

$errors = [System.Collections.Generic.List[string]]::new()
foreach ($name in $required) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        $errors.Add("Missing $name")
        continue
    }
    if ($value -match $placeholder) { $errors.Add("$name still contains a placeholder value") }
    if ($secretNames -contains $name -and $value.Length -lt 24) { $errors.Add("$name must contain at least 24 characters") }
    if ($name -eq 'RABBITMQ_PASSWORD' -and $value -notmatch '^[A-Za-z0-9._~-]+$') {
        $errors.Add('RABBITMQ_PASSWORD may contain only URL-safe A-Z a-z 0-9 . _ ~ - characters')
    }
}

foreach ($originName in @('CUSTOMER_ORIGIN', 'BACKOFFICE_ORIGIN')) {
    $origin = [Environment]::GetEnvironmentVariable($originName, 'Process')
    if ($origin -and $origin -notmatch '^https://') { $errors.Add("$originName must use HTTPS") }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

$infra = Join-Path $PSScriptRoot '../src/infra'
Push-Location $infra
try {
    & docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose production configuration is invalid.' }

    $rendered = (& docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.production.yml config) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Could not render production Compose configuration.' }
    if ($rendered -match '(?m)^\s{2}(mailpit|payment-simulator):\s*$') { throw 'Development-only services leaked into the production profile.' }
    if ($rendered -match '0\.0\.0\.0:\d+->') { throw 'A production port is bound to all host interfaces.' }
}
finally {
    Pop-Location
}

Write-Host 'Production configuration gate passed.' -ForegroundColor Green
