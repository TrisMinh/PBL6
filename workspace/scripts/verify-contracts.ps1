$ErrorActionPreference = "Stop"
$workspace = Split-Path $PSScriptRoot -Parent
Set-Location $workspace
dotnet test "$workspace\src\tests\contracts\BusTicketPlatform.ContractTests\BusTicketPlatform.ContractTests.csproj" --nologo
