$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-Port([int]$Port) {
    try {
        return (Test-NetConnection localhost -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
    }
    catch {
        return $false
    }
}

function Install-WingetPackage([string]$Id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget is required to install missing local dependencies."
    }

    Write-Host "Installing $Id..."
    winget install --id $Id -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
        [Environment]::GetEnvironmentVariable("Path", "User")
}

function Start-FirstService([string]$Pattern) {
    $service = Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like $Pattern -or $_.DisplayName -like $Pattern } |
        Select-Object -First 1

    if ($service -and $service.Status -ne "Running") {
        Start-Service -Name $service.Name
    }

    return $service
}

function Wait-Port([int]$Port, [string]$Name) {
    $deadline = (Get-Date).AddMinutes(2)
    while (-not (Test-Port $Port)) {
        if ((Get-Date) -gt $deadline) {
            throw "$Name did not become available on port $Port."
        }
        Start-Sleep -Seconds 2
    }
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    $psqlPath = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if ($psqlPath) {
        $psql = Get-Command $psqlPath
    }
}

$rabbitMqCtl = Get-Command rabbitmqctl.bat -ErrorAction SilentlyContinue
if (-not $rabbitMqCtl) {
    $rabbitMqCtlPath = Get-ChildItem "C:\Program Files\RabbitMQ Server" -Filter rabbitmqctl.bat -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if ($rabbitMqCtlPath) {
        $rabbitMqCtl = Get-Command $rabbitMqCtlPath
    }
}

$erlangExe = Get-ChildItem "C:\Program Files\Erlang OTP" -Filter erl.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "\\bin\\erl\.exe$" } |
    Select-Object -First 1
if (-not $erlangExe) {
    $erlangExe = Get-ChildItem "C:\Program Files\Erlang" -Filter erl.exe -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\bin\\erl\.exe$" } |
        Select-Object -First 1
}
if ($erlangExe) {
    $env:ERLANG_HOME = Split-Path (Split-Path $erlangExe.FullName -Parent) -Parent
    $env:Path = (Split-Path $erlangExe.FullName -Parent) + ";" + $env:Path
}

if (-not (Test-Port 5432)) {
    if (-not $psql) {
        Install-WingetPackage "PostgreSQL.PostgreSQL.17"
        $psqlPath = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        if ($psqlPath) {
            $psql = Get-Command $psqlPath
        }
    }
    Start-FirstService "postgresql*"
}

if (-not (Test-Port 6379)) {
    if (-not (Get-Command redis-server -ErrorAction SilentlyContinue)) {
        Install-WingetPackage "Redis.Redis"
    }
    Start-FirstService "Redis*"
    if (-not (Test-Port 6379) -and (Get-Command redis-server -ErrorAction SilentlyContinue)) {
        Start-Process redis-server -WindowStyle Hidden
    }
}

if (-not (Test-Port 5672)) {
    if (-not $rabbitMqCtl) {
        Install-WingetPackage "Erlang.ErlangOTP"
        $release = Invoke-RestMethod "https://api.github.com/repos/rabbitmq/rabbitmq-server/releases/latest"
        $asset = $release.assets | Where-Object { $_.name -match "rabbitmq-server-.*\.exe$" } | Select-Object -First 1
        if (-not $asset) {
            throw "Could not find the RabbitMQ Windows installer in the latest release."
        }
        $rabbitMqInstaller = Join-Path $env:TEMP "rabbitmq-server.exe"
        Invoke-WebRequest $asset.browser_download_url -OutFile $rabbitMqInstaller
        Start-Process $rabbitMqInstaller -ArgumentList "/S" -Wait
        $rabbitMqCtlPath = Get-ChildItem "C:\Program Files\RabbitMQ Server" -Filter rabbitmqctl.bat -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        if ($rabbitMqCtlPath) {
            $rabbitMqCtl = Get-Command $rabbitMqCtlPath
        }
    }
    Start-FirstService "RabbitMQ*"
}

Wait-Port 5432 "PostgreSQL"
Wait-Port 5672 "RabbitMQ"
Wait-Port 6379 "Redis"

if (-not $psql) {
    throw "PostgreSQL is running, but psql.exe could not be found."
}

$env:PGPASSWORD = "postgres"
$platformUser = & $psql.Source -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='platform';"
if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to PostgreSQL with user 'postgres'. Check that the PostgreSQL password is 'postgres' or update PGPASSWORD in dev-local.ps1."
}
if (-not (($platformUser | Out-String).Trim())) {
    & $psql.Source -h localhost -U postgres -d postgres -c "CREATE USER platform WITH PASSWORD 'postgres';"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create PostgreSQL user 'platform'."
    }
}

