[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Invoke-WingetInstall {
    param([Parameter(Mandatory)][string]$PackageId)

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget is not installed. Install App Installer from Microsoft Store, then rerun this script."
    }

    Write-Host "Installing $PackageId..."
    & winget install --exact --id $PackageId --source winget --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget failed to install $PackageId (exit code $LASTEXITCODE)."
    }
}

function Test-TcpPortInUse {
    param([Parameter(Mandatory)][int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
    }

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $false
    }
    catch {
        return $true
    }
    finally {
        if ($listener) { $listener.Stop() }
    }
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$infra = Join-Path $workspaceRoot 'src\infra'
$composeBase = Join-Path $infra 'docker-compose.yml'
$composeApps = Join-Path $infra 'docker-compose.apps.yml'

foreach ($required in @($composeBase, $composeApps, (Join-Path $infra 'postgres\bootstrap.sh'))) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Required project file not found: $required" }
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCommand) {
    Invoke-WingetInstall -PackageId 'Docker.DockerDesktop'
    $dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
    if (Test-Path (Join-Path $dockerBin 'docker.exe')) { $env:Path = "$dockerBin;$env:Path" }
    $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
}
if (-not $dockerCommand) { throw 'Docker CLI was not found after installing Docker Desktop. Restart PowerShell and rerun this script.' }

$dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $dockerDesktop) {
        Write-Host 'Starting Docker Desktop...'
        Start-Process -FilePath $dockerDesktop
    }
}

$dockerReady = $false
for ($attempt = 0; $attempt -lt 120; $attempt++) {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $dockerReady) { throw 'Docker Engine did not become ready. Open Docker Desktop, wait for it to finish starting, then rerun this script.' }

$existingVolume = docker volume ls --quiet --filter 'name=pbl6-local_postgres-data'
if ($existingVolume) {
    throw "A pbl6-local PostgreSQL volume already exists. This setup script is for a fresh database and will not overwrite existing data. Existing volume: $existingVolume"
}

$postgresHostPort = 5432
while (Test-TcpPortInUse -Port $postgresHostPort) {
    $postgresHostPort++
    if ($postgresHostPort -gt 5499) { throw 'Could not find a free local PostgreSQL port between 5432 and 5499.' }
}
$env:POSTGRES_HOST_PORT = [string]$postgresHostPort
$pgAdminHostPort = 5050
while (Test-TcpPortInUse -Port $pgAdminHostPort) {
    $pgAdminHostPort++
    if ($pgAdminHostPort -gt 5099) { throw 'Could not find a free local pgAdmin port between 5050 and 5099.' }
}
$env:PGADMIN_HOST_PORT = [string]$pgAdminHostPort
$infraEnv = Join-Path $infra '.env'
if (Test-Path -LiteralPath $infraEnv) {
    $infraEnvLines = @(Get-Content -LiteralPath $infraEnv)
    $matchedHostPort = $false
    for ($index = 0; $index -lt $infraEnvLines.Count; $index++) {
        if ($infraEnvLines[$index] -match '^\s*POSTGRES_HOST_PORT\s*=') {
            $infraEnvLines[$index] = "POSTGRES_HOST_PORT=$postgresHostPort"
            $matchedHostPort = $true
        }
    }
    if (-not $matchedHostPort) { $infraEnvLines += "POSTGRES_HOST_PORT=$postgresHostPort" }
    $matchedPgAdminPort = $false
    for ($index = 0; $index -lt $infraEnvLines.Count; $index++) {
        if ($infraEnvLines[$index] -match '^\s*PGADMIN_HOST_PORT\s*=') {
            $infraEnvLines[$index] = "PGADMIN_HOST_PORT=$pgAdminHostPort"
            $matchedPgAdminPort = $true
        }
    }
    if (-not $matchedPgAdminPort) { $infraEnvLines += "PGADMIN_HOST_PORT=$pgAdminHostPort" }
    Set-Content -LiteralPath $infraEnv -Value $infraEnvLines -Encoding utf8
}
else {
    Set-Content -LiteralPath $infraEnv -Value @("POSTGRES_HOST_PORT=$postgresHostPort", "PGADMIN_HOST_PORT=$pgAdminHostPort") -Encoding utf8
}

Write-Host "Downloading container images and building the local API stack (PostgreSQL host port $postgresHostPort)..."
Push-Location $infra
try {
    & docker compose -f $composeBase -f $composeApps up -d --build --wait
    $composeExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
if ($composeExitCode -ne 0) { throw "Docker Compose setup failed (exit code $composeExitCode)." }

Write-Host 'Checking that the six logical databases and the AUTH/SeatHold demo fixtures were created...'
$databaseCheck = @"
select string_agg(datname, ', ' order by datname)
from pg_database
where datname in ('identity','transport','booking','payment','notification','reporting');
"@
Push-Location $infra
try {
    $databases = docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d postgres -Atc $databaseCheck
    $databaseExitCode = $LASTEXITCODE
}
finally { Pop-Location }
if ($databaseExitCode -ne 0) { throw 'Could not verify PostgreSQL databases.' }

$authFixtureCheck = "select count(*) from users where email in ('seed.customer@example.test','pbl6.r3.customer.two@example.test','seed.phone.duplicate@example.test') and status = 'ACTIVE';"
Push-Location $infra
try {
    $authCount = docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d identity -Atc $authFixtureCheck
    $authExitCode = $LASTEXITCODE
}
finally { Pop-Location }
if ($authExitCode -ne 0 -or [int]$authCount.Trim() -ne 3) { throw 'Identity demo fixtures were not fully seeded.' }

$seatFixtureCheck = "select count(*) from trip_seats where trip_id='01990a00-0000-7000-8000-000000000007' and ((seat_code='1A' and status='BOOKED') or (seat_code in ('2A','2B') and status='AVAILABLE'));"
Push-Location $infra
try {
    $seatCount = docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d booking -Atc $seatFixtureCheck
    $seatExitCode = $LASTEXITCODE
}
finally { Pop-Location }
if ($seatExitCode -ne 0 -or [int]$seatCount.Trim() -ne 3) { throw 'Seat demo fixtures were not fully seeded.' }

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:5080/ready' -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    }
    catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) { throw 'Database is seeded, but API Gateway did not become ready at http://localhost:5080/ready.' }

Write-Host ''
Write-Host 'PBL6 demo environment is ready.'
Write-Host "Databases: $($databases.Trim())"
Write-Host "pgAdmin: http://localhost:$pgAdminHostPort (login admin@example.com / postgres)."
Write-Host 'In pgAdmin, open the preloaded server PBL6 - PostgreSQL; PostgreSQL credentials are platform / postgres.'
Write-Host 'API Gateway: http://localhost:5080/ready'
Write-Host 'Customer web: http://localhost:5173'
Write-Host 'Mailpit: http://localhost:8025'
Write-Host 'AUTH-02 duplicate email: seed.customer@example.test (ACTIVE)'
Write-Host 'Seat demo: trip 01990a00-0000-7000-8000-000000000007; 1A BOOKED; 2A/2B AVAILABLE.'
Write-Host 'This script sets up the environment; it does not run the Postman test collection.'
