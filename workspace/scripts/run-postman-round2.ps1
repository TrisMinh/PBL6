[CmdletBinding()]
param(
    [string]$SuitePath,
    [string]$EnvironmentPath,
    [string]$OutputDirectory,
    [string]$DockerProjectName = 'pbl6-r2',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $SuitePath) {
    $SuitePath = Join-Path $workspaceRoot 'postman\round2-suite.json'
}
if (-not $EnvironmentPath) {
    $EnvironmentPath = Join-Path $workspaceRoot 'postman\PBL6_Local.postman_environment.json'
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $workspaceRoot 'postman\runs\round2'
}

function Resolve-ExistingFile {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Label
    )

    if (-not [System.IO.Path]::IsPathRooted($Path)) {
        $Path = Join-Path $workspaceRoot $Path
    }

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label does not exist: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Get-AssertionCounts {
    param([Parameter(Mandatory)] [AllowEmptyString()] [string[]]$Lines)

    $assertionLine = $Lines |
        Where-Object { $_ -match '^\|\s*assertions\s*\|' } |
        Select-Object -Last 1

    if (-not $assertionLine) {
        return @{ Assertions = 0; Failed = 0 }
    }

    $match = [regex]::Match($assertionLine, '^\|\s*assertions\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|')
    if (-not $match.Success) {
        throw "Could not parse Postman assertion summary: $assertionLine"
    }

    return @{
        Assertions = [int]$match.Groups[1].Value
        Failed = [int]$match.Groups[2].Value
    }
}

