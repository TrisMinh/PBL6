using System.Reflection;
using Npgsql;

namespace BusTicketPlatform.Reporting.Infrastructure;

public sealed class SqlBaselineMigrator(ReportingDatabaseOptions options)
{
    public async Task ApplyAsync(CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            return;
        }

        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              filename text PRIMARY KEY,
              applied_at timestamptz NOT NULL
            );
            """, cancellationToken);

        await ApplyFileAsync(connection, "sql.shared", "000_integration_tables.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.reporting", "001_initial.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.revenue-analytics", "002_revenue_analytics.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.revenue-by-booking", "003_revenue_by_booking.sql", cancellationToken);
    }

    private static async Task ApplyFileAsync(
        NpgsqlConnection connection,
        string resourceName,
        string filename,
        CancellationToken cancellationToken)
    {
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var migrationLock = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext('schema_migrations'))", connection, transaction))
        {
            await migrationLock.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var check = new NpgsqlCommand(
                         "SELECT 1 FROM schema_migrations WHERE filename = @filename",
                         connection, transaction))
        {
            check.Parameters.AddWithValue("filename", filename);
            var exists = await check.ExecuteScalarAsync(cancellationToken);
            if (exists is not null)
            {
                return;
            }
        }

        var sql = ReadResource(resourceName);
        await using var migration = new NpgsqlCommand(sql, connection, transaction);
        await migration.ExecuteNonQueryAsync(cancellationToken);
        await using var insert = new NpgsqlCommand(
            "INSERT INTO schema_migrations (filename, applied_at) VALUES (@filename, NOW())",
            connection, transaction);
        insert.Parameters.AddWithValue("filename", filename);
        await insert.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public static async Task ExecuteAsync(
        NpgsqlConnection connection,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string ReadResource(string name)
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded SQL '{name}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
