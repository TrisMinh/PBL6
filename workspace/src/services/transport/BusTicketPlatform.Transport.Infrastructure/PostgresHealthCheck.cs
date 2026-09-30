using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace BusTicketPlatform.Transport.Infrastructure;

public sealed class PostgresHealthCheck(TransportDatabaseOptions options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            return HealthCheckResult.Unhealthy("Transport connection string is not configured.");
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
            return HealthCheckResult.Unhealthy("Transport database is unreachable.", exception);
        }
    }
}
