[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:5080',
    [string]$MailpitUrl = 'http://localhost:8025',
    [string]$RoundLabel = 'Verification rerun',
    [string[]]$Request = @(),
    [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = Join-Path $repoRoot 'workspace'
$collection = Join-Path $PSScriptRoot 'PBL6_API_Test_Report_Final.postman_collection.json'
$outputRoot = Join-Path $PSScriptRoot 'runs\api-report-final'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runOutput = Join-Path $outputRoot $timestamp
$runLog = Join-Path $runOutput 'postman-cli.log'
$postmanCli = Join-Path $env:APPDATA 'npm\postman.cmd'

foreach ($path in @($collection, $postmanCli)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file not found: $path"
    }
}
$collectionData = Get-Content -Raw -LiteralPath $collection | ConvertFrom-Json

if (-not $SkipHealthCheck) {
    $readyUri = "$($BaseUrl.TrimEnd('/'))/ready"
    try {
        $ready = Invoke-RestMethod -Method Get -Uri $readyUri -TimeoutSec 10
    }
    catch {
        throw "API is not ready at $readyUri. Start the local backend, then retry. $($_.Exception.Message)"
    }

    $mailpitUri = "$($MailpitUrl.TrimEnd('/'))/api/v1/messages"
    try {
        Invoke-RestMethod -Method Get -Uri $mailpitUri -TimeoutSec 10 | Out-Null
    }
    catch {
        throw "Mailpit is not reachable at $mailpitUri. Start the local Docker services, then retry. $($_.Exception.Message)"
    }
}

$holdFixture = @{
    TripId = '01990a00-0000-7000-8000-000000000007'
    Seat2A = '01990a00-0000-7000-8000-000000000043'
    Seat2B = '01990a00-0000-7000-8000-000000000044'
    Seat1B = '01990a00-0000-7000-8000-000000000022'
    Seat1C = '01990a00-0000-7000-8000-000000000023'
}
if ($Request.Count -eq 0) {
    $infraRoot = Join-Path $workspaceRoot 'src\infra'
    $fixtureSql = @"
SELECT t.trip_id::text || '|' || a.id::text || '|' || b.id::text || '|' || c.id::text || '|' || d.id::text
FROM trip_snapshots t
JOIN trip_seats a ON a.trip_id=t.trip_id AND a.seat_code='2A' AND a.status='AVAILABLE'
JOIN trip_seats b ON b.trip_id=t.trip_id AND b.seat_code='2B' AND b.status='AVAILABLE'
JOIN trip_seats c ON c.trip_id=t.trip_id AND c.seat_code='1B' AND c.status='AVAILABLE'
JOIN trip_seats d ON d.trip_id=t.trip_id AND d.seat_code='1C' AND d.status='AVAILABLE'
WHERE t.status='SCHEDULED' AND t.sellable AND t.departure_at > NOW()
  AND t.origin_stop_id_external='01990a00-0000-7000-8000-000000000004'
  AND t.destination_stop_id_external='01990a00-0000-7000-8000-000000000005'
ORDER BY CASE WHEN t.trip_id='01990a00-0000-7000-8000-000000000007' THEN 1 ELSE 0 END, t.departure_at
LIMIT 1;
"@
    Push-Location $infraRoot
    try {
        $fixtureOutput = & docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d booking -v ON_ERROR_STOP=1 -A -t -q -c $fixtureSql 2>&1
        $fixtureExitCode = $LASTEXITCODE
    }
    finally { Pop-Location }
    if ($fixtureExitCode -ne 0) { throw "Could not read local SeatHold fixtures: $($fixtureOutput -join ' ')" }
    $fixtureFields = (($fixtureOutput | Select-Object -Last 1).ToString().Trim()).Split('|')
    if ($fixtureFields.Count -ne 5) { throw 'No future sellable trip with AVAILABLE 2A, 2B, 1B and 1C seats was found in the local booking database.' }
    $holdFixture = @{ TripId = $fixtureFields[0]; Seat2A = $fixtureFields[1]; Seat2B = $fixtureFields[2]; Seat1B = $fixtureFields[3]; Seat1C = $fixtureFields[4] }
}

[System.IO.Directory]::CreateDirectory($runOutput) | Out-Null
$commonCliArgs = @(
    'collection', 'run', $collection,
    '--env-var', "apiOrigin=$($BaseUrl.TrimEnd('/'))",
    '--env-var', "baseUrl=$($BaseUrl.TrimEnd('/'))/api/v1",
    '--env-var', "mailpitUrl=$($MailpitUrl.TrimEnd('/'))",
    '--env-var', "holdTripId=$($holdFixture.TripId)",
    '--env-var', "seatId2A=$($holdFixture.Seat2A)",
    '--env-var', "seatId2B=$($holdFixture.Seat2B)",
    '--env-var', "seatId1B=$($holdFixture.Seat1B)",
    '--env-var', "seatId1C=$($holdFixture.Seat1C)",
    '--timeout', '1200000',
    '--timeout-script', '700000',
    '--no-report-events'
)

$script:PostmanFailures = 0
$script:PrintedLiveCases = @{}
$script:DeferredLiveCases = @('AUTH-06', 'AUTH-07') + (1..9 | ForEach-Object { 'BOOK-{0:D2}' -f $_ })
$script:LiveLogLines = [System.Collections.Generic.List[string]]::new()

function Get-LiveCasePassed {
    param([Parameter(Mandatory = $true)][string]$Id)

    $details = [System.Collections.Generic.List[object]]::new()
    $currentDetail = $null
    foreach ($line in $script:LiveLogLines) {
        if ($line -match '^Sub-folder\s+((?:AUTH|BOOK)-\d{2})\s*(?:-\s*)?(.+?)\s*$') {
            if ($Matches[1] -eq $Id) {
                $currentDetail = [pscustomobject]@{ Name = $Matches[2].Trim(); Passed = $false }
                $details.Add($currentDetail)
            }
            else { $currentDetail = $null }
            continue
        }
        if ($line -match '^Sub-folder\s+' -or $line -match '^Folder\s+') {
            $currentDetail = $null
            continue
        }
        if ($currentDetail -and $line -match '^\s*Pass\s+') { $currentDetail.Passed = $true }
        if ($line -match 'inside ".*?/\s*((?:AUTH|BOOK)-\d{2})\s+-\s+(.+?)"\s*$' -and $Matches[1] -eq $Id) {
            $failedName = $Matches[2].Trim()
            $failedDetail = $details | Where-Object { $_.Name -eq $failedName } | Select-Object -Last 1
            if ($failedDetail) { $failedDetail.Passed = $false }
        }
    }

    $passed = $details.Count -gt 0 -and @($details | Where-Object { -not $_.Passed }).Count -eq 0
    if ($Id -eq 'AUTH-06' -and -not ($details | Where-Object { $_.Name -eq 'Reject expired OTP fixture' -and $_.Passed })) { $passed = $false }
    if ($Id -eq 'BOOK-07' -and -not ($details | Where-Object { $_.Name -eq 'Reject hold on departed trip' -and $_.Passed })) { $passed = $false }
    if ($Id -eq 'BOOK-09' -and -not ($details | Where-Object { $_.Name -eq 'Read proactive hold after expiry fixture' -and $_.Passed })) { $passed = $false }
    return [bool]$passed
}

function Write-LiveCaseResult {
    param([Parameter(Mandatory = $true)][string]$Id)

    if ($script:PrintedLiveCases.ContainsKey($Id)) { return }
    $script:PrintedLiveCases[$Id] = $true
    $status = if (Get-LiveCasePassed -Id $Id) { 'PASS' } else { 'FAIL' }
    Write-Host ("{0}: {1}" -f $Id, $status)
}

function Write-LiveCaseResults {
    param([Parameter(Mandatory = $true)][string[]]$Ids)
    foreach ($id in $Ids) { Write-LiveCaseResult -Id $id }
}

function Invoke-PostmanPhase {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string[]]$Selection,
        [string[]]$ExtraArgs = @()
    )

    $phaseArgs = @($commonCliArgs) + @($Selection) + @($ExtraArgs)
    $liveCaseId = $null
    & $postmanCli @phaseArgs 2>&1 | Tee-Object -FilePath $runLog -Append | ForEach-Object {
        $line = $_.ToString()
        $script:LiveLogLines.Add($line)
        if ($line -match '^Sub-folder\s+((?:AUTH|BOOK)-\d{2})') {
            $nextCaseId = $Matches[1]
            if ($liveCaseId -and $liveCaseId -ne $nextCaseId -and $liveCaseId -notin $script:DeferredLiveCases) {
                Write-LiveCaseResult -Id $liveCaseId
            }
            $liveCaseId = $nextCaseId
        }
        elseif ($line -match '^Sub-folder\s+' -or $line -match '^Folder\s+') {
            if ($liveCaseId -and $liveCaseId -notin $script:DeferredLiveCases) { Write-LiveCaseResult -Id $liveCaseId }
            $liveCaseId = $null
        }
    }
    if ($liveCaseId -and $liveCaseId -notin $script:DeferredLiveCases) { Write-LiveCaseResult -Id $liveCaseId }
    $phaseExitCode = $LASTEXITCODE
    if ($phaseExitCode -ne 0) {
        $script:PostmanFailures++
        Add-Content -LiteralPath $runLog -Value "RUNNER WARNING: Postman CLI phase returned exit code $phaseExitCode; continuing to run later cases."
    }
}

