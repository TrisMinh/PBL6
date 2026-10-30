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

function Write-JUnitReport {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$SuiteName,
        [Parameter(Mandatory)] [int]$Assertions,
        [Parameter(Mandatory)] [int]$Failed,
        [Parameter(Mandatory)] [int]$ExitCode,
        [Parameter(Mandatory)] [string]$LogPath,
        [Parameter(Mandatory)] [double]$DurationSeconds
    )

    $executionErrors = if ($ExitCode -ne 0 -and $Failed -eq 0) { 1 } else { 0 }
    $tests = $Assertions + $executionErrors
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Indent = $true
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try {
        $writer.WriteStartDocument()
        $writer.WriteStartElement('testsuite')
        $writer.WriteAttributeString('name', $SuiteName)
        $writer.WriteAttributeString('tests', [string]$tests)
        $writer.WriteAttributeString('failures', [string]$Failed)
        $writer.WriteAttributeString('errors', [string]$executionErrors)
        $writer.WriteAttributeString('time', $DurationSeconds.ToString('0.000', [System.Globalization.CultureInfo]::InvariantCulture))

        $passed = $Assertions - $Failed
        for ($index = 1; $index -le $passed; $index++) {
            $writer.WriteStartElement('testcase')
            $writer.WriteAttributeString('classname', $SuiteName)
            $writer.WriteAttributeString('name', ('passed assertion {0:D3}' -f $index))
            $writer.WriteEndElement()
        }
        for ($index = 1; $index -le $Failed; $index++) {
            $writer.WriteStartElement('testcase')
            $writer.WriteAttributeString('classname', $SuiteName)
            $writer.WriteAttributeString('name', ('failed assertion {0:D3}' -f $index))
            $writer.WriteStartElement('failure')
            $writer.WriteAttributeString('message', "Postman assertion failed; see $LogPath")
            $writer.WriteString($LogPath)
            $writer.WriteEndElement()
            $writer.WriteEndElement()
        }
        if ($executionErrors -gt 0) {
            $writer.WriteStartElement('testcase')
            $writer.WriteAttributeString('classname', $SuiteName)
            $writer.WriteAttributeString('name', 'collection execution')
            $writer.WriteStartElement('error')
            $writer.WriteAttributeString('message', "Postman exited with code $ExitCode; see $LogPath")
            $writer.WriteString($LogPath)
            $writer.WriteEndElement()
            $writer.WriteEndElement()
        }

        $writer.WriteEndElement()
        $writer.WriteEndDocument()
    }
    finally {
        $writer.Dispose()
    }
}

