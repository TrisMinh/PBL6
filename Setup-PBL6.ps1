#requires -Version 5.1
[CmdletBinding(DefaultParameterSetName = 'Snapshot')]
param(
    [Parameter(ParameterSetName = 'Snapshot')]
    [string]$BackupPath,
    [Parameter(Mandatory, ParameterSetName = 'Seed')]
    [switch]$SeedOnly,
    [string]$ProjectPath,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$repoUrl = 'https://github.com/TrisMinh/PBL6.git'
$branch = 'codex/baseline-sepay-merged-general-fixes'
$infraPath = 'workspace\src\infra'
$backupDirectory = 'workspace\src\data-backup'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program $($Arguments[0]) failed (exit $LASTEXITCODE). See the output above."
    }
}

function Install-Package {
    param([string]$PackageId)
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw 'Install or update App Installer (WinGet) from Microsoft Store, then rerun the same command.'
    }
    Write-Host "Installing $PackageId ..."
    Invoke-Checked winget.exe @(
        'install', '--id', $PackageId, '--exact', '--source', 'winget', '--silent',
        '--accept-package-agreements', '--accept-source-agreements'
    )
}

function Add-ToolPaths {
    $toolPaths = @(
        (Join-Path $env:ProgramFiles 'Git\cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'),
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin')
    )
    foreach ($toolPath in $toolPaths) {
        if ((Test-Path -LiteralPath $toolPath) -and ($env:Path -split ';' -notcontains $toolPath)) {
            $env:Path += ";$toolPath"
        }
    }
}

if (-not $ProjectPath) {
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "$infraPath\docker-compose.yml")) {
        $ProjectPath = $PSScriptRoot
    } else {
        $ProjectPath = Join-Path $PSScriptRoot 'PBL6'
    }
}
$ProjectPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProjectPath)
$infra = Join-Path $ProjectPath $infraPath
$backups = Join-Path $ProjectPath $backupDirectory

if ($EnvFile) {
    $EnvFile = (Get-Item -LiteralPath $EnvFile).FullName
}

$archive = $null
if (-not $SeedOnly) {
    if ($BackupPath) {
        $archive = Get-Item -LiteralPath $BackupPath
    } else {
        $archive = Get-ChildItem -LiteralPath @($PSScriptRoot, $backups) -Filter 'PBL6-data-*.zip' -File -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1
    }
    if (-not $archive -or $archive.PSIsContainer -or $archive.Extension -ne '.zip') {
        throw 'Place the PBL6-data-*.zip snapshot beside the script, pass -BackupPath, or use -SeedOnly.'
    }
}

Add-ToolPaths
if (-not (Test-Path -LiteralPath (Join-Path $infra 'docker-compose.apps.yml'))) {
    if ((Test-Path -LiteralPath $ProjectPath) -and (Get-ChildItem -LiteralPath $ProjectPath -Force | Select-Object -First 1)) {
        throw "Project destination is not empty and does not contain PBL6: $ProjectPath"
    }
    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        Install-Package 'Git.Git'
        Add-ToolPaths
    }
    Write-Host "Cloning PBL6 into $ProjectPath ..."
    Invoke-Checked git.exe @('clone', '--branch', $branch, '--single-branch', $repoUrl, $ProjectPath)
}

$dockerDesktopPaths = @(
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe')
)
$dockerDesktop = $dockerDesktopPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $dockerDesktop) {
    & wsl.exe --status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Enabling WSL 2. Windows may require administrator permission and a restart.'
        Invoke-Checked wsl.exe @('--install', '--no-distribution')
        Write-Host 'Restart Windows, then rerun the same command to continue.'
        exit 3010
    }
    Install-Package 'Docker.DockerDesktop'
    Add-ToolPaths
    $dockerDesktop = $dockerDesktopPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $dockerDesktop) {
        throw 'Docker Desktop is not available yet. Finish installation or restart Windows, then rerun this script.'
    }
}

$previousContext = $env:DOCKER_CONTEXT
try {
    $env:DOCKER_CONTEXT = 'desktop-linux'
    $engineType = & docker.exe info --format '{{.OSType}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or $engineType -ne 'linux') {
        Write-Host 'Starting Docker Desktop. Complete any first-launch prompts.'
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        $deadline = (Get-Date).AddMinutes(5)
        do {
            Start-Sleep -Seconds 5
            $engineType = & docker.exe info --format '{{.OSType}}' 2>$null
            if ($LASTEXITCODE -eq 0 -and $engineType -eq 'linux') { break }
        } while ((Get-Date) -lt $deadline)
        if ($LASTEXITCODE -ne 0 -or $engineType -ne 'linux') {
            throw 'Docker Desktop Linux engine is unavailable. Open Docker Desktop, complete its setup and rerun.'
        }
    }

    $compose = @('compose', '--project-directory', $infra, '-p', 'pbl6-local')
    if ($EnvFile) { $compose += @('--env-file', $EnvFile) }
    $compose += @('-f', (Join-Path $infra 'docker-compose.yml'))
    $appsCompose = $compose + @('-f', (Join-Path $infra 'docker-compose.apps.yml'))
    Invoke-Checked docker.exe ($appsCompose + @('config', '--quiet'))

    if ($archive) {
        $hash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        Invoke-Checked docker.exe ($compose + @('up', '-d', '--wait', 'postgres'))
        $container = Invoke-Checked docker.exe ($compose + @('ps', '-q', 'postgres'))
        if (-not $container) { throw 'PostgreSQL container not found.' }
        $markerPath = '/var/lib/postgresql/data/.pbl6-restore-sha256'
        $installedHash = Invoke-Checked docker.exe @(
            'exec', $container, 'sh', '-c', 'if test -f $1; then cat $1; fi', 'sh', $markerPath
        )
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
            Invoke-Checked docker.exe @(
                'exec', '--user', 'postgres', $container, 'sh', '-c',
                'echo $1 > $2.tmp && mv $2.tmp $2', 'sh', $hash, $markerPath
            )
        }
    }

    Write-Host 'Building and starting the PBL6 stack ...'
    Invoke-Checked docker.exe ($appsCompose + @('up', '-d', '--build', '--wait', '--wait-timeout', '600'))
    Write-Host "Project: $ProjectPath"
    Write-Host 'Customer http://localhost:5173 | Operator http://localhost:5174 | Admin http://localhost:5175'
} finally {
    $env:DOCKER_CONTEXT = $previousContext
}
