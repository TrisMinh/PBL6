using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Notification.Application;

namespace BusTicketPlatform.Services.UnitTests;

public sealed class NotificationServiceTests
{
    [Theory]
    [InlineData(500)]
    [InlineData(0)]
    public async Task ListUsesDefaultPageSizeWhenLimitIsOutsideSupportedRange(int requestedLimit)
    {
        var repository = new RecordingNotificationRepository();
        var service = new NotificationService(repository);
        var userId = Guid.NewGuid();

        var result = await service.ListAsync(new Actor(userId), "cursor-1", requestedLimit, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(20, repository.ReceivedLimit);
        Assert.Equal(userId, repository.ReceivedUserId);
        Assert.Equal("cursor-1", repository.ReceivedCursor);
    }

    [Fact]
    public async Task MarkReadReturnsNotFoundWhenNotificationDoesNotExist()
    {
        var service = new NotificationService(new RecordingNotificationRepository());

        var result = await service.MarkReadAsync(new Actor(Guid.NewGuid()), Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ResourceNotFound, result.Error?.Code);
    }

    private sealed class RecordingNotificationRepository : INotificationRepository
    {
        public Guid? ReceivedUserId { get; private set; }
        public string? ReceivedCursor { get; private set; }
        public int ReceivedLimit { get; private set; }

        public Task InsertAsync(IngestNotification notification, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<(IReadOnlyList<NotificationDto> Items, string? Next)> ListAsync(
            Guid userId,
            string? cursor,
            int limit,
            CancellationToken cancellationToken)
        {
            ReceivedUserId = userId;
            ReceivedCursor = cursor;
            ReceivedLimit = limit;
            return Task.FromResult<(IReadOnlyList<NotificationDto>, string?)>((Array.Empty<NotificationDto>(), null));
        }

        public Task<NotificationDto?> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken) =>
            Task.FromResult<NotificationDto?>(null);
    }
}
