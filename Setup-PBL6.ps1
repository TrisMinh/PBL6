#requires -Version 5.1
[CmdletBinding(DefaultParameterSetName = 'Default')]
param(
    [Parameter(ParameterSetName = 'Snapshot')]
    [string]$BackupPath,
    [Parameter(ParameterSetName = 'Snapshot')]
    [switch]$RestoreData,
    [Parameter(Mandatory, ParameterSetName = 'Seed')]
    [switch]$SeedOnly,
    [string]$ProjectPath,
    [string]$EnvFile,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = 'pbl6-operating',
    [string]$ComposeOverride
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$repoUrl = 'https://github.com/TrisMinh/PBL6.git'
$branch = 'codex/baseline-sepay-merged-general-fixes'
$infraPath = 'workspace\src\infra'

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

if ($EnvFile) {
    $EnvFile = (Get-Item -LiteralPath $EnvFile).FullName
}

if ($BackupPath) {
    $BackupPath = (Get-Item -LiteralPath $BackupPath).FullName
}
if ($ComposeOverride) {
    $ComposeOverride = (Get-Item -LiteralPath $ComposeOverride).FullName
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

    $composeVersion = & docker.exe compose version --short
    if ($LASTEXITCODE -ne 0 -or $composeVersion -notmatch '^v?(\d+\.\d+\.\d+)') {
        throw 'Docker Compose is unavailable. Repair or update Docker Desktop, then rerun setup.'
    }
    if ([version]$Matches[1] -lt [version]'2.24.4') {
        throw 'Update Docker Desktop to obtain Docker Compose 2.24.4 or newer.'
    }

    $dockerOptions = @{ ProjectName = $ProjectName }
    if ($EnvFile) { $dockerOptions.EnvFile = $EnvFile }
    if ($BackupPath) { $dockerOptions.BackupPath = $BackupPath }
    if ($RestoreData) { $dockerOptions.RestoreData = $true }
    if ($ComposeOverride) { $dockerOptions.ComposeOverride = $ComposeOverride }
    & (Join-Path $ProjectPath 'workspace\scripts\dev-docker.ps1') @dockerOptions
} finally {
    $env:DOCKER_CONTEXT = $previousContext
}
