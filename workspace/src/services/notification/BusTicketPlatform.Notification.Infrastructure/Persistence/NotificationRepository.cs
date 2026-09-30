using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.Notification.Application;
using Npgsql;

namespace BusTicketPlatform.Notification.Infrastructure.Persistence;

public sealed class NotificationRepository(NotificationDatabaseOptions options, IIdGenerator ids) : INotificationRepository
{
    public async Task InsertAsync(IngestNotification notification, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO notifications (
              id, user_id_external, notification_type, source_message_id, source_reference, title, body, data, created_at)
            VALUES (@id, @user, @type, @source, @ref, @title, @body, '{}'::jsonb, NOW())
            ON CONFLICT (source_message_id, user_id_external) DO NOTHING;
            """, connection);
        command.Parameters.AddWithValue("id", ids.NewUuidV7());
        command.Parameters.AddWithValue("user", notification.UserId);
        command.Parameters.AddWithValue("type", notification.Type);
        command.Parameters.AddWithValue("source", notification.SourceMessageId);
        command.Parameters.AddWithValue("ref", (object?)notification.ReferenceId ?? DBNull.Value);
        command.Parameters.AddWithValue("title", notification.Title);
        command.Parameters.AddWithValue("body", notification.Body);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<NotificationDto> Items, string? Next)> ListAsync(Guid userId, string? cursor, int limit, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, notification_type, title, body, source_reference, read_at IS NOT NULL, created_at
            FROM notifications
            WHERE user_id_external = @user AND (@cursor::timestamptz IS NULL OR created_at < @cursor)
            ORDER BY created_at DESC, id DESC
            LIMIT @limit;
            """, connection);
        command.Parameters.AddWithValue("user", userId);
        command.Parameters.AddWithValue("cursor", (object?)(DateTime.TryParse(cursor, out var parsed) ? parsed : null) ?? DBNull.Value);
        command.Parameters.AddWithValue("limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<NotificationDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new NotificationDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), null, reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetBoolean(5), new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc))));
        }

        return (items, items.Count == limit ? items[^1].CreatedAt.ToString("O") : null);
    }

    public async Task<NotificationDto?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE notifications SET read_at = COALESCE(read_at, NOW())
            WHERE id = @id AND user_id_external = @user
            RETURNING id, notification_type, title, body, source_reference, read_at IS NOT NULL, created_at;
            """, connection);
        command.Parameters.AddWithValue("id", notificationId);
        command.Parameters.AddWithValue("user", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new NotificationDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), null, reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetBoolean(5), new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)))
            : null;
    }
}