if ($Request.Count -gt 0) {
    Write-Host 'Running selected API test request(s)...'
    $selection = @()
    foreach ($requestName in $Request) { $selection += @('-i', $requestName) }
    Invoke-PostmanPhase -Name "Running selected request(s): $($Request -join ', ')" -Selection $selection
    $selectedIds = [regex]::Matches([System.IO.File]::ReadAllText($runLog), 'Sub-folder\s+((?:AUTH|BOOK)-\d{2})') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    Write-LiveCaseResults -Ids @($selectedIds)
}
else {
    Write-Host 'Running API Test Report suite...'
    $authFolder = $collectionData.item | Where-Object { $_.name -eq 'Auth (AUTH-01 to AUTH-07)' } | Select-Object -First 1
    $bookingFolder = $collectionData.item | Where-Object { $_.name -eq 'SeatHold (BOOK-01 to BOOK-09)' } | Select-Object -First 1
    if (-not $authFolder -or -not $bookingFolder) {
        throw 'Expected Auth and SeatHold folders were not found in the Postman collection.'
    }

    $mainSelection = @()
    foreach ($item in $authFolder.item | Where-Object { $_.name -ne 'AUTH-06 - Reject expired OTP fixture' }) {
        $mainSelection += @('-i', $item.name)
    }
    foreach ($item in $bookingFolder.item | Where-Object { -not $_.name.StartsWith('BOOK-09') }) {
        $mainSelection += @('-i', $item.name)
    }
    Invoke-PostmanPhase -Name 'Phase 1/5: Run regular Auth cases and BOOK-01..08' -Selection $mainSelection

    $logText = [System.IO.File]::ReadAllText($runLog)
    $challengeParts = [regex]::Matches($logText, 'AUTH06_CHALLENGE_PART(\d+)=([0-9a-f-]+)') | Sort-Object { [int]$_.Groups[1].Value }
    $otpMatch = [regex]::Match($logText, 'AUTH06_CODE=([0-9]{6})')
    if ($challengeParts.Count -eq 0 -or -not $otpMatch.Success) {
        $script:PostmanFailures++
        Add-Content -LiteralPath $runLog -Value 'RUNNER WARNING: Could not read the test OTP fixture marker; skipped AUTH-06 expired-token verification.'
    }
    else {
        $challengeId = ($challengeParts | ForEach-Object { $_.Groups[2].Value }) -join ''
        $otpCode = $otpMatch.Groups[1].Value
        $authFixtureSql = "UPDATE auth_challenges SET expires_at = created_at + INTERVAL '1 millisecond' WHERE id = '$challengeId' AND status = 'ACTIVE' RETURNING id;"
        Push-Location (Join-Path $workspaceRoot 'src\infra')
        try {
            $authDbOutput = & docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d identity -v ON_ERROR_STOP=1 -A -t -q -c $authFixtureSql 2>&1
            $authDbExitCode = $LASTEXITCODE
        }
        finally { Pop-Location }
        $authDbOutput | Tee-Object -FilePath $runLog -Append | Out-Null
        if ($authDbExitCode -ne 0 -or ($authDbOutput -join "`n") -notmatch [regex]::Escape($challengeId)) {
            $script:PostmanFailures++
            Add-Content -LiteralPath $runLog -Value "RUNNER WARNING: Could not expire AUTH-06 challenge $challengeId in local PostgreSQL; skipped expired-OTP assertion."
        }
        else {
            $authExpiredSelection = @('-i', 'AUTH-06 - Reject expired OTP fixture')
            $authExpiredArgs = @('--env-var', "auth06ChallengeId=$challengeId", '--env-var', "auth06Otp=$otpCode")
            Invoke-PostmanPhase -Name 'Phase 2/5: Verify AUTH-06 expired OTP' -Selection $authExpiredSelection -ExtraArgs $authExpiredArgs
        }
    }

    $completedIds = @('AUTH-06', 'AUTH-07') + (1..8 | ForEach-Object { 'BOOK-{0:D2}' -f $_ })
    Write-LiveCaseResults -Ids $completedIds

    $book09Key = "codex-book09-lazy-$timestamp"
    $createSelection = @('-i', 'Setup - Login Customer 1', '-i', 'BOOK-09 - Create hold for accelerated expiry fixture')
    Invoke-PostmanPhase -Name 'Phase 3/5: Create a fresh BOOK-09 test hold' -Selection $createSelection -ExtraArgs @('--env-var', "book09IdempotencyKey=$book09Key")

    $logText = [System.IO.File]::ReadAllText($runLog)
    $tokenParts = [regex]::Matches($logText, 'BOOK09_PART(\d+)=([A-Za-z0-9_-]+)') | Sort-Object { [int]$_.Groups[1].Value }
    if ($tokenParts.Count -eq 0) {
        $script:PostmanFailures++
        Add-Content -LiteralPath $runLog -Value 'RUNNER WARNING: BOOK-09 hold token was not emitted; expiry fixture/readback could not run.'
    }
    else {
        $book09HoldToken = ($tokenParts | ForEach-Object { $_.Groups[2].Value }) -join ''

        $sql = "UPDATE seat_holds SET created_at = NOW() - INTERVAL '11 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE idempotency_key = '$book09Key' AND status = 'ACTIVE' RETURNING id;"
        Push-Location (Join-Path $workspaceRoot 'src\infra')
        try {
            $dbOutput = & docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d booking -v ON_ERROR_STOP=1 -A -t -q -c $sql 2>&1
            $dbExitCode = $LASTEXITCODE
        }
        finally { Pop-Location }
        $dbOutput | Tee-Object -FilePath $runLog -Append | Out-Null
        if ($dbExitCode -ne 0 -or ($dbOutput -join "`n") -notmatch '[0-9a-f]{8}-[0-9a-f-]{27,}') {
            $script:PostmanFailures++
            Add-Content -LiteralPath $runLog -Value 'RUNNER WARNING: Could not expire the new BOOK-09 hold in local PostgreSQL; skipped its readback assertions.'
        }
        else {
            $verifySelection = @('-i', 'Setup - Login Customer 1', '-i', 'BOOK-09 - Read seats after accelerated expiry fixture', '-i', 'BOOK-09 - Read hold after accelerated expiry fixture')
            Invoke-PostmanPhase -Name 'Phase 5/5: Verify BOOK-09 API expiry assertions' -Selection $verifySelection -ExtraArgs @('--env-var', "book09HoldToken=$book09HoldToken")

            $book09ProactiveKey = "codex-book09-proactive-$timestamp"
            $proactiveCreateSelection = @('-i', 'Setup - Login Customer 1', '-i', 'BOOK-09 - Create proactive hold fixture')
            Invoke-PostmanPhase -Name 'Create BOOK-09 hold for proactive worker check' -Selection $proactiveCreateSelection -ExtraArgs @('--env-var', "book09IdempotencyKey=$book09ProactiveKey")
            $logText = [System.IO.File]::ReadAllText($runLog)
            $proactiveParts = [regex]::Matches($logText, 'BOOK09_PROACTIVE_PART(\d+)=([A-Za-z0-9_-]+)') | Sort-Object { [int]$_.Groups[1].Value }
            if ($proactiveParts.Count -eq 0) {
                $script:PostmanFailures++
                Add-Content -LiteralPath $runLog -Value 'RUNNER WARNING: Proactive BOOK-09 hold token was not emitted; worker expiry check could not run.'
            }
            else {
                $proactiveToken = ($proactiveParts | ForEach-Object { $_.Groups[2].Value }) -join ''
                $proactiveSql = "UPDATE seat_holds SET created_at = NOW() - INTERVAL '11 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE idempotency_key = '$book09ProactiveKey' AND status = 'ACTIVE' RETURNING id;"
                Push-Location (Join-Path $workspaceRoot 'src\infra')
                try {
                    $proactiveDbOutput = & docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d booking -v ON_ERROR_STOP=1 -A -t -q -c $proactiveSql 2>&1
                    $proactiveDbExitCode = $LASTEXITCODE
                }
                finally { Pop-Location }
                $proactiveDbOutput | Tee-Object -FilePath $runLog -Append | Out-Null
                if ($proactiveDbExitCode -ne 0 -or ($proactiveDbOutput -join "`n") -notmatch '[0-9a-f]{8}-[0-9a-f-]{27,}') {
                    $script:PostmanFailures++
                    Add-Content -LiteralPath $runLog -Value 'RUNNER WARNING: Could not expire the proactive BOOK-09 test hold in local PostgreSQL.'
                }
                else {
                    $workerState = $null
                    $workerSql = "SELECT h.status || '|' || (h.released_at IS NOT NULL)::text || '|' || s.status FROM seat_holds h JOIN trip_seats s ON s.id = '$($holdFixture.Seat1B)' WHERE h.idempotency_key = '$book09ProactiveKey';"
                    for ($attempt = 0; $attempt -lt 20; $attempt++) {
                        Push-Location (Join-Path $workspaceRoot 'src\infra')
                        try {
                            $workerOutput = & docker compose -f docker-compose.yml -f docker-compose.apps.yml exec -T postgres psql -U platform -d booking -v ON_ERROR_STOP=1 -A -t -q -c $workerSql 2>&1
                            $workerExitCode = $LASTEXITCODE
                        }
                        finally { Pop-Location }
                        $workerState = ($workerOutput | Select-Object -Last 1).ToString().Trim()
                        if ($workerExitCode -eq 0 -and $workerState -eq 'EXPIRED|true|AVAILABLE') { break }
                        Start-Sleep -Seconds 1
                    }
                    if ($workerState -ne 'EXPIRED|true|AVAILABLE') {
                        $script:PostmanFailures++
                        Add-Content -LiteralPath $runLog -Value "RUNNER WARNING: Proactive worker did not expire/release the hold within 20 seconds (state: $workerState)."
                    }
                    else {
                        Add-Content -LiteralPath $runLog -Value "`nSub-folder BOOK-09 - Proactive worker sweep`n  Pass BOOK-09 worker set EXPIRED and released_at; seat 1B is AVAILABLE before API read`n"
                        $script:LiveLogLines.Add('Sub-folder BOOK-09 - Proactive worker sweep')
                        $script:LiveLogLines.Add('  Pass BOOK-09 worker set EXPIRED and released_at; seat 1B is AVAILABLE before API read')
                        $proactiveVerify = @('-i', 'Setup - Login Customer 1', '-i', 'BOOK-09 - Read seats after proactive expiry fixture', '-i', 'BOOK-09 - Read proactive hold after expiry fixture')
                        Invoke-PostmanPhase -Name 'Verify BOOK-09 proactive worker API results' -Selection $proactiveVerify -ExtraArgs @('--env-var', "book09ProactiveHoldToken=$proactiveToken")
                    }
                }
            }
        }
    }
}

