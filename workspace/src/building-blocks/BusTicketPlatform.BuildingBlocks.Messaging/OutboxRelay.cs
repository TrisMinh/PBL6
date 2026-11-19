using System.Text.Json;
using Npgsql;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed class OutboxRelay(string connectionString)
{
    public async Task<(int Published, int Failed)> PublishPendingAsync(
        IEventPublisher publisher,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return (0, 0);
        }

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        // Only one replica may publish pending rows from this database at a time.
        await using var dispatchLock = new NpgsqlCommand(
            "SELECT pg_try_advisory_xact_lock(hashtext('outbox_dispatch'));", connection, transaction);
        if (await dispatchLock.ExecuteScalarAsync(cancellationToken) is not true)
        {
            return (0, 0);
        }

        var published = 0;
        var failed = 0;
        foreach (var row in await LoadPendingAsync(transaction, cancellationToken))
        {
            try
            {
                var message = JsonSerializer.Deserialize<EventMessage>(row.Payload, EventMessageJson.Options)
                    ?? throw new InvalidOperationException("Outbox payload is empty.");
                await publisher.PublishAsync(message, OutboxRouting.KeyFor(message.EventType), cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await MarkFailedAsync(transaction, row.Id, cancellationToken);
                failed++;
                continue;
            }

            await MarkPublishedAsync(transaction, row.Id, cancellationToken);
            published++;
        }

        await transaction.CommitAsync(cancellationToken);
        return (published, failed);
    }

    private static async Task<List<(Guid Id, string Payload)>> LoadPendingAsync(NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            SELECT id, payload::text
            FROM outbox_messages
            WHERE published_at IS NULL
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
            ORDER BY occurred_at
            LIMIT 20;
            """, transaction.Connection, transaction);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<(Guid Id, string Payload)>();
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add((reader.GetGuid(0), reader.GetString(1)));
        }

        return rows;
    }

    private static async Task MarkPublishedAsync(NpgsqlTransaction transaction, Guid id, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            UPDATE outbox_messages
            SET published_at = NOW(), last_error_code = NULL, next_attempt_at = NULL
            WHERE id = @id;
            """, transaction.Connection, transaction);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task MarkFailedAsync(NpgsqlTransaction transaction, Guid id, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            UPDATE outbox_messages
            SET attempt_count = attempt_count + 1,
                last_error_code = 'PUBLISH_FAILED',
                next_attempt_at = NOW()
            WHERE id = @id;
            """, transaction.Connection, transaction);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