function Get-PortablePath {
    param([Parameter(Mandatory)] [string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if ($fullPath.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fullPath.Substring($workspacePrefix.Length).Replace('\', '/')
    }

    return [System.IO.Path]::GetFileName($fullPath)
}

function Invoke-CollectionSetup {
    param(
        [AllowNull()] [string]$Setup,
        [Parameter(Mandatory)] [string]$ProjectName
    )

    if (-not $Setup) {
        return
    }

    if ($Setup -ne 'expire-identity-challenge') {
        throw "Unsupported collection setup action: $Setup"
    }

    $containerIds = @(
        & docker ps `
            --filter "label=com.docker.compose.project=$ProjectName" `
            --filter 'label=com.docker.compose.service=postgres' `
            --format '{{.ID}}'
    ) | Where-Object { $_ }
    if ($LASTEXITCODE -ne 0 -or $containerIds.Count -ne 1) {
        throw "Expected exactly one running postgres container for Docker project '$ProjectName'."
    }

    $sql = "UPDATE auth_challenges c SET expires_at = c.created_at + INTERVAL '1 millisecond' FROM users u WHERE c.user_id = u.id AND u.normalized_email = 'PBL6.R3.EXPIRY@EXAMPLE.TEST' AND c.status = 'ACTIVE';"
    $output = @(& docker exec $containerIds[0] psql -U platform -d identity -v ON_ERROR_STOP=1 -c $sql 2>&1)
    if ($LASTEXITCODE -ne 0 -or -not ($output -match 'UPDATE 1')) {
        throw "Could not stage the identity expiry fixture: $($output -join [Environment]::NewLine)"
    }
}

$resolvedSuitePath = Resolve-ExistingFile -Path $SuitePath -Label 'Suite manifest'
$resolvedEnvironmentPath = Resolve-ExistingFile -Path $EnvironmentPath -Label 'Postman environment'
$suite = Get-Content -LiteralPath $resolvedSuitePath -Raw | ConvertFrom-Json
$collections = @($suite.collections)

if ($collections.Count -eq 0) {
    throw 'Suite manifest must declare at least one collection.'
}

$duplicates = $collections |
    Group-Object -Property path |
    Where-Object Count -gt 1
if ($duplicates) {
    throw "Suite manifest contains duplicate collection paths: $($duplicates.Name -join ', ')"
}

$supportedSetups = @('expire-identity-challenge')
$unsupportedSetups = @($collections | Where-Object { $_.setup -and $_.setup -notin $supportedSetups })
if ($unsupportedSetups.Count -gt 0) {
    throw "Unsupported collection setup action: $($unsupportedSetups[0].setup)"
}

$resolvedCollections = foreach ($collection in $collections) {
    $collectionPath = Resolve-ExistingFile -Path $collection.path -Label 'Postman collection'
    [pscustomobject]@{
        Name = [System.IO.Path]::GetFileNameWithoutExtension($collectionPath)
        RelativePath = $collection.path
        Path = $collectionPath
        Setup = $collection.setup
    }
}

if ($DryRun) {
    $parent = Split-Path -Parent $OutputDirectory
    if (-not $parent) {
        $parent = $workspaceRoot
    }
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    Write-Host "Dry run validated $($resolvedCollections.Count) unique collections."
    Write-Host "Environment: $resolvedEnvironmentPath"
    Write-Host "Evidence directory: $OutputDirectory"
    exit 0
}

try {
    $readiness = Invoke-WebRequest -Uri $suite.readinessUrl -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($readiness.StatusCode -ne 200) {
        throw "Readiness endpoint returned HTTP $($readiness.StatusCode)."
    }
}
catch {
    throw "Docker gateway is not ready at $($suite.readinessUrl): $($_.Exception.Message)"
}

[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
$startedAt = [DateTimeOffset]::UtcNow
$results = [System.Collections.Generic.List[object]]::new()

foreach ($collection in $resolvedCollections) {
    $safeName = $collection.Name -replace '[^A-Za-z0-9_.-]', '_'
    $logPath = Join-Path $OutputDirectory "$safeName.log"
    Write-Host "Running $($collection.RelativePath)"
    Invoke-CollectionSetup -Setup $collection.Setup -ProjectName $DockerProjectName

    $output = @(
        & postman collection run $collection.Path `
            -e $resolvedEnvironmentPath `
            --no-report-events `
            --disable-unicode 2>&1
    )
    $exitCode = $LASTEXITCODE
    $output | Set-Content -LiteralPath $logPath -Encoding utf8
    $counts = Get-AssertionCounts -Lines ([string[]]$output)

    $results.Add([pscustomobject]@{
        Collection = $collection.Name
        Path = $collection.RelativePath
        ExitCode = $exitCode
        Assertions = $counts.Assertions
        Passed = $counts.Assertions - $counts.Failed
        Failed = $counts.Failed
        Log = "$safeName.log"
    })
}

$assertions = ($results | Measure-Object -Property Assertions -Sum).Sum
$passed = ($results | Measure-Object -Property Passed -Sum).Sum
$failed = ($results | Measure-Object -Property Failed -Sum).Sum
$failedCollections = @($results | Where-Object { $_.ExitCode -ne 0 -or $_.Failed -gt 0 }).Count
$summary = [ordered]@{
    schemaVersion = 1
    suite = $suite.name
    startedAt = $startedAt.ToString('O')
    completedAt = [DateTimeOffset]::UtcNow.ToString('O')
    readinessUrl = $suite.readinessUrl
    environment = Get-PortablePath -Path $resolvedEnvironmentPath
    collections = $results.Count
    failedCollections = $failedCollections
    assertions = $assertions
    passed = $passed
    failed = $failed
    passRate = if ($assertions -gt 0) { [math]::Round($passed / $assertions, 6) } else { 0 }
    round1Baseline = $suite.baseline
    exceededRound1 = ($passed -gt [int]$suite.baseline.passed) -and (($passed / [math]::Max($assertions, 1)) -gt [double]$suite.baseline.passRate)
    results = $results
}

$results | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'round2-suite-index.csv') -NoTypeInformation -Encoding utf8
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'round2-summary.json') -Encoding utf8

Write-Host ("Round 2: {0}/{1} assertions passed ({2:P2}); {3} failed collections." -f $passed, $assertions, $summary.passRate, $failedCollections)
if ($failedCollections -gt 0) {
    exit 1
}

exit 0
