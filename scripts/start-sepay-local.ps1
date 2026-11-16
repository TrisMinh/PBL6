param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoRoot
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) { Copy-Item -LiteralPath (Join-Path $repoRoot '.env.example') -Destination $envFile }
$configText = [IO.File]::ReadAllText($envFile)
foreach ($name in @('SEPAY_MERCHANT_ID', 'SEPAY_SECRET_KEY')) {
    if (-not [regex]::IsMatch($configText, '(?m)^' + $name + '=\S.+$')) { throw "Fill $name in .env first." }
}
function Set-LocalValue([string]$name, [string]$value) {
    $pattern = '(?m)^' + [regex]::Escape($name) + '=.*$'
    if ([regex]::IsMatch($script:configText, $pattern)) {
        $script:configText = [regex]::Replace($script:configText, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $name + '=' + $value })
    } else {
        $script:configText = $script:configText.TrimEnd() + "`r`n$name=$value`r`n"
    }
    [IO.File]::WriteAllText($envFile, $script:configText, [Text.UTF8Encoding]::new($false))
}
if (-not [regex]::IsMatch($configText, '(?m)^SEPAY_IPN_SECRET_KEY=\S.+$')) {
    $secretBytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($secretBytes)
    $rng.Dispose()
    Set-LocalValue 'SEPAY_IPN_SECRET_KEY' ([Convert]::ToBase64String($secretBytes))
}
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before running this script.' }
$cloudflared = Join-Path $env:LOCALAPPDATA 'BLUE/tools/cloudflared.exe'
if (-not (Test-Path -LiteralPath $cloudflared)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $cloudflared) | Out-Null
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cloudflared
}
$runtimeFile = Join-Path $repoRoot '.env.sepay-runtime.json'
$previousUrl = ''
$runtime = $null
if (Test-Path -LiteralPath $runtimeFile) {
    $runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
    $previousUrl = $runtime.publicUrl
    $existingProcess = Get-Process -Id $runtime.processId -ErrorAction SilentlyContinue
    if (-not $existingProcess -or $existingProcess.Path -ne $cloudflared) { $runtime = $null }
}
if (-not $runtime) {
    $logPath = Join-Path $env:TEMP 'blue-sepay-tunnel.log'
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:5173', '--protocol', 'http2', '--no-autoupdate') -WindowStyle Hidden -RedirectStandardError $logPath -RedirectStandardOutput (Join-Path $env:TEMP 'blue-sepay-tunnel.stdout.log') -PassThru
    $publicUrl = ''
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-Path -LiteralPath $logPath) { $publicUrl = [regex]::Match([IO.File]::ReadAllText($logPath), 'https://[a-z0-9-]+\.trycloudflare\.com').Value }
        if ($publicUrl) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $publicUrl) { throw "Tunnel did not return a URL. See $logPath" }
    $runtime = [pscustomobject]@{ processId = $tunnel.Id; publicUrl = $publicUrl; logPath = $logPath }
    $runtime | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding utf8
}
Set-LocalValue 'CUSTOMER_PUBLIC_ORIGIN' $runtime.publicUrl
$composeArgs = @('compose', '--env-file', '.env', '-f', 'workspace/src/infra/docker-compose.yml', '-f', 'workspace/src/infra/docker-compose.apps.yml', '-f', 'workspace/src/infra/docker-compose.sepay.yml', '-f', 'workspace/src/infra/docker-compose.sepay-local.yml', 'up', '-d', '--wait')
if (-not $NoBuild) { $composeArgs += '--build' }
$composeArgs += @('identity', 'transport', 'booking', 'payment', 'notification', 'reporting', 'gateway', 'customer-web', 'operator-web', 'admin-web')
& docker @composeArgs
if ($LASTEXITCODE -ne 0) { throw 'The local platform did not start successfully.' }
& (Join-Path $PSScriptRoot 'restore-local-catalogue.ps1')
Write-Host "Customer: http://localhost:5173"
Write-Host "Operator: http://localhost:5174"
Write-Host "Admin: http://localhost:5175"
Write-Host "Public customer: $($runtime.publicUrl)"
Write-Host "SePay IPN URL: $($runtime.publicUrl)/integrations/payments/sepay/ipn"
if ($previousUrl -ne $runtime.publicUrl) { Write-Host 'New tunnel URL: update the IPN URL in SePay Sandbox. IPN auth must use the SEPAY_IPN_SECRET_KEY value from .env.' }
Write-Host 'Leave Docker Desktop and the tunnel running while testing. This is Sandbox, not real-money checkout.'
