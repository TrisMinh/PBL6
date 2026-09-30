using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Ids;
using Npgsql;

namespace BusTicketPlatform.Booking.Infrastructure.Persistence;

public sealed class IdempotencyStore(BookingDatabaseOptions options, IIdGenerator ids) : IIdempotencyStore
{
    public async Task<IdempotencyOutcome> BeginAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        string requestHash,
        CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var existing = new NpgsqlCommand("""
            SELECT request_hash, processing_state, response_status, response_snapshot
            FROM idempotency_records
            WHERE actor_scope = @scope AND operation = @operation AND target_reference = @target AND idempotency_key = @key;
            """, connection);
        existing.Parameters.AddWithValue("scope", actorScope);
        existing.Parameters.AddWithValue("operation", operation);
        existing.Parameters.AddWithValue("target", targetReference);
        existing.Parameters.AddWithValue("key", key);
        await using var reader = await existing.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var hash = reader.GetString(0);
            var state = reader.GetString(1);
            if (!string.Equals(hash, requestHash, StringComparison.Ordinal))
            {
                return new IdempotencyOutcome.Conflict();
            }

            if (state == "COMPLETED")
            {
                var status = reader.IsDBNull(2) ? 200 : reader.GetInt32(2);
                var snapshot = reader.IsDBNull(3) ? "{}" : reader.GetString(3);
                return new IdempotencyOutcome.Completed(status, snapshot);
            }

            return new IdempotencyOutcome.InProgress();
        }

        await reader.CloseAsync();
        await using var insert = new NpgsqlCommand("""
            INSERT INTO idempotency_records (
              id, actor_scope, operation, target_reference, idempotency_key, request_hash,
              processing_state, created_at, expires_at)
            VALUES (@id, @scope, @operation, @target, @key, @hash, 'PROCESSING', NOW(), NOW() + INTERVAL '24 hours');
            """, connection);
        insert.Parameters.AddWithValue("id", ids.NewUuidV7());
        insert.Parameters.AddWithValue("scope", actorScope);
        insert.Parameters.AddWithValue("operation", operation);
        insert.Parameters.AddWithValue("target", targetReference);
        insert.Parameters.AddWithValue("key", key);
        insert.Parameters.AddWithValue("hash", requestHash);
        await insert.ExecuteNonQueryAsync(cancellationToken);
        return new IdempotencyOutcome.Started();
    }

    public async Task CompleteAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        int status,
        string responseSnapshot,
        CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE idempotency_records
            SET processing_state = 'COMPLETED', response_status = @status, response_snapshot = CAST(@snapshot AS jsonb)
            WHERE actor_scope = @scope AND operation = @operation AND target_reference = @target AND idempotency_key = @key;
            """, connection);
        command.Parameters.AddWithValue("scope", actorScope);
        command.Parameters.AddWithValue("operation", operation);
        command.Parameters.AddWithValue("target", targetReference);
        command.Parameters.AddWithValue("key", key);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("snapshot", responseSnapshot);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