if ($Request.Count -eq 0) { Write-LiveCaseResult -Id 'BOOK-09' }

if (-not (Test-Path -LiteralPath $runLog -PathType Leaf) -or (Get-Item -LiteralPath $runLog).Length -eq 0) {
    Write-Error "Postman CLI returned success but its captured output log is missing or empty: $runLog"
    exit 2
}

$caseResults = [ordered]@{}
$currentCaseId = $null
$currentDetail = $null
$unmappedFailure = $false
foreach ($line in [System.IO.File]::ReadAllLines($runLog)) {
    if ($line -match '^Sub-folder\s+((?:AUTH|BOOK)-\d{2})\s*(?:-\s*)?(.+?)\s*$') {
        $currentCaseId = $Matches[1]
        $detailName = $Matches[2].Trim()
        if (-not $caseResults.Contains($currentCaseId)) {
            $caseResults[$currentCaseId] = [System.Collections.Generic.List[object]]::new()
        }
        $currentDetail = [pscustomobject]@{
            Name = $detailName
            Passed = $false
            Assertion = $null
            Http = [System.Collections.Generic.List[string]]::new()
            Requests = [System.Collections.Generic.List[string]]::new()
            Errors = [System.Collections.Generic.List[string]]::new()
        }
        $caseResults[$currentCaseId].Add($currentDetail)
        continue
    }

    if ($line -match '^Sub-folder\s+' -or $line -match '^Folder\s+') {
        $currentCaseId = $null
        $currentDetail = $null
        continue
    }

    if ($null -ne $currentDetail -and $line -notmatch '(?:GET http://[^ ]+/ready|DELETE http://[^ ]+/api/v1/seat-holds/)') {
        foreach ($httpMatch in [regex]::Matches($line, '\[(\d{3})\s+([^,\]]+)')) {
            $httpResult = "$($httpMatch.Groups[1].Value) $($httpMatch.Groups[2].Value)"
            if (-not $currentDetail.Http.Contains($httpResult)) { $currentDetail.Http.Add($httpResult) }
        }
    }
    if ($null -ne $currentDetail -and $line -match '^\s*(GET|POST|PUT|PATCH|DELETE)\s+https?://.+') {
        $requestLine = $line.Trim()
        if (-not $currentDetail.Requests.Contains($requestLine)) { $currentDetail.Requests.Add($requestLine) }
    }
    if ($null -ne $currentDetail -and $line -match '^\s*Pass\s+') {
        $currentDetail.Passed = $true
        $currentDetail.Assertion = $line.Trim() -replace '^Pass\s+', ''
    }
    if ($null -ne $currentDetail -and $line -match '^\s*Fail\s+') {
        $currentDetail.Passed = $false
        $currentDetail.Errors.Add($line.Trim() -replace '^Fail\s+', '')
    }
    if ($line -match 'inside ".*?/\s*((?:AUTH|BOOK)-\d{2})\s+-\s+(.+?)"\s*$') {
        $failedId = $Matches[1]
        $failedName = $Matches[2].Trim()
        if ($caseResults.Contains($failedId)) {
            $failedDetail = $caseResults[$failedId] | Where-Object { $_.Name -eq $failedName } | Select-Object -Last 1
            if ($failedDetail) {
                $failedDetail.Passed = $false
                $failedDetail.Errors.Add($line.Trim())
            }
            else { $unmappedFailure = $true }
        }
        else { $unmappedFailure = $true }
    }
}

