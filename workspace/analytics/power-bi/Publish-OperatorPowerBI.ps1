#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$WorkspaceId,
    [Parameter(Mandatory)][string]$Package,
    [ValidateNotNullOrEmpty()][string]$Name = 'BLUE Operator Live'
)

$ErrorActionPreference = 'Stop'
if (-not $env:BLUE_POWERBI_ACCESS_TOKEN) {
    throw 'Set BLUE_POWERBI_ACCESS_TOKEN to an authorized Microsoft token.'
}
$headers = @{ Authorization = "Bearer $env:BLUE_POWERBI_ACCESS_TOKEN" }
$origin = 'https://api.fabric.microsoft.com'
$workspace = "$origin/v1/workspaces/$WorkspaceId"

function New-FabricItem {
    param([string]$Type, [string]$Name, [string]$Format, [array]$Parts)
    $items = Invoke-RestMethod -Uri "$workspace/items?type=$Type" -Headers $headers -TimeoutSec 30
    $matching = @($items.value | Where-Object displayName -ceq $Name)
    if ($matching.Count -gt 1) { throw "Multiple $Type items match $Name." }
    if ($matching.Count -eq 1) { return [guid]$matching[0].id }

    $body = @{ type = $Type; displayName = $Name; definition = @{ parts = $Parts } }
    if ($Format) { $body.definition.format = $Format }
    $response = Invoke-WebRequest -Method Post -Uri "$workspace/items" -Headers $headers `
        -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 60
    if ($response.StatusCode -in 200, 201) { return [guid]($response.Content | ConvertFrom-Json).id }
    if ($response.StatusCode -ne 202) { throw "Unexpected status $($response.StatusCode) for $Name." }
    $operation = [string]($response.Headers['x-ms-operation-id'] | Select-Object -First 1)
    $operationId = [guid]::Empty
    if (-not [guid]::TryParse($operation, [ref]$operationId)) { throw "No operation ID returned for $Name." }
    $operationUrl = "$origin/v1/operations/$operationId"
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        $status = Invoke-RestMethod -Uri $operationUrl -Headers $headers -TimeoutSec 30
        if ($status.status -eq 'Succeeded') {
            $result = Invoke-RestMethod -Uri "$operationUrl/result" -Headers $headers -TimeoutSec 30
            return [guid]$result.id
        }
        if ($status.status -in 'Failed', 'Cancelled') {
            throw "Fabric could not create $Name. $($status.error.errorCode) $($status.error.message)"
        }
    }
    throw "Fabric operation $operationId did not finish in time."
}

function Convert-DefinitionParts {
    param([string]$Folder, [guid]$DatasetId = [guid]::Empty)
    foreach ($entry in $zip.Entries) {
        if (-not $entry.FullName.StartsWith("$Folder/") -or -not $entry.Name) { continue }
        $relative = $entry.FullName.Substring($Folder.Length + 1)
        $stream = $entry.Open()
        try {
            $buffer = [IO.MemoryStream]::new()
            try {
                $stream.CopyTo($buffer)
                $bytes = $buffer.ToArray()
            } finally { $buffer.Dispose() }
        } finally { $stream.Dispose() }
        if ($relative -eq 'model.bim') {
            $model = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
            if ($model.model.expressions.name -contains 'UseDemoData') {
                throw 'Use a PostgreSQL-only package generated with --live.'
            }
        }
        if ($relative -eq 'definition.pbir') {
            $report = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json -AsHashtable
            $report.datasetReference = @{ byConnection = @{ connectionString = "semanticmodelid=$DatasetId" } }
            $bytes = [Text.Encoding]::UTF8.GetBytes(($report | ConvertTo-Json -Depth 8 -Compress))
        }
        @{ path = $relative; payload = [Convert]::ToBase64String($bytes); payloadType = 'InlineBase64' }
    }
}

$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Package).Path)
try {
    $modelParts = @(Convert-DefinitionParts 'OperatorDashboard.SemanticModel')
    if ($modelParts.path -notcontains 'model.bim' -or $modelParts.path -notcontains 'definition.pbism') {
        throw 'Missing required semantic model definition parts.'
    }
    $datasetId = New-FabricItem 'SemanticModel' $Name 'TMSL' $modelParts
    $reportParts = @(Convert-DefinitionParts 'OperatorDashboard.Report' $datasetId)
    if ($reportParts.path -notcontains 'definition.pbir' -or $reportParts.path -notcontains 'definition/report.json') {
        throw 'Missing required report definition parts.'
    }
    $reportId = New-FabricItem 'Report' $Name '' $reportParts
    [pscustomobject]@{ WorkspaceId = $WorkspaceId; DatasetId = $datasetId; ReportId = $reportId }
} finally { $zip.Dispose() }
