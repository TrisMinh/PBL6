[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runnerPath = Join-Path $workspaceRoot 'scripts\run-postman-round2.ps1'
$suitePath = Join-Path $workspaceRoot 'postman\round2-suite.json'
$environmentPath = Join-Path $workspaceRoot 'postman\PBL6_Local.postman_environment.json'

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
    throw "Round 2 runner is missing: $runnerPath"
}

if (-not (Test-Path -LiteralPath $suitePath -PathType Leaf)) {
    throw "Round 2 suite manifest is missing: $suitePath"
}

$suite = Get-Content -LiteralPath $suitePath -Raw | ConvertFrom-Json
$collections = @($suite.collections)
if ($collections.Count -eq 0) {
    throw 'Round 2 suite must declare at least one collection.'
}

$duplicates = $collections |
    Group-Object -Property path |
    Where-Object Count -gt 1
if ($duplicates) {
    throw "Round 2 suite contains duplicate collection paths: $($duplicates.Name -join ', ')"
}

foreach ($collection in $collections) {
    $collectionPath = Join-Path $workspaceRoot $collection.path
    if (-not (Test-Path -LiteralPath $collectionPath -PathType Leaf)) {
        throw "Collection does not exist: $($collection.path)"
    }
}

$runnerArguments = @{
    SuitePath = $suitePath
    EnvironmentPath = $environmentPath
    OutputDirectory = (Join-Path $env:TEMP 'pbl6-round2-contract-test')
    DryRun = $true
}
& $runnerPath @runnerArguments

if ($LASTEXITCODE -ne 0) {
    throw "Runner dry-run failed with exit code $LASTEXITCODE."
}

& $runnerPath -DryRun
if ($LASTEXITCODE -ne 0) {
    throw "Runner default-path dry-run failed with exit code $LASTEXITCODE."
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $runnerPath -DryRun
if ($LASTEXITCODE -ne 0) {
    throw "Runner fresh-process default-path dry-run failed with exit code $LASTEXITCODE."
}

$invalidSuitePath = Join-Path $env:TEMP 'pbl6-round2-invalid-setup.json'
@{
    schemaVersion = 1
    name = 'Invalid setup contract'
    readinessUrl = 'http://localhost:5080/ready'
    baseline = @{ passed = 0; passRate = 0 }
    collections = @(
        @{ path = 'postman/PBL6_R3_CommonFormats.postman_collection.json'; setup = 'unsupported-action' }
    )
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $invalidSuitePath -Encoding utf8
$savedErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& powershell -NoProfile -ExecutionPolicy Bypass -File $runnerPath -SuitePath $invalidSuitePath -EnvironmentPath $environmentPath -OutputDirectory (Join-Path $env:TEMP 'pbl6-round2-invalid-setup') -DryRun 2>$null
$invalidSetupExitCode = $LASTEXITCODE
$ErrorActionPreference = $savedErrorActionPreference
if ($invalidSetupExitCode -eq 0) {
    throw 'Runner must reject unsupported collection setup actions.'
}

$liveTestRoot = Join-Path $env:TEMP ("pbl6-round2-live-contract-" + [guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($liveTestRoot) | Out-Null
$liveSuitePath = Join-Path $liveTestRoot 'suite.json'
$liveOutputPath = Join-Path $liveTestRoot 'evidence'
$liveCollectionPath = Join-Path $liveTestRoot 'ready.postman_collection.json'
@{
    info = @{
        name = 'Runner readiness contract'
        schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    }
    item = @(
        @{
            name = 'Gateway ready'
            request = @{ method = 'GET'; header = @(); url = 'http://localhost:5080/ready' }
            event = @(
                @{ listen = 'test'; script = @{ type = 'text/javascript'; exec = @("pm.test('Gateway is ready',()=>pm.response.to.have.status(200));") } }
            )
        }
    )
} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $liveCollectionPath -Encoding utf8
$liveSuite = @{
    schemaVersion = 1
    name = 'Runner live contract'
    readinessUrl = 'http://localhost:5080/ready'
    baseline = @{ passed = 0; passRate = 0 }
    collections = @(
        @{ path = $liveCollectionPath }
    )
}
$liveSuite | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $liveSuitePath -Encoding utf8

$liveRunnerArguments = @{
    SuitePath = $liveSuitePath
    EnvironmentPath = $environmentPath
    OutputDirectory = $liveOutputPath
}
& $runnerPath @liveRunnerArguments
if ($LASTEXITCODE -ne 0) {
    throw "Runner live contract failed with exit code $LASTEXITCODE."
}

$liveSummary = Get-Content -LiteralPath (Join-Path $liveOutputPath 'round2-summary.json') -Raw | ConvertFrom-Json
if ($liveSummary.assertions -ne 1 -or $liveSummary.failed -ne 0) {
    throw "Runner live summary was not parsed correctly: $($liveSummary | ConvertTo-Json -Compress)"
}
if ([System.IO.Path]::IsPathRooted([string]$liveSummary.environment)) {
    throw "Runner summary must not expose a machine-specific environment path: $($liveSummary.environment)"
}
if ([System.IO.Path]::IsPathRooted([string]$liveSummary.results[0].Log)) {
    throw "Runner summary must not expose a machine-specific log path: $($liveSummary.results[0].Log)"
}

Write-Host "Round 2 runner contract passed for $($collections.Count) collections."