if ($Request.Count -eq 0) {
    $expectedIds = @((1..7 | ForEach-Object { 'AUTH-{0:D2}' -f $_ }) + (1..9 | ForEach-Object { 'BOOK-{0:D2}' -f $_ }))
    $parsedCaseResults = $caseResults
    $caseResults = [ordered]@{ }
    foreach ($id in $expectedIds) {
        if ($parsedCaseResults.Contains($id)) { $caseResults[$id] = $parsedCaseResults[$id] }
        else { $caseResults[$id] = [System.Collections.Generic.List[object]]::new() }
    }
}

$caseMetadata = [ordered]@{
    'AUTH-01' = @{ Name = 'Đăng ký tài khoản hợp lệ'; Expected = '202 Accepted; tài khoản PENDING_VERIFICATION; gửi OTP/email xác minh; response không chứa mật khẩu.' }
    'AUTH-02' = @{ Name = 'Đăng ký với email đã thuộc tài khoản đang hoạt động'; Expected = 'Từ chối bằng lỗi 4xx an toàn; không tạo tài khoản trùng.' }
    'AUTH-03' = @{ Name = 'Đăng ký với số điện thoại đã tồn tại'; Expected = 'Từ chối bằng lỗi 4xx an toàn; không tạo tài khoản trùng.' }
    'AUTH-04' = @{ Name = 'Đăng ký với dữ liệu không hợp lệ'; Expected = '400 VALIDATION_ERROR; nêu field và lý do; không tạo user.' }
    'AUTH-05' = @{ Name = 'Xác minh bằng OTP/token đúng'; Expected = 'Xác minh thành công; user được kích hoạt và đăng nhập được.' }
    'AUTH-06' = @{ Name = 'Xác minh bằng OTP sai / hết hạn'; Expected = 'OTP sai/hết hạn bị từ chối; user vẫn pending và không đăng nhập được.' }
    'AUTH-07' = @{ Name = 'Gửi lại OTP vượt giới hạn tần suất'; Expected = 'Vượt giới hạn trả 429 RATE_LIMITED kèm Retry-After.' }
    'BOOK-01' = @{ Name = 'Xem danh sách TripSeat và tình trạng'; Expected = '200; trả danh sách ghế với trạng thái AVAILABLE/HELD/BOOKED/DISABLED.' }
    'BOOK-02' = @{ Name = 'Giữ 1 ghế hợp lệ'; Expected = '201; trả holdToken, expiresAt, giá và policy snapshot; ghế 2A chuyển HELD.' }
    'BOOK-03' = @{ Name = 'Giữ nhiều ghế hợp lệ trong cùng yêu cầu'; Expected = '201; cả hai ghế HELD trong cùng một SeatHold.' }
    'BOOK-04' = @{ Name = 'Giữ nhiều ghế khi có 1 ghế không còn trống (all-or-nothing)'; Expected = '409 SEAT_UNAVAILABLE; request thất bại toàn bộ; ghế còn lại vẫn AVAILABLE.' }
    'BOOK-05' = @{ Name = 'Hai khách giữ cùng 1 ghế đồng thời'; Expected = 'Đúng một request thành công; request còn lại 409; không giữ trùng ghế.' }
    'BOOK-06' = @{ Name = 'Giữ ghế khi chưa đăng nhập'; Expected = '401 AUTHENTICATION_REQUIRED; không tạo SeatHold.' }
    'BOOK-07' = @{ Name = 'Giữ ghế của chuyến không còn bán'; Expected = '409 TRIP_NOT_SELLABLE cho chuyến CANCELLED và DEPARTED; không tạo SeatHold.' }
    'BOOK-08' = @{ Name = 'Gửi lặp cùng Idempotency-Key và cùng nội dung'; Expected = 'Trả lại cùng SeatHold; không tạo SeatHold mới.' }
    'BOOK-09' = @{ Name = 'SeatHold hết hạn được giải phóng tự động'; Expected = 'Cả lazy và proactive path: hold EXPIRED, released_at có giá trị, ghế AVAILABLE.' }
}

