using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Transport.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Transport.Infrastructure;

public static class TransportEventHandlers
{
    public static async Task HandleInventoryReadyAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message.EventType != "TripInventoryReady")
        {
            return;
        }

        if (!EventPayload.TryGuid(message.Payload, "tripId", out var tripId) || tripId == Guid.Empty)
        {
            tripId = message.AggregateId;
        }

        await services.GetRequiredService<TransportService>().MarkInventoryReadyAsync(tripId, cancellationToken);
        await services.GetRequiredService<PublicTransportCache>().InvalidateAsync(cancellationToken);
    }
}
