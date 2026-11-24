#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipCompleted,
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = 'pbl6-operating',
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.-]*$')]
    [string]$Container = "$ProjectName-postgres-1"
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$source = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'docs/database/operating-demo'
$remotePath = '/tmp/pbl6-operating-demo-' + [Guid]::NewGuid().ToString('N')
$databases = @('identity', 'transport', 'booking', 'payment', 'reporting', 'notification')
$files = @('common.sql', 'finance-common.sql', 'verify.sql') + @($databases | ForEach-Object { "$_.sql" })

function Invoke-LocalDocker {
    & docker.exe @args
    if ($LASTEXITCODE -ne 0) { throw "Docker $($args[0]) failed with exit code $LASTEXITCODE." }
}

function Invoke-AdminSql([string]$Sql) {
    Invoke-LocalDocker exec $container psql -XqAt -U platform -d postgres -v ON_ERROR_STOP=1 -c $Sql
}

$running = Invoke-LocalDocker ps --no-trunc --filter "label=com.docker.compose.project=$ProjectName" --filter 'label=com.docker.compose.service=postgres' --filter 'health=healthy' --format '{{.ID}} {{.Names}}'
if (-not ($running -split ' ' -contains $Container)) {
    throw "Start the healthy $ProjectName PostgreSQL service first."
}

$mutex = [Threading.Mutex]::new($false, "PBL6-OperatingDemo-v1-$ProjectName")
$locked = $false
$copied = $false
try {
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { throw 'An operating demo load is already running.' }
    foreach ($file in $files) {
        if (-not (Test-Path -LiteralPath (Join-Path $source $file) -PathType Leaf)) {
            throw "Missing operating demo file $file."
        }
    }

    if (-not $DryRun) {
        Invoke-AdminSql @'
CREATE SCHEMA IF NOT EXISTS pbl6_demo_seed;
CREATE TABLE IF NOT EXISTS pbl6_demo_seed.snapshots (
    name text PRIMARY KEY, anchor timestamptz NOT NULL, completed_at timestamptz
);
INSERT INTO pbl6_demo_seed.snapshots(name,anchor)
VALUES ('operating-v1',date_trunc('hour',clock_timestamp()))
ON CONFLICT DO NOTHING;
'@
    }

    $exists = Invoke-AdminSql "SELECT to_regclass('pbl6_demo_seed.snapshots') IS NOT NULL"
    $anchor = $null
    $complete = $null
    if ($exists -eq 't') {
        if ($SkipCompleted -and -not $DryRun) {
            $complete = Invoke-AdminSql "SELECT completed_at IS NOT NULL FROM pbl6_demo_seed.snapshots WHERE name='operating-v1'"
            $adminReady = Invoke-LocalDocker exec $container psql -XqAt -U platform -d identity -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.email='admin@demo.blue.example.test' AND r.code='PLATFORM_ADMIN' AND ur.active)"
            if ($complete -eq 't' -and $adminReady -eq 't') {
                Write-Host 'Operating demo dataset is already loaded.'
                return
            }
        }
        $anchor = Invoke-AdminSql "SELECT to_char(anchor AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') || '+00' FROM pbl6_demo_seed.snapshots WHERE name='operating-v1'"
    }
    if (-not $anchor) {
        $anchor = Invoke-AdminSql "SELECT to_char(date_trunc('hour',clock_timestamp()) AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') || '+00'"
    }
    if ($anchor -notmatch '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00$') { throw 'Invalid seed timestamp.' }

    Invoke-LocalDocker exec $container mkdir -m 700 $remotePath
    $copied = $true
    foreach ($file in $files) {
        Invoke-LocalDocker cp (Join-Path $source $file) "${container}:${remotePath}/$file"
    }

    $ending = if ($DryRun) { 'ROLLBACK' } else { 'COMMIT' }
    Write-Host "Operating demo anchor $anchor. Transactions will $ending."
    foreach ($database in $databases) {
        if ($SkipCompleted -and -not $DryRun -and $complete -eq 't' -and $database -ne 'identity') { continue }
        $withOrders = if ($database -in @('identity','transport')) { 'false' } else { 'true' }
        Write-Host "Loading and checking $database ..."
        $psql = @('exec', $container, 'psql', '-Xq', '-v', 'ON_ERROR_STOP=1',
            '-v', "anchor=$anchor", '-v', "with_orders=$withOrders", '-v', "demo_database=$database",
            '-U', 'platform', '-d', $database, '-c', 'BEGIN',
            '-c', "SET LOCAL lock_timeout='8s'; SET LOCAL statement_timeout='180s';",
            '-f', "$remotePath/$database.sql", '-c', 'SET CONSTRAINTS ALL IMMEDIATE',
            '-f', "$remotePath/verify.sql", '-c', $ending)
        Invoke-LocalDocker @psql
    }
    if (-not $DryRun) {
        Invoke-AdminSql "UPDATE pbl6_demo_seed.snapshots SET completed_at=COALESCE(completed_at,clock_timestamp()) WHERE name='operating-v1'"
    }
} finally {
    try {
        if ($copied) {
            $remoteFiles = @($files | ForEach-Object { "$remotePath/$_" })
            Invoke-LocalDocker exec $container rm -f -- @remoteFiles
            Invoke-LocalDocker exec $container rmdir -- $remotePath
        }
    } finally {
        if ($locked) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}