$summaryLines = [System.Collections.Generic.List[string]]::new()
$caseOutcomes = [ordered]@{}
$passedCases = 0
$totalCases = $caseResults.Count
foreach ($id in $caseResults.Keys) {
    $details = $caseResults[$id]
    $casePassed = $details.Count -gt 0 -and (@($details | Where-Object { -not $_.Passed }).Count -eq 0)
    $caseOutcomes[$id] = $casePassed
    if ($casePassed) { $passedCases++ }
}
$overallPassed = $script:PostmanFailures -eq 0 -and -not $unmappedFailure -and $passedCases -eq $totalCases
$summaryLines.Add("# Kết quả kiểm thử API")
$summaryLines.Add('')
$summaryLines.Add("**Tổng kết: $(if ($overallPassed) { 'PASS' } else { 'FAIL' }) — $passedCases/$totalCases test case đạt.**")
$summaryLines.Add('')
$summaryLines.Add('| Mã TC | Tên test case | Kết quả mong đợi | Kết quả trả về | Pass/Fail |')
$summaryLines.Add('|---|---|---|---|---|')
foreach ($id in $caseResults.Keys) {
    $details = $caseResults[$id]
    $metadata = $caseMetadata[$id]
    $actualParts = [System.Collections.Generic.List[string]]::new()
    foreach ($detail in $details) {
        $http = if ($detail.Http.Count -gt 0) { 'HTTP ' + ($detail.Http -join ', ') } else { 'Không ghi nhận HTTP status' }
        $assertion = if ($detail.Assertion) { '; ' + $detail.Assertion } else { '' }
        $bullet = if ($details.Count -gt 1) { '&bull; ' } else { '' }
        $actualParts.Add("$bullet$($detail.Name): $http$assertion")
    }
    $actual = ($actualParts -join '<br>').Replace('|', '\|')
    $expected = ([string]$metadata.Expected).Replace('|', '\|')
    $name = ([string]$metadata.Name).Replace('|', '\|')
    $status = if ($caseOutcomes[$id]) { 'PASS' } else { 'FAIL' }
    $summaryLines.Add("| $id | $name | $expected | $actual | $status |")
}
if ($script:PostmanFailures -gt 0 -or $unmappedFailure) {
    $summaryLines.Add('FAIL Runner/fixture phase')
}

