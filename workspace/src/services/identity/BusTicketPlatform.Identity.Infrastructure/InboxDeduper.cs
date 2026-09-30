using Npgsql;

namespace BusTicketPlatform.Identity.Infrastructure;

public sealed class InboxDeduper(IdentityDatabaseOptions options)
{
    public async Task<bool> TryAcceptAsync(
        string consumerName,
        Guid messageId,
        string messageType,
        string payloadHash,
        CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO inbox_messages (
              id, consumer_name, message_id, message_type, schema_version, payload_hash, received_at, processed_at)
            VALUES (
              @id, @consumer, @messageId, @type, 1, @hash, NOW(), NOW())
            ON CONFLICT ON CONSTRAINT uq_inbox_consumer_message DO NOTHING
            RETURNING id;
            """, connection);
        command.Parameters.AddWithValue("id", Guid.CreateVersion7());
        command.Parameters.AddWithValue("consumer", consumerName);
        command.Parameters.AddWithValue("messageId", messageId.ToString());
        command.Parameters.AddWithValue("type", messageType);
        command.Parameters.AddWithValue("hash", payloadHash);
        var inserted = await command.ExecuteScalarAsync(cancellationToken);
        return inserted is not null;
    }
}
