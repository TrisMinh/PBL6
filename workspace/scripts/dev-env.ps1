$ErrorActionPreference = "Stop"

function Set-PlatformEnv {
  $pg = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }
  $amqpUser = "platform"
  $amqpPass = if ($env:RABBITMQ_PASSWORD) { $env:RABBITMQ_PASSWORD } else { "guest" }
  $env:ASPNETCORE_ENVIRONMENT = "Development"
  $env:ConnectionStrings__Identity = "Host=localhost;Port=5432;Database=identity;Username=platform;Password=$pg"
  $env:ConnectionStrings__Transport = "Host=localhost;Port=5432;Database=transport;Username=platform;Password=$pg"
  $env:ConnectionStrings__Booking = "Host=localhost;Port=5432;Database=booking;Username=platform;Password=$pg"
  $env:ConnectionStrings__Payment = "Host=localhost;Port=5432;Database=payment;Username=platform;Password=$pg"
  $env:ConnectionStrings__Notification = "Host=localhost;Port=5432;Database=notification;Username=platform;Password=$pg"
  $env:ConnectionStrings__Reporting = "Host=localhost;Port=5432;Database=reporting;Username=platform;Password=$pg"
  $env:MESSAGING__AMQPURI = "amqp://${amqpUser}:${amqpPass}@localhost:5672/bus-ticket"
  $env:Smtp__Host = "localhost"
  $env:Smtp__Port = "1025"
  $env:Authentication__SigningKey = if ($env:JWT_SIGNING_KEY) { $env:JWT_SIGNING_KEY } else { "local-dev-only-change-me-32bytes-min" }
}

function Test-Http($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-Api($project, $url) {
  if (Test-Http $url) {
    Write-Host "already up $url"
    return
  }
  $root = Split-Path -Parent $PSScriptRoot
  Write-Host "starting $project"
  Start-Process -FilePath "dotnet" -WorkingDirectory $root -ArgumentList @("run", "--project", $project, "--launch-profile", "http", "--no-launch-profile") -WindowStyle Hidden
}