foreach ($database in @("identity", "transport", "booking", "payment", "notification", "reporting")) {
    $exists = & $psql.Source -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database';"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect PostgreSQL database '$database'."
    }
    if (-not (($exists | Out-String).Trim())) {
        & $psql.Source -h localhost -U postgres -d postgres -c "CREATE DATABASE $database OWNER platform;"
        if ($LASTEXITCODE -ne 0) {
            throw "Could not create PostgreSQL database '$database'."
        }
    }
}

if (-not $rabbitMqCtl) {
    throw "RabbitMQ is running, but rabbitmqctl.bat could not be found."
}
$erlCommand = Get-Command erl.exe -ErrorAction SilentlyContinue
if (-not $erlCommand) {
    throw "Erlang is installed but erl.exe is not available. Expected it under C:\Program Files\Erlang OTP\bin."
}
try {
    & $rabbitMqCtl.Source add_user platform guest 2>$null
    & $rabbitMqCtl.Source add_vhost bus-ticket 2>$null
    & $rabbitMqCtl.Source set_permissions -p bus-ticket platform ".*" ".*" ".*"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "RabbitMQ is listening, but rabbitmqctl could not update users. Existing RabbitMQ configuration will be used."
    }
}
catch {
    Write-Warning "RabbitMQ is listening, but rabbitmqctl could not update users. Existing RabbitMQ configuration will be used."
}

$simulator = Join-Path $root "src\infra\payment-simulator\simulator.py"
if (-not (Test-Port 8099)) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw "Python is required to run the local VNPay simulator."
    }
    Start-Process python -WorkingDirectory (Split-Path $simulator) `
        -ArgumentList @($simulator) -WindowStyle Hidden
}
Wait-Port 8099 "VNPay simulator"

. (Join-Path $PSScriptRoot "dev-env.ps1")
Set-PlatformEnv
# The Windows RabbitMQ installation provides the local guest account by default.
$env:MESSAGING__AMQPURI = "amqp://guest:guest@localhost:5672/"

$apis = @(
    @{ Project = "src\gateway\BusTicketPlatform.Gateway\BusTicketPlatform.Gateway.csproj"; Port = 5080 },
    @{ Project = "src\services\identity\BusTicketPlatform.Identity.Api\BusTicketPlatform.Identity.Api.csproj"; Port = 5081 },
    @{ Project = "src\services\transport\BusTicketPlatform.Transport.Api\BusTicketPlatform.Transport.Api.csproj"; Port = 5082 },
    @{ Project = "src\services\booking\BusTicketPlatform.Booking.Api\BusTicketPlatform.Booking.Api.csproj"; Port = 5083 },
    @{ Project = "src\services\payment\BusTicketPlatform.Payment.Api\BusTicketPlatform.Payment.Api.csproj"; Port = 5084 },
    @{ Project = "src\services\notification\BusTicketPlatform.Notification.Api\BusTicketPlatform.Notification.Api.csproj"; Port = 5085 },
    @{ Project = "src\services\reporting\BusTicketPlatform.Reporting.Api\BusTicketPlatform.Reporting.Api.csproj"; Port = 5086 }
)

foreach ($api in $apis) {
    if (-not (Test-Port $api.Port)) {
        $command = "Set-Location '$root'; . '$PSScriptRoot\dev-env.ps1'; Set-PlatformEnv; `$env:MESSAGING__AMQPURI = 'amqp://guest:guest@localhost:5672/'; dotnet run --no-launch-profile --project '$($api.Project)' --urls 'http://localhost:$($api.Port)'"
        Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $command)
    }
}

foreach ($api in $apis) {
    Wait-Port $api.Port $api.Project
}

foreach ($api in $apis) {
    $deadline = (Get-Date).AddMinutes(2)
    while ($true) {
        try {
            $response = Invoke-WebRequest "http://localhost:$($api.Port)/ready" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { break }
        }
        catch { }
        if ((Get-Date) -gt $deadline) {
            throw "$($api.Project) is listening on port $($api.Port) but is not ready. Check its terminal for the dependency error."
        }
        Start-Sleep -Seconds 2
    }
}

Start-Process "http://localhost:5080/swagger"
Write-Host "All local dependencies and services are running."
Write-Host "Swagger: http://localhost:5080/swagger"
