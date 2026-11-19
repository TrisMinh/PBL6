param([switch]$NoBuild, [switch]$RefreshTunnelOnly)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoRoot
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) { Copy-Item -LiteralPath (Join-Path $repoRoot '.env.example') -Destination $envFile }
$configText = [IO.File]::ReadAllText($envFile)
if ($env:SEPAY_ENVIRONMENT -eq 'production' -or $configText -match '(?m)^\s*SEPAY_ENVIRONMENT\s*=\s*["'']?production\b') {
    throw 'This script is for SePay Sandbox only.'
}
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
function Test-CustomerTunnel([string]$url, [int]$attempts = 1) {
    if ($url -notmatch '^https://[a-z0-9-]+\.trycloudflare\.com$') { return $false }
    for ($attempt = 1; $attempt -le $attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "$url/healthz" -UseBasicParsing -TimeoutSec 4 -MaximumRedirection 0
            if ($response.StatusCode -eq 200 -and $response.Content.Trim() -eq 'ok') { return $true }
        } catch {
            Write-Verbose "Waiting for Customer tunnel: $($_.Exception.Message)"
        }
        if ($attempt -lt $attempts) { Start-Sleep -Seconds 2 }
    }
    return $false
}
$localCustomerRunning = $false
try {
    $localCustomerRunning = (Invoke-WebRequest -Uri 'http://127.0.0.1:5173/healthz' -UseBasicParsing -TimeoutSec 4).Content.Trim() -eq 'ok'
} catch {
    if ($RefreshTunnelOnly) { throw 'The local Customer web is unreachable on port 5173.' }
}
if ($RefreshTunnelOnly -and -not $localCustomerRunning) {
    throw 'Port 5173 is not serving the Customer web health endpoint.'
}
$previousUrl = [regex]::Match($configText, '(?m)^CUSTOMER_PUBLIC_ORIGIN=([^\r\n]*)').Groups[1].Value.Trim()
$runtime = $null
if (Test-Path -LiteralPath $runtimeFile) {
    try {
        $saved = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
        if ($saved.processId) {
            $existingProcess = Get-Process -Id $saved.processId -ErrorAction SilentlyContinue
            if ($existingProcess -and $existingProcess.Path -eq $cloudflared) {
                if (-not $localCustomerRunning -or (Test-CustomerTunnel $saved.publicUrl 5)) {
                    $runtime = $saved
                }
            }
        }
    } catch {
        Write-Warning 'Could not reuse the saved SePay tunnel.'
    }
}
if (-not $runtime) {
    $logName = 'blue-sepay-tunnel-' + [Guid]::NewGuid().ToString('N')
    $logPath = Join-Path $env:TEMP "$logName.log"
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:5173', '--protocol', 'http2', '--no-autoupdate') -WindowStyle Hidden -RedirectStandardError $logPath -RedirectStandardOutput (Join-Path $env:TEMP "$logName.stdout.log") -PassThru
    $publicUrl = ''
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-Path -LiteralPath $logPath) {
            $logText = Get-Content -LiteralPath $logPath -Raw
            if ($logText) { $publicUrl = [regex]::Match($logText, 'https://[a-z0-9-]+\.trycloudflare\.com').Value }
        }
        if ($publicUrl) { break }
        if ($tunnel.HasExited) { throw "Tunnel process exited. See $logPath" }
        Start-Sleep -Seconds 1
    }
    if (-not $publicUrl) {
        if (-not $tunnel.HasExited) { Stop-Process -InputObject $tunnel }
        throw "Tunnel did not return a URL. See $logPath"
    }
    $runtime = [pscustomobject]@{ processId = $tunnel.Id; publicUrl = $publicUrl; logPath = $logPath }
    $runtime | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding utf8
}
function Wait-CustomerTunnel {
    if (-not (Test-CustomerTunnel $runtime.publicUrl 24)) {
        throw "SePay tunnel is unreachable. See $($runtime.logPath)"
    }
}
if ($localCustomerRunning) { Wait-CustomerTunnel }
Set-LocalValue 'CUSTOMER_PUBLIC_ORIGIN' $runtime.publicUrl
$composeArgs = @('compose', '--env-file', '.env', '-f', 'workspace/src/infra/docker-compose.yml', '-f', 'workspace/src/infra/docker-compose.apps.yml')
if ($RefreshTunnelOnly) {
    $composeArgs += @('up', '-d', '--wait', '--no-deps', '--no-build', 'payment', 'payment-2')
} else {
    $composeArgs += @('-f', 'workspace/src/infra/docker-compose.sepay-local.yml', 'up', '-d', '--wait')
    if (-not $NoBuild) { $composeArgs += '--build' }
    $composeArgs += @('identity', 'transport', 'booking', 'payment', 'payment-2', 'notification', 'reporting', 'gateway', 'customer-web', 'operator-web', 'admin-web')
}
& docker @composeArgs
if ($LASTEXITCODE -ne 0) { throw 'The local platform did not start successfully.' }
if (-not $localCustomerRunning) { Wait-CustomerTunnel }
Write-Host "Customer: http://localhost:5173"
if (-not $RefreshTunnelOnly) {
    Write-Host "Operator: http://localhost:5174"
    Write-Host "Admin: http://localhost:5175"
}
Write-Host "Public customer: $($runtime.publicUrl)"
Write-Host "SePay IPN URL: $($runtime.publicUrl)/integrations/payments/sepay/ipn"
if ($previousUrl -ne $runtime.publicUrl) { Write-Host 'New tunnel URL: update the IPN URL in SePay Sandbox. IPN auth must use the SEPAY_IPN_SECRET_KEY value from .env.' }
Write-Host 'Leave Docker Desktop and the tunnel running while testing. This is Sandbox, not real-money checkout.'
