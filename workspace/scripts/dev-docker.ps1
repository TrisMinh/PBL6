#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$RestoreData,
    [string]$BackupPath,
    [string]$EnvFile,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = 'pbl6-operating',
    [string]$ComposeOverride
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$workspace = Split-Path -Parent $PSScriptRoot
$infra = Join-Path $workspace 'src\infra'
$backups = Join-Path $workspace 'src\data-backup'
$root = Split-Path -Parent $workspace

function Invoke-Docker {
    & docker.exe @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker $($args[0]) failed (exit $LASTEXITCODE). See the output above."
    }
}

$required = @(
    'workspace/src/infra/docker-compose.yml', 'workspace/src/infra/docker-compose.apps.yml',
    'workspace/src/infra/docker-compose.internal-postgres.yml', 'workspace/src/infra/docker-compose.local-setup.yml',
    'workspace/src/infra/docker/api.Dockerfile', 'workspace/src/infra/postgres/bootstrap.sh',
    'workspace/src/apps/web/Dockerfile', 'workspace/src/apps/web/pnpm-lock.yaml',
    'workspace/Directory.Build.props', 'workspace/Directory.Packages.props', 'workspace/BusTicketPlatform.sln',
    'workspace/scripts/load-operating-demo.ps1'
)
$required += @('common','finance-common','identity','transport','booking','payment','notification','reporting','verify' |
    ForEach-Object { "docs/database/operating-demo/$_.sql" })
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $root $_) -PathType Leaf) })
if ($missing.Count -gt 0) {
    throw "PBL6 source is incomplete. Re-extract the full setup archive or get the matching revision. Missing: $($missing -join ', ')"
}

$archive = $null
if ($BackupPath) {
    $archive = Get-Item -LiteralPath $BackupPath
} elseif ($RestoreData -and (Test-Path -LiteralPath $backups)) {
    $archive = Get-ChildItem -LiteralPath $backups -Filter 'PBL6-data-*.zip' -File |
        Where-Object { $_.Name -ne 'PBL6-data-sample.zip' } |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $archive) {
        $archive = Get-Item -LiteralPath (Join-Path $backups 'PBL6-data-sample.zip') -ErrorAction SilentlyContinue
    }
}
if (($RestoreData -or $BackupPath) -and (-not $archive -or $archive.PSIsContainer -or $archive.Extension -ne '.zip')) {
    throw 'Copy PBL6-data-*.zip into workspace/src/data-backup or pass -BackupPath.'
}
if ($EnvFile) {
    $EnvFile = (Get-Item -LiteralPath $EnvFile).FullName
} elseif (Test-Path -LiteralPath (Join-Path $root '.env') -PathType Leaf) {
    $EnvFile = Join-Path $root '.env'
}

if ($ComposeOverride) {
    $ComposeOverride = (Get-Item -LiteralPath $ComposeOverride).FullName
}

Push-Location $infra
try {
    $compose = @('compose', '--project-name', $ProjectName)
    if ($EnvFile) { $compose += @('--env-file', $EnvFile) }
    $compose += @('-f', 'docker-compose.yml', '-f', 'docker-compose.internal-postgres.yml')
    $appsCompose = $compose + @('-f', 'docker-compose.apps.yml', '-f', 'docker-compose.local-setup.yml')
    if ($ComposeOverride) { $appsCompose += @('-f', $ComposeOverride) }
    Invoke-Docker @appsCompose config --quiet

    if ($archive) {
        $hash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        Invoke-Docker @compose up -d --wait postgres
        $container = Invoke-Docker @compose ps -q postgres
        if (-not $container) { throw 'PostgreSQL container not found.' }
        $markerPath = '/var/lib/postgresql/data/.pbl6-restore-sha256'
        $readMarker = @(
            'exec', $container, 'sh', '-c', 'if test -f $1; then cat $1; fi', 'sh', $markerPath
        )
        $installedHash = Invoke-Docker @readMarker
        if ($installedHash -eq $hash) {
            Write-Host 'This snapshot is already restored.'
        } elseif ($installedHash) {
            Write-Warning 'The volume already contains a different snapshot. Continuing with existing data.'
        } else {
            $hasTables = $false
            foreach ($database in 'identity','transport','booking','payment','notification','reporting') {
                $check = Invoke-Docker exec $container psql -XAt -U platform -d $database -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema'));"
                if ($check -eq 't') { $hasTables = $true; break }
                if ($check -ne 'f') { throw "Unable to inspect database $database." }
            }
            if ($hasTables) {
                Write-Warning 'The service databases already contain tables. Continuing with existing data.'
            } else {
            $savedArchive = Join-Path $backups $archive.Name
            New-Item -ItemType Directory -Path $backups -Force | Out-Null
            if (-not (Test-Path -LiteralPath $savedArchive)) {
                Copy-Item -LiteralPath $archive.FullName -Destination $savedArchive
            }
            if ((Get-FileHash -LiteralPath $savedArchive -Algorithm SHA256).Hash -ne $hash) {
                throw "A different file already exists at $savedArchive."
            }
            $extracted = Join-Path $backups "restore-$($hash.Substring(0, 16))"
            Expand-Archive -LiteralPath $savedArchive -DestinationPath $extracted -Force
            $restoreRoot = Join-Path $extracted $archive.BaseName
            $restore = Join-Path $restoreRoot 'Restore-PBL6Data.ps1'
            if (-not (Test-Path -LiteralPath $restore -PathType Leaf)) {
                throw "Restore-PBL6Data.ps1 was not found in $savedArchive."
            }
            Write-Host 'Restoring the six PostgreSQL databases ...'
            & $restore -Container $container
            $writeMarker = @(
                'exec', '--user', 'postgres', $container, 'sh', '-c',
                'echo $1 > $2.tmp && mv $2.tmp $2', 'sh', $hash, $markerPath
            )
            Invoke-Docker @writeMarker
            }
        }
    }

    Write-Host 'Building and starting the PBL6 stack ...'
    Invoke-Docker @appsCompose up -d --build --wait --wait-timeout 240
    $container = Invoke-Docker @appsCompose ps -q postgres
    if (-not $container) { throw 'PostgreSQL container not found after startup.' }
    & (Join-Path $PSScriptRoot 'load-operating-demo.ps1') -Container $container -ProjectName $ProjectName -SkipCompleted

    Write-Host 'Checking Gateway and web endpoints ...'
    Invoke-Docker @appsCompose exec -T gateway curl -fsS -o /dev/null http://127.0.0.1:8080/ready
    foreach ($portal in 'customer-web','operator-web','admin-web') {
        Invoke-Docker @appsCompose exec -T $portal wget -q -O /dev/null http://127.0.0.1:8080/healthz
    }
    Invoke-Docker @appsCompose ps
} finally {
    Pop-Location
}

if (-not $ComposeOverride) {
    Write-Host 'Customer http://localhost:5173 | Operator http://localhost:5174 | Admin http://localhost:5175'
    Write-Host 'Gateway http://localhost:5080 | Mailpit http://localhost:8025'
}
Write-Host 'Demo customer customer.00001@demo.blue.example.test / CustomerPass1'
Write-Host 'Operator Hai Van Lam operator.01@demo.blue.example.test / CustomerPass1'
Write-Host 'Operator Canh Buom Song Han operator.02@demo.blue.example.test / CustomerPass1'
Write-Host 'Operator Duong May Kinh Bac operator.03@demo.blue.example.test / CustomerPass1'
Write-Host 'Platform admin admin@demo.blue.example.test / CustomerPass1'
