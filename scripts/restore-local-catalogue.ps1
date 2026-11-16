param([string]$BaseUrl = 'http://localhost:5080')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$sql=Join-Path $repoRoot 'docs/database/transport/015_local_customer_catalogue.sql'
$env:PGCLIENTENCODING='UTF8'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
Get-Content -LiteralPath $sql -Raw -Encoding utf8 | docker exec -i pbl6-local-postgres-1 psql -v ON_ERROR_STOP=1 -U platform -d transport | Out-Null
if($LASTEXITCODE -ne 0){throw 'Catalogue import failed.'}
# Development fixture account, never a production credential.
$login=Invoke-RestMethod "$BaseUrl/api/v1/auth/login" -Method Post -ContentType application/json -Body '{"identifier":"operator.seed@example.test","password":"OperatorPass1"}'
$token=$login.accessToken
if(-not $token){throw 'Local fixture operator unavailable.'}
$ids=@(docker exec pbl6-local-postgres-1 psql -U platform -d transport -tA -c "SELECT t.id FROM trips t JOIN buses b ON b.id=t.bus_id WHERE b.plate_number LIKE 'DM2-%' AND t.status='DRAFT' ORDER BY t.departure_at;")
foreach($id in $ids){
 if(-not $id.Trim()){continue}
 Invoke-RestMethod "$BaseUrl/api/v1/operator/trips/$id/publish" -Method Post -ContentType application/json -Headers @{Authorization="Bearer $token";'Idempotency-Key'="catalogue-publish-$id"} -Body '{"expectedVersion":0}' | Out-Null
}
Write-Host "Published $($ids.Count) local demonstration trips through the real outbox/inventory flow. Existing records preserved."
