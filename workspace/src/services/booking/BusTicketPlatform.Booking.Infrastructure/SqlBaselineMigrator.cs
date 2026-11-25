using System.Reflection;
using Npgsql;

namespace BusTicketPlatform.Booking.Infrastructure;

public sealed class SqlBaselineMigrator(BookingDatabaseOptions options)
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
        await ApplyFileAsync(connection, "sql.booking", "001_initial.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.coupons", "002_coupons.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.booking-analytics", "003_operator_booking_analytics.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.revenue-booking-context", "004_revenue_booking_context.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.booking-admin-lookup", "005_admin_lookup.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.booking-operator-paging", "006_operator_booking_paging.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.embedded-booking-activity", "007_embedded_booking_activity.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.seat-hold-protection", "008_seat_hold_protection.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.explicit-hold-cancellation", "009_explicit_hold_cancellation.sql", cancellationToken);
        await ApplyFileAsync(connection, "sql.ticket-refund-request", "010_ticket_refund_request.sql", cancellationToken);
    }

    private static async Task ApplyFileAsync(
        NpgsqlConnection connection,
        string resourceName,
        string filename,
        CancellationToken cancellationToken)
    {
        await using (var check = new NpgsqlCommand(
                         "SELECT 1 FROM schema_migrations WHERE filename = @filename",
                         connection))
        {
            check.Parameters.AddWithValue("filename", filename);
            var exists = await check.ExecuteScalarAsync(cancellationToken);
            if (exists is not null)
            {
                return;
            }
        }

        var sql = ReadResource(resourceName);
        await ExecuteAsync(connection, sql, cancellationToken);
        await using var insert = new NpgsqlCommand(
            "INSERT INTO schema_migrations (filename, applied_at) VALUES (@filename, NOW())",
            connection);
        insert.Parameters.AddWithValue("filename", filename);
        await insert.ExecuteNonQueryAsync(cancellationToken);
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
