using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Notification.Application;

public sealed record Actor(Guid UserId);
public sealed record NotificationDto(Guid Id, string Type, string Title, string Body, string? ReferenceType, string? ReferenceId, bool Read, DateTimeOffset CreatedAt);
public sealed record NotificationPageDto(IReadOnlyList<NotificationDto> Items, string? NextCursor);
public sealed record IngestNotification(Guid UserId, string Type, string Title, string Body, string SourceMessageId, string? ReferenceType, string? ReferenceId);

public interface INotificationRepository
{
    Task InsertAsync(IngestNotification notification, CancellationToken cancellationToken);
    Task<(IReadOnlyList<NotificationDto> Items, string? Next)> ListAsync(Guid userId, string? cursor, int limit, CancellationToken cancellationToken);
    Task<NotificationDto?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken);
}

public sealed class NotificationService(INotificationRepository store)
{
    public Task IngestAsync(IngestNotification notification, CancellationToken cancellationToken) =>
        store.InsertAsync(notification, cancellationToken);

    public async Task<Result<NotificationPageDto>> ListAsync(Actor actor, string? cursor, int limit, CancellationToken cancellationToken)
    {
        limit = limit is < 1 or > 100 ? 20 : limit;
        var (items, next) = await store.ListAsync(actor.UserId, cursor, limit, cancellationToken);
        return Result<NotificationPageDto>.Success(new NotificationPageDto(items, next));
    }

    public async Task<Result<NotificationDto>> MarkReadAsync(Actor actor, Guid notificationId, CancellationToken cancellationToken)
    {
        var item = await store.MarkReadAsync(actor.UserId, notificationId, cancellationToken);
        return item is null ? Result<NotificationDto>.Failure(PlatformErrors.NotFound()) : Result<NotificationDto>.Success(item);
    }
}
