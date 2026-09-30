using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Npgsql;

namespace BusTicketPlatform.Identity.Infrastructure;

public sealed class OutboxPublisher(IdentityDatabaseOptions options)
{
    public async Task EnqueueAsync(EventMessage message, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(message, EventMessageJson.Options);
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO outbox_messages (
              id, message_type, schema_version, aggregate_id, aggregate_version, payload,
              correlation_id, occurred_at, attempt_count)
            VALUES (
              @id, @type, @version, @aggregate, @aggregateVersion, CAST(@payload AS jsonb),
              @correlation, @occurred, 0);
            """, connection);
        command.Parameters.AddWithValue("id", message.EventId);
        command.Parameters.AddWithValue("type", message.EventType);
        command.Parameters.AddWithValue("version", message.Version);
        command.Parameters.AddWithValue("aggregate", message.AggregateId);
        command.Parameters.AddWithValue("aggregateVersion", (object?)message.AggregateVersion ?? DBNull.Value);
        command.Parameters.AddWithValue("payload", payload);
        command.Parameters.AddWithValue("correlation", message.CorrelationId);
        command.Parameters.AddWithValue("occurred", message.OccurredAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<(int Published, int Failed)> PublishPendingAsync(
        IEventPublisher publisher,
        CancellationToken cancellationToken)
    {
        var published = 0;
        var failed = 0;
        foreach (var row in await LoadPendingAsync(cancellationToken))
        {
            try
            {
                var message = JsonSerializer.Deserialize<EventMessage>(row.Payload, EventMessageJson.Options)
                    ?? throw new InvalidOperationException("Outbox payload is empty.");
                await publisher.PublishAsync(message, RoutingKeyFor(message.EventType), cancellationToken);
                await MarkPublishedAsync(row.Id, cancellationToken);
                published++;
            }
            catch (Exception exception)
            {
                await MarkFailedAsync(row.Id, exception.GetType().Name, cancellationToken);
                failed++;
            }
        }

        return (published, failed);
    }

    private async Task<List<(Guid Id, string Payload)>> LoadPendingAsync(CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, payload::text
            FROM outbox_messages
            WHERE published_at IS NULL
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
            ORDER BY occurred_at
            LIMIT 20;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<(Guid Id, string Payload)>();
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add((reader.GetGuid(0), reader.GetString(1)));
        }

        return rows;
    }

    private async Task MarkPublishedAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE outbox_messages
            SET published_at = NOW(), last_error_code = NULL, next_attempt_at = NULL
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task MarkFailedAsync(Guid id, string errorCode, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE outbox_messages
            SET attempt_count = attempt_count + 1,
                last_error_code = @error,
                next_attempt_at = NOW()
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("error", errorCode);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public static string RoutingKeyFor(string messageType) => OutboxRouting.KeyFor(messageType);
}
