#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$RestoreData,
    [string]$BackupPath,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$workspace = Split-Path -Parent $PSScriptRoot
$infra = Join-Path $workspace 'src\infra'
$backups = Join-Path $workspace 'src\data-backup'

function Invoke-Docker {
    & docker.exe @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker $($args[0]) failed (exit $LASTEXITCODE). See the output above."
    }
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
}

$previousContext = $env:DOCKER_CONTEXT
Push-Location $infra
try {
    $compose = @('compose')
    if ($EnvFile) { $compose += @('--env-file', $EnvFile) }
    $compose += @('-f', 'docker-compose.yml', '-f', 'docker-compose.internal-postgres.yml')
    $appsCompose = $compose + @('-f', 'docker-compose.apps.yml')
    if ($archive) { $env:DOCKER_CONTEXT = 'desktop-linux' }
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
            throw 'The current volume already contains a different restored snapshot. Existing data is preserved.'
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

    Write-Host 'Building and starting the PBL6 stack ...'
    Invoke-Docker @appsCompose up -d --build --wait
} finally {
    Pop-Location
    $env:DOCKER_CONTEXT = $previousContext
}

Write-Host 'Customer http://localhost:5173 | Operator http://localhost:5174 | Admin http://localhost:5175'
Write-Host 'Gateway http://localhost:5080 | Mailpit http://localhost:8025'
if (-not $archive) {
    Write-Host 'Seed customer seed.customer@example.test / CustomerPass1'
    Write-Host 'Seed operator operator.seed@example.test / OperatorPass1'
}
