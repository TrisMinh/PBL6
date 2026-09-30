$ErrorActionPreference = "Stop"
$workspace = Split-Path $PSScriptRoot -Parent
Set-Location $workspace
dotnet test "$workspace\BusTicketPlatform.sln" --nologo
