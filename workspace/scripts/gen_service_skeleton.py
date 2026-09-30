from pathlib import Path

ROOT = Path(r"c:\Users\minht\OneDrive\Desktop\PBL6\workspace")
SRC = ROOT / "src"
DOCS = ROOT.parent / "docs" / "database"

SERVICES = {
    "transport": ("Transport", "5082", "sql.transport"),
    "booking": ("Booking", "5083", "sql.booking"),
    "payment": ("Payment", "5084", "sql.payment"),
    "notification": ("Notification", "5085", "sql.notification"),
    "reporting": ("Reporting", "5086", "sql.reporting"),
}


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.replace("\n", "\r\n") if False else content, encoding="utf-8", newline="\n")


def emit(slug: str, name: str, port: str, sql_logical: str) -> None:
    svc = SRC / "services" / slug
    domain = svc / f"BusTicketPlatform.{name}.Domain"
    app = svc / f"BusTicketPlatform.{name}.Application"
    infra = svc / f"BusTicketPlatform.{name}.Infrastructure"
    api = svc / f"BusTicketPlatform.{name}.Api"
    tests = SRC / "tests" / slug / f"BusTicketPlatform.{name}.Api.IntegrationTests"

    write(domain / f"BusTicketPlatform.{name}.Domain.csproj", f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>BusTicketPlatform.{name}.Domain</RootNamespace>
    <Description>{name} bounded-context domain. No ASP.NET, EF Core or provider SDKs.</Description>
  </PropertyGroup>
</Project>
""")
    write(domain / "AssemblyMarker.cs", f"""namespace BusTicketPlatform.{name}.Domain;

public static class AssemblyMarker;
""")

    write(app / f"BusTicketPlatform.{name}.Application.csproj", f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>BusTicketPlatform.{name}.Application</RootNamespace>
    <Description>{name} use cases and ports. No controllers or ORM mapping.</Description>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\\BusTicketPlatform.{name}.Domain\\BusTicketPlatform.{name}.Domain.csproj" />
    <ProjectReference Include="..\\..\\..\\building-blocks\\BusTicketPlatform.BuildingBlocks\\BusTicketPlatform.BuildingBlocks.csproj" />
  </ItemGroup>
</Project>
""")
    write(app / "AssemblyMarker.cs", f"""namespace BusTicketPlatform.{name}.Application;

public static class AssemblyMarker;
""")

    write(infra / f"BusTicketPlatform.{name}.Infrastructure.csproj", f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>BusTicketPlatform.{name}.Infrastructure</RootNamespace>
    <Description>{name} persistence and adapters.</Description>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\\BusTicketPlatform.{name}.Application\\BusTicketPlatform.{name}.Application.csproj" />
    <ProjectReference Include="..\\..\\..\\building-blocks\\BusTicketPlatform.BuildingBlocks.Messaging\\BusTicketPlatform.BuildingBlocks.Messaging.csproj" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" />
    <PackageReference Include="Microsoft.Extensions.Hosting" />
    <PackageReference Include="Npgsql" />
  </ItemGroup>
  <ItemGroup>
    <EmbeddedResource Include="..\\..\\..\\..\\..\\docs\\database\\_shared\\000_integration_tables.sql" LogicalName="sql.shared" />
    <EmbeddedResource Include="..\\..\\..\\..\\..\\docs\\database\\{slug}\\001_initial.sql" LogicalName="{sql_logical}" />
  </ItemGroup>
</Project>
""")
    write(infra / "AssemblyMarker.cs", f"""namespace BusTicketPlatform.{name}.Infrastructure;

public static class AssemblyMarker;
""")
    write(infra / f"{name}DatabaseOptions.cs", f"""namespace BusTicketPlatform.{name}.Infrastructure;

public sealed class {name}DatabaseOptions
{{
    public const string ConnectionStringName = "{name}";

    public string ConnectionString {{ get; set; }} = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}}
""")
    write(infra / "SqlBaselineMigrator.cs", f"""using System.Reflection;
using Npgsql;

namespace BusTicketPlatform.{name}.Infrastructure;

public sealed class SqlBaselineMigrator({name}DatabaseOptions options)
{{
    public async Task ApplyAsync(CancellationToken cancellationToken = default)
    {{
        if (!options.IsConfigured)
        {{
            return;
        }}

        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await ExecuteAsync(connection, \"\"\"
            CREATE TABLE IF NOT EXISTS schema_migrations (
              filename text PRIMARY KEY,
              applied_at timestamptz NOT NULL
            );
            \"\"\", cancellationToken);

        await ApplyFileAsync(connection, "sql.shared", "000_integration_tables.sql", cancellationToken);
        await ApplyFileAsync(connection, "{sql_logical}", "001_initial.sql", cancellationToken);
    }}

    private static async Task ApplyFileAsync(
        NpgsqlConnection connection,
        string resourceName,
        string filename,
        CancellationToken cancellationToken)
    {{
        await using (var check = new NpgsqlCommand(
                         "SELECT 1 FROM schema_migrations WHERE filename = @filename",
                         connection))
        {{
            check.Parameters.AddWithValue("filename", filename);
            var exists = await check.ExecuteScalarAsync(cancellationToken);
            if (exists is not null)
            {{
                return;
            }}
        }}

        var sql = ReadResource(resourceName);
        await ExecuteAsync(connection, sql, cancellationToken);
        await using var insert = new NpgsqlCommand(
            "INSERT INTO schema_migrations (filename, applied_at) VALUES (@filename, NOW())",
            connection);
        insert.Parameters.AddWithValue("filename", filename);
        await insert.ExecuteNonQueryAsync(cancellationToken);
    }}

    public static async Task ExecuteAsync(
        NpgsqlConnection connection,
        string sql,
        CancellationToken cancellationToken)
    {{
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }}

    private static string ReadResource(string name)
    {{
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded SQL '{{name}}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }}
}}
""")
    write(infra / "SqlBaselineHostedService.cs", f"""using Microsoft.Extensions.Hosting;

namespace BusTicketPlatform.{name}.Infrastructure;

public sealed class SqlBaselineHostedService(SqlBaselineMigrator migrator) : IHostedService
{{
    public Task StartAsync(CancellationToken cancellationToken) => migrator.ApplyAsync(cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}}
""")
    write(infra / "PostgresHealthCheck.cs", f"""using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace BusTicketPlatform.{name}.Infrastructure;

public sealed class PostgresHealthCheck({name}DatabaseOptions options) : IHealthCheck
{{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {{
        if (!options.IsConfigured)
        {{
            return HealthCheckResult.Unhealthy("{name} connection string is not configured.");
        }}

        try
        {{
            await using var connection = new NpgsqlConnection(options.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }}
        catch (Exception exception)
        {{
            return HealthCheckResult.Unhealthy("{name} database is unreachable.", exception);
        }}
    }}
}}
""")
    write(infra / "Persistence" / "IdempotencyStore.cs", f"""using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Ids;
using Npgsql;

namespace BusTicketPlatform.{name}.Infrastructure.Persistence;

public sealed class IdempotencyStore({name}DatabaseOptions options, IIdGenerator ids) : IIdempotencyStore
{{
    public async Task<IdempotencyOutcome> BeginAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        string requestHash,
        CancellationToken cancellationToken)
    {{
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var existing = new NpgsqlCommand(\"\"\"
            SELECT request_hash, processing_state, response_status, response_snapshot
            FROM idempotency_records
            WHERE actor_scope = @scope AND operation = @operation AND target_reference = @target AND idempotency_key = @key;
            \"\"\", connection);
        existing.Parameters.AddWithValue("scope", actorScope);
        existing.Parameters.AddWithValue("operation", operation);
        existing.Parameters.AddWithValue("target", targetReference);
        existing.Parameters.AddWithValue("key", key);
        await using var reader = await existing.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {{
            var hash = reader.GetString(0);
            var state = reader.GetString(1);
            if (!string.Equals(hash, requestHash, StringComparison.Ordinal))
            {{
                return new IdempotencyOutcome.Conflict();
            }}

            if (state == "COMPLETED")
            {{
                var status = reader.IsDBNull(2) ? 200 : reader.GetInt32(2);
                var snapshot = reader.IsDBNull(3) ? "{{}}" : reader.GetString(3);
                return new IdempotencyOutcome.Completed(status, snapshot);
            }}

            return new IdempotencyOutcome.InProgress();
        }}

        await reader.CloseAsync();
        await using var insert = new NpgsqlCommand(\"\"\"
            INSERT INTO idempotency_records (
              id, actor_scope, operation, target_reference, idempotency_key, request_hash,
              processing_state, created_at, expires_at)
            VALUES (@id, @scope, @operation, @target, @key, @hash, 'PROCESSING', NOW(), NOW() + INTERVAL '24 hours');
            \"\"\", connection);
        insert.Parameters.AddWithValue("id", ids.NewUuidV7());
        insert.Parameters.AddWithValue("scope", actorScope);
        insert.Parameters.AddWithValue("operation", operation);
        insert.Parameters.AddWithValue("target", targetReference);
        insert.Parameters.AddWithValue("key", key);
        insert.Parameters.AddWithValue("hash", requestHash);
        await insert.ExecuteNonQueryAsync(cancellationToken);
        return new IdempotencyOutcome.Started();
    }}

    public async Task CompleteAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        int status,
        string responseSnapshot,
        CancellationToken cancellationToken)
    {{
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(\"\"\"
            UPDATE idempotency_records
            SET processing_state = 'COMPLETED', response_status = @status, response_snapshot = CAST(@snapshot AS jsonb)
            WHERE actor_scope = @scope AND operation = @operation AND target_reference = @target AND idempotency_key = @key;
            \"\"\", connection);
        command.Parameters.AddWithValue("scope", actorScope);
        command.Parameters.AddWithValue("operation", operation);
        command.Parameters.AddWithValue("target", targetReference);
        command.Parameters.AddWithValue("key", key);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("snapshot", responseSnapshot);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }}
}}
""")
    write(infra / "OutboxWriter.cs", f"""using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Npgsql;

namespace BusTicketPlatform.{name}.Infrastructure;

public sealed class OutboxWriter({name}DatabaseOptions options)
{{
    public async Task EnqueueAsync(EventMessage message, CancellationToken cancellationToken)
    {{
        var payload = JsonSerializer.Serialize(message, EventMessageJson.Options);
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(\"\"\"
            INSERT INTO outbox_messages (
              id, message_type, schema_version, aggregate_id, aggregate_version, payload,
              correlation_id, occurred_at, attempt_count)
            VALUES (
              @id, @type, @version, @aggregate, @aggregateVersion, CAST(@payload AS jsonb),
              @correlation, @occurred, 0);
            \"\"\", connection);
        command.Parameters.AddWithValue("id", message.EventId);
        command.Parameters.AddWithValue("type", message.EventType);
        command.Parameters.AddWithValue("version", message.Version);
        command.Parameters.AddWithValue("aggregate", message.AggregateId);
        command.Parameters.AddWithValue("aggregateVersion", (object?)message.AggregateVersion ?? DBNull.Value);
        command.Parameters.AddWithValue("payload", payload);
        command.Parameters.AddWithValue("correlation", message.CorrelationId);
        command.Parameters.AddWithValue("occurred", message.OccurredAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }}
}}
""")

    write(api / f"BusTicketPlatform.{name}.Api.csproj", f"""<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <RootNamespace>BusTicketPlatform.{name}.Api</RootNamespace>
    <Description>{name} HTTP composition root.</Description>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\\BusTicketPlatform.{name}.Application\\BusTicketPlatform.{name}.Application.csproj" />
    <ProjectReference Include="..\\BusTicketPlatform.{name}.Infrastructure\\BusTicketPlatform.{name}.Infrastructure.csproj" />
    <ProjectReference Include="..\\..\\..\\building-blocks\\BusTicketPlatform.BuildingBlocks.AspNetCore\\BusTicketPlatform.BuildingBlocks.AspNetCore.csproj" />
  </ItemGroup>
</Project>
""")
    write(api / "appsettings.json", f"""{{
  "Logging": {{
    "LogLevel": {{
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }}
  }},
  "AllowedHosts": "*",
  "ConnectionStrings": {{
    "{name}": "Host=localhost;Port=5432;Database={slug};Username=platform;Password=postgres"
  }},
  "Authentication": {{
    "Issuer": "busticket-identity",
    "Audience": "busticket",
    "SigningKey": "local-dev-only-change-me-32bytes-min",
    "AccessTokenSeconds": 900
  }}
}}
""")
    write(api / "appsettings.Development.json", f"""{{
  "ConnectionStrings": {{
    "{name}": ""
  }}
}}
""")
    write(api / "Properties" / "launchSettings.json", f"""{{
  "$schema": "http://json.schemastore.org/launchsettings.json",
  "profiles": {{
    "http": {{
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": false,
      "applicationUrl": "http://localhost:{port}",
      "environmentVariables": {{
        "ASPNETCORE_ENVIRONMENT": "Development"
      }}
    }}
  }}
}}
""")

    write(tests / f"BusTicketPlatform.{name}.Api.IntegrationTests.csproj", f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsTestProject>true</IsTestProject>
    <RootNamespace>BusTicketPlatform.{name}.Api.IntegrationTests</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" />
    <PackageReference Include="Testcontainers.PostgreSql" />
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\\..\\..\\services\\{slug}\\BusTicketPlatform.{name}.Api\\BusTicketPlatform.{name}.Api.csproj" />
    <ProjectReference Include="..\\..\\..\\services\\{slug}\\BusTicketPlatform.{name}.Infrastructure\\BusTicketPlatform.{name}.Infrastructure.csproj" />
  </ItemGroup>
</Project>
""")
    write(tests / "GlobalUsings.cs", """global using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]
""")
    write(tests / "TestJwt.cs", """using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace BusTicketPlatform.""" + name + """.Api.IntegrationTests;

internal static class TestJwt
{
    public const string SigningKey = "local-dev-only-change-me-32bytes-min";

    public static string Mint(Guid userId, IEnumerable<string> roles, Guid? organizationId = null)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("sid", Guid.CreateVersion7().ToString()),
            new("ver", "1")
        };
        if (organizationId is not null)
        {
            claims.Add(new Claim("org", organizationId.Value.ToString()));
        }

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey));
        var token = new JwtSecurityToken(
            "busticket-identity",
            "busticket",
            claims,
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(20),
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
""")


for slug, (name, port, sql) in SERVICES.items():
    emit(slug, name, port, sql)

print("skeleton written")