function Invoke-CollectionSetup {
    param(
        [AllowNull()] [string]$Setup,
        [Parameter(Mandatory)] [string]$ProjectName
    )

    if (-not $Setup) {
        return
    }

    [string[]]$containerIds = @(
        & docker ps `
            --filter "label=com.docker.compose.project=$ProjectName" `
            --filter 'label=com.docker.compose.service=postgres' `
            --format '{{.ID}}'
    ) | Where-Object { $_ } | ForEach-Object { [string]$_ }
    if ($LASTEXITCODE -ne 0 -or $containerIds.Count -ne 1) {
        throw "Expected exactly one running postgres container for Docker project '$ProjectName'."
    }

    switch ($Setup) {
        'expire-identity-challenge' {
            $database = 'identity'
            $sql = "UPDATE auth_challenges c SET expires_at = c.created_at + INTERVAL '1 millisecond' FROM users u WHERE c.user_id = u.id AND u.normalized_email = 'PBL6.R3.EXPIRY@EXAMPLE.TEST' AND c.status = 'ACTIVE';"
            $failureMessage = 'Could not stage the identity expiry fixture'
            $fixtureScript = $null
        }
        'reset-transport-trip-state' {
            $database = 'transport'
            $sql = "UPDATE trips SET status = 'SCHEDULED', sellable = true, row_version = 0, updated_at = NOW() WHERE id = '01990a00-0000-7000-8000-000000000040';"
            $failureMessage = 'Could not reset the transport trip-state fixture'
            $fixtureScript = '/baseline/transport/014_round2_state_fixture.sql'
        }
        'expire-pending-payment-bookings' {
            $database = 'booking'
            $sql = "UPDATE bookings SET updated_at = updated_at WHERE status = 'PENDING_PAYMENT';"
            $failureMessage = 'Could not locate pending bookings for the workbook fixture'
            $fixtureScript = $null
        }
        default {
            throw "Unsupported collection setup action: $Setup"
        }
    }

    if ($fixtureScript) {
        [string[]]$bootstrapContainerIds = @(
            & docker ps `
                --filter "label=com.docker.compose.project=$ProjectName" `
                --filter 'label=com.docker.compose.service=db-bootstrap' `
                --format '{{.ID}}'
        ) | Where-Object { $_ } | ForEach-Object { [string]$_ }
        if ($LASTEXITCODE -ne 0 -or $bootstrapContainerIds.Count -ne 1) {
            throw "Expected exactly one running db-bootstrap container for Docker project '$ProjectName'."
        }

        $fixtureOutput = @(& docker exec $bootstrapContainerIds[0] psql -U platform -d $database -v ON_ERROR_STOP=1 -f $fixtureScript 2>&1)
        if ($LASTEXITCODE -ne 0) {
            throw "Could not load test-only fixture '$fixtureScript': $($fixtureOutput -join [Environment]::NewLine)"
        }
    }

    $output = @(& docker exec $containerIds[0] psql -U platform -d $database -v ON_ERROR_STOP=1 -c $sql 2>&1)
    $expectedUpdate = if ($Setup -eq 'expire-pending-payment-bookings') { 'UPDATE [1-9][0-9]*' } else { 'UPDATE 1' }
    if ($LASTEXITCODE -ne 0 -or -not ($output -match $expectedUpdate)) {
        throw "${failureMessage}: $($output -join [Environment]::NewLine)"
    }

    if ($Setup -eq 'expire-pending-payment-bookings') {
        $quoteOutput = @(& docker exec $containerIds[0] psql -U platform -d payment -v ON_ERROR_STOP=1 -c "UPDATE booking_quotes SET expires_at = NOW() - INTERVAL '1 minute' WHERE payment_channel = 'PREPAID';" 2>&1)
        if ($LASTEXITCODE -ne 0 -or -not ($quoteOutput -match 'UPDATE [1-9][0-9]*')) {
            throw "Could not expire pending payment quotes: $($quoteOutput -join [Environment]::NewLine)"
        }
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

$supportedSetups = @('expire-identity-challenge', 'reset-transport-trip-state', 'expire-pending-payment-bookings')
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
$logsDirectory = Join-Path $OutputDirectory 'logs'
$junitDirectory = Join-Path $OutputDirectory 'junit'
[System.IO.Directory]::CreateDirectory($logsDirectory) | Out-Null
[System.IO.Directory]::CreateDirectory($junitDirectory) | Out-Null
$startedAt = [DateTimeOffset]::UtcNow
$results = [System.Collections.Generic.List[object]]::new()

foreach ($collection in $resolvedCollections) {
    $safeName = $collection.Name -replace '[^A-Za-z0-9_.-]', '_'
    $logPath = Join-Path $logsDirectory "$safeName.log"
    $junitPath = Join-Path $junitDirectory "$safeName.xml"
    $collectionStartedAt = [DateTimeOffset]::UtcNow
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
    $durationSeconds = ([DateTimeOffset]::UtcNow - $collectionStartedAt).TotalSeconds
    $portableLogPath = "logs/$safeName.log"
    $portableJunitPath = "junit/$safeName.xml"
    Write-JUnitReport -Path $junitPath -SuiteName $collection.Name -Assertions $counts.Assertions -Failed $counts.Failed -ExitCode $exitCode -LogPath $portableLogPath -DurationSeconds $durationSeconds

    $results.Add([pscustomobject]@{
        Collection = $collection.Name
        Path = $collection.RelativePath
        ExitCode = $exitCode
        Assertions = $counts.Assertions
        Passed = $counts.Assertions - $counts.Failed
        Failed = $counts.Failed
        DurationSeconds = [math]::Round($durationSeconds, 3)
        Log = $portableLogPath
        JUnit = $portableJunitPath
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