# Keep request outcomes in the detailed log, but remove Postman CLI's repeated
# per-phase totals and cloud-publishing notices; the concise summary is the report.
$rawLogLines = [System.IO.File]::ReadAllLines($runLog)
$cleanLogLines = [System.Collections.Generic.List[string]]::new()
for ($lineIndex = 0; $lineIndex -lt $rawLogLines.Length; $lineIndex++) {
    if ($rawLogLines[$lineIndex] -match '^\s*-{20,}\s*$' -and $lineIndex + 1 -lt $rawLogLines.Length -and $rawLogLines[$lineIndex + 1] -match '\bexecuted\b.*\bfailed\b') {
        $lineIndex++
        while ($lineIndex -lt $rawLogLines.Length) {
            if ($rawLogLines[$lineIndex] -match 'average response time') {
                $lineIndex++
                if ($lineIndex -lt $rawLogLines.Length -and $rawLogLines[$lineIndex] -match '^\s*-{20,}\s*$') { }
                break
            }
            $lineIndex++
        }
        continue
    }
    if ($rawLogLines[$lineIndex] -match 'Publishing run details to postman cloud|^Refer: https://go\.pstmn\.io/postman-cli-faq') { continue }
    $cleanLogLines.Add($rawLogLines[$lineIndex])
}
[System.IO.File]::WriteAllLines($runLog, $cleanLogLines, [System.Text.UTF8Encoding]::new($false))

