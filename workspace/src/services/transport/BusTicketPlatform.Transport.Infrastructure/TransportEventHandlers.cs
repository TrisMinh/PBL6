using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Transport.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Transport.Infrastructure;

public static class TransportEventHandlers
{
    public static Task HandleInventoryReadyAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message.EventType != "TripInventoryReady")
        {
            return Task.CompletedTask;
        }

        if (!EventPayload.TryGuid(message.Payload, "tripId", out var tripId) || tripId == Guid.Empty)
        {
            tripId = message.AggregateId;
        }

        return services.GetRequiredService<TransportService>().MarkInventoryReadyAsync(tripId, cancellationToken);
    }
}
