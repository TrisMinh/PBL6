using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace BusTicketPlatform.Identity.Infrastructure;

public sealed class PostgresHealthCheck(IdentityDatabaseOptions options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            return HealthCheckResult.Unhealthy("Identity connection string is not configured.");
        }

        try
        {
            await using var connection = new NpgsqlConnection(options.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("Identity database is unreachable.", exception);
        }
    }
}
