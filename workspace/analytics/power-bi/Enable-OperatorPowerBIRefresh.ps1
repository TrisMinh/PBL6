#Requires -Version 7.0
[CmdletBinding()]
param(
    [guid]$WorkspaceId = [guid]::Empty,
    [Parameter(Mandatory)][guid]$DatasetId,
    [Parameter(Mandatory)][guid]$ReportId,
    [Parameter(Mandatory)][guid]$GatewayId,
    [Parameter(Mandatory)][guid]$BookingDatasourceId,
    [Parameter(Mandatory)][guid]$ReportingDatasourceId,
    [ValidatePattern('^(?:[01][0-9]|2[0-3]):(?:00|30)$')][string]$RefreshTime = '06:00',
    [ValidateRange(1, 60)][int]$TimeoutMinutes = 15
)

$ErrorActionPreference = 'Stop'
if (-not $env:BLUE_POWERBI_ACCESS_TOKEN) {
    throw 'An authorized Power BI API token is required in BLUE_POWERBI_ACCESS_TOKEN.'
}
if ($BookingDatasourceId -eq $ReportingDatasourceId) {
    throw 'Booking and Reporting require distinct gateway data sources.'
}
$headers = @{ Authorization = "Bearer $env:BLUE_POWERBI_ACCESS_TOKEN" }
$workspace = "https://api.powerbi.com/v1.0/myorg"
if ($WorkspaceId -ne [guid]::Empty) { $workspace += "/groups/$WorkspaceId" }
$dataset = "$workspace/datasets/$DatasetId"
function Invoke-PowerBI {
    param([string]$Method, [string]$Uri, [hashtable]$Body)
    $request = @{ Method = $Method; Uri = $Uri; Headers = $headers; TimeoutSec = 45 }
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = ConvertTo-Json -InputObject $Body -Depth 6 -Compress
    }
    Invoke-RestMethod @request
}

$report = Invoke-PowerBI Get "$workspace/reports/$ReportId"
if ($report.datasetId -ne [string]$DatasetId) {
    throw 'The report is not connected to the specified semantic model.'
}
$parameters = Invoke-PowerBI Get "$dataset/parameters"
$demoParameter = $parameters.value | Where-Object name -ceq 'UseDemoData' | Select-Object -First 1
if ($demoParameter -and $demoParameter.currentValue -ine 'false') {
    throw 'Disable the demo data parameter before refreshing the live model.'
}
$sources = @( (Invoke-PowerBI Get "$dataset/datasources").value )
if ($sources.Count -ne 2 -or @($sources | Where-Object datasourceType -ne 'PostgreSql').Count) {
    throw 'Expected two PostgreSQL sources in the deployed semantic model.'
}
$null = Invoke-PowerBI Post "$dataset/Default.BindToGateway" @{
    gatewayObjectId = [string]$GatewayId
    datasourceObjectIds = @([string]$BookingDatasourceId, [string]$ReportingDatasourceId)
}

$refresh = Invoke-WebRequest -Method Post -Uri "$dataset/refreshes" -Headers $headers -ContentType 'application/json' -Body '{"notifyOption":"NoNotification"}' -TimeoutSec 45
$requestId = [string]($refresh.Headers['RequestId'] | Select-Object -First 1)
if (-not $requestId) {
    $location = [string]($refresh.Headers['Location'] | Select-Object -First 1)
    if ($location) { $requestId = ($location.TrimEnd('/') -split '/')[-1] }
}
if (-not $requestId) { throw 'Refresh was submitted but Power BI returned no correlation ID.' }
$deadline = [DateTimeOffset]::UtcNow.AddMinutes($TimeoutMinutes)
do {
    $history = Invoke-PowerBI Get "$dataset/refreshes?`$top=20"
    $result = $history.value | Where-Object requestId -eq $requestId | Select-Object -First 1
    if ($result.status -eq 'Completed') { break }
    if ($result.status -in @('Failed', 'Disabled', 'Cancelled')) {
        throw "Power BI refresh $requestId ended with status $($result.status). Check the refresh history."
    }
    Start-Sleep -Seconds 5
} while ([DateTimeOffset]::UtcNow -lt $deadline)
if ($result.status -ne 'Completed') { throw "Refresh $requestId was not verified before the timeout." }

$null = Invoke-PowerBI Patch "$dataset/refreshSchedule" @{
    value = @{
        enabled = $true
        days = @('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
        times = @($RefreshTime)
        localTimeZoneId = 'SE Asia Standard Time'
    }
}
$embedUrl = "https://app.powerbi.com/reportEmbed?reportId=$ReportId&autoAuth=true"
if ($WorkspaceId -ne [guid]::Empty) { $embedUrl += "&groupId=$WorkspaceId" }
[pscustomobject]@{
    VerifiedRefreshId = $requestId
    DailyRefreshVietnamTime = $RefreshTime
    EmbedUrl = $embedUrl
}
