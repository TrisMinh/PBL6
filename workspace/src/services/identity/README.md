# Identity Service

Identity uses EF Core Code First migrations stored in
`BusTicketPlatform.Identity.Infrastructure/Persistence/Migrations`.

## Apply migrations

Migrations are applied automatically when Identity API starts:

```powershell
docker compose --env-file .env.example --profile identity up -d --build
```

An existing database created by the former `001_initial.sql` migration is baselined automatically.
The initial EF migration is recorded in `__EFMigrationsHistory` without recreating tables or deleting data.

## Add a migration

Run from `workspace/`:

```powershell
docker run --rm -v "${PWD}:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0.401 sh -lc "dotnet tool install --tool-path /tmp/ef dotnet-ef --version 10.0.4 >/dev/null && /tmp/ef/dotnet-ef migrations add MigrationName --project src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj --startup-project src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj --context IdentityDbContext --output-dir Persistence/Migrations"
```

## Generate an idempotent deployment script

```powershell
docker run --rm -v "${PWD}:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0.401 sh -lc "dotnet tool install --tool-path /tmp/ef dotnet-ef --version 10.0.4 >/dev/null && /tmp/ef/dotnet-ef migrations script --idempotent --project src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj --startup-project src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj --context IdentityDbContext"
```

Set `ConnectionStrings__IdentityDatabase` when applying migrations directly to a database outside Docker Compose.
