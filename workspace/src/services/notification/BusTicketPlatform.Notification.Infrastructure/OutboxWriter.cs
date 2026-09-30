using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Npgsql;

namespace BusTicketPlatform.Notification.Infrastructure;

public sealed class OutboxWriter(NotificationDatabaseOptions options)
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
}
