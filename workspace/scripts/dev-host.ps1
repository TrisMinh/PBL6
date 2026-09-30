$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$infra = Join-Path $root "src\infra"

Push-Location $infra
try {
  docker compose up -d --wait
}
finally {
  Pop-Location
}

& (Join-Path $PSScriptRoot "apply-dev-seed.ps1")

$envScript = Join-Path $PSScriptRoot "dev-env.ps1"
. $envScript
Set-PlatformEnv

$apis = @(
  @{ Project = "src/gateway/BusTicketPlatform.Gateway/BusTicketPlatform.Gateway.csproj"; Live = "http://localhost:5080/live" },
  @{ Project = "src/services/identity/BusTicketPlatform.Identity.Api/BusTicketPlatform.Identity.Api.csproj"; Live = "http://localhost:5081/live" },
  @{ Project = "src/services/transport/BusTicketPlatform.Transport.Api/BusTicketPlatform.Transport.Api.csproj"; Live = "http://localhost:5082/live" },
  @{ Project = "src/services/booking/BusTicketPlatform.Booking.Api/BusTicketPlatform.Booking.Api.csproj"; Live = "http://localhost:5083/live" },
  @{ Project = "src/services/payment/BusTicketPlatform.Payment.Api/BusTicketPlatform.Payment.Api.csproj"; Live = "http://localhost:5084/live" },
  @{ Project = "src/services/notification/BusTicketPlatform.Notification.Api/BusTicketPlatform.Notification.Api.csproj"; Live = "http://localhost:5085/live" },
  @{ Project = "src/services/reporting/BusTicketPlatform.Reporting.Api/BusTicketPlatform.Reporting.Api.csproj"; Live = "http://localhost:5086/live" }
)

foreach ($api in $apis) {
  if (Test-Http $api.Live) {
    Write-Host "already up $($api.Live)"
    continue
  }
  Write-Host "starting $($api.Project)"
  Start-Process -FilePath "dotnet" -WorkingDirectory $root -ArgumentList @("run", "--no-launch-profile", "--project", $api.Project, "--urls", ($api.Live -replace "/live", "")) -WindowStyle Hidden
}

$deadline = (Get-Date).AddMinutes(2)
foreach ($api in $apis) {
  while (-not (Test-Http $api.Live)) {
    if ((Get-Date) -gt $deadline) { throw "timeout waiting for $($api.Live)" }
    Start-Sleep -Seconds 2
  }
  Write-Host "ready $($api.Live)"
}

Write-Host "Gateway http://localhost:5080"
Write-Host "Customer http://localhost:5173  (npm run dev:customer)"
Write-Host "Backoffice http://localhost:5174 (npm run dev:backoffice)"
Write-Host "Seed customer seed.customer@example.test / CustomerPass1"
Write-Host "Seed operator operator.seed@example.test / OperatorPass1"