$summaryPath = Join-Path $runOutput 'test-summary.md'
$summaryLines.Insert(1, "**Vòng chạy: $RoundLabel**")
[System.IO.File]::WriteAllLines($summaryPath, $summaryLines, [System.Text.UTF8Encoding]::new($false))

$caseRows = [System.Collections.Generic.List[object]]::new()
$logRows = [System.Collections.Generic.List[object]]::new()
foreach ($id in $caseResults.Keys) {
    $details = $caseResults[$id]
    $metadata = $caseMetadata[$id]
    $functionName = if ($id.StartsWith('AUTH-')) { 'Đăng ký & kích hoạt tài khoản' } else { 'Xem ghế & giữ ghế (SeatHold)' }
    $actualParts = [System.Collections.Generic.List[string]]::new()
    foreach ($detail in $details) {
        $http = if ($detail.Http.Count -gt 0) { 'HTTP ' + ($detail.Http -join ', ') } else { 'Không ghi nhận HTTP status' }
        $assertion = if ($detail.Assertion) { '; ' + $detail.Assertion } else { '' }
        $actualParts.Add("$($detail.Name): $http$assertion")
        $errorText = if ($detail.Errors.Count -gt 0) { $detail.Errors -join ' | ' } elseif (-not $detail.Passed) { 'Assertion không đạt; xem postman-cli.log.' } else { '' }
        $logRows.Add([ordered]@{
            Round = $RoundLabel
            Function = $functionName
            TestCase = $id
            Result = if ($detail.Passed) { 'Passed' } else { 'Failed' }
            Assertion = [string]$detail.Assertion
            Error = $errorText
            Request = $detail.Requests -join ' | '
        })
    }
    $caseRows.Add([ordered]@{
        Round = $RoundLabel
        Function = $functionName
        TestCase = $id
        Name = [string]$metadata.Name
        Expected = [string]$metadata.Expected
        Actual = $actualParts -join ' | '
        Result = if ($caseOutcomes[$id]) { 'Passed' } else { 'Failed' }
    })
}
$excelPayload = [ordered]@{
    round = $RoundLabel
    generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
    totalCases = $totalCases
    passed = $passedCases
    failed = $totalCases - $passedCases
    pending = 0
    cases = @($caseRows)
    logs = @($logRows)
}
$payloadPath = Join-Path $env:TEMP "pbl6-api-report-$timestamp.json"
$excelPath = Join-Path $runOutput 'api-test-log.xlsx'
$exporterPath = Join-Path $PSScriptRoot 'export-api-test-report.py'
if (-not (Test-Path -LiteralPath $exporterPath -PathType Leaf)) { throw "Excel exporter not found: $exporterPath" }
[System.IO.File]::WriteAllText($payloadPath, ($excelPayload | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
$pythonCommand = Get-Command python -ErrorAction Stop
& $pythonCommand.Source $exporterPath --input-json $payloadPath --output $excelPath
$excelExitCode = $LASTEXITCODE
Remove-Item -LiteralPath $payloadPath -Force -ErrorAction SilentlyContinue
if ($excelExitCode -ne 0 -or -not (Test-Path -LiteralPath $excelPath -PathType Leaf)) {
    throw 'Could not create the API Excel report.'
}
$resultLabel = if ($overallPassed) { "PASS — $passedCases/$totalCases test case" } else { "FAIL — $passedCases/$totalCases test case passed" }
Write-Host $resultLabel
Write-Host "Report: $summaryPath"
Write-Host "Log: $runLog"
Write-Host "Excel: $excelPath"
if ($script:PostmanFailures -gt 0) {
    Write-Host 'Runner: FAIL (xem log để biết chi tiết)'
    exit 1
}
if ($unmappedFailure -or $passedCases -ne $totalCases) { exit 1 }
exit 0
