using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Transport.Application;

namespace BusTicketPlatform.Transport.Infrastructure;

public sealed class TransportEvents(OutboxWriter outbox, IIdGenerator ids) : ITransportEvents
{
    public Task TripPublishedAsync(TripRecord trip, Guid correlationId, CancellationToken cancellationToken) =>
        EnqueueAsync("TripPublished", Topology.TripPublishedRoutingKey, trip.Id, trip.OrganizationId, trip.PublishedVersion, correlationId, new
        {
            tripId = trip.Id,
            organizationId = trip.OrganizationId,
            routeId = trip.RouteId,
            busId = trip.BusId,
            originStopId = trip.OriginStopId,
            destinationStopId = trip.DestinationStopId,
            departureAt = trip.DepartureAt,
            arrivalAt = trip.ArrivalAt,
            currency = trip.Currency,
            status = trip.Status,
            sourceTripVersion = trip.PublishedVersion ?? 1,
            routeSnapshot = trip.RouteSnapshot,
            busSnapshot = trip.BusSnapshot,
            farePolicySnapshot = trip.FareSnapshot
        }, cancellationToken);

    public Task TripCancelledAsync(TripRecord trip, string reason, Guid correlationId, CancellationToken cancellationToken) =>
        EnqueueAsync("TripCancelled", Topology.TripCancelledRoutingKey, trip.Id, trip.OrganizationId, trip.RowVersion, correlationId, new
        {
            tripId = trip.Id,
            reason
        }, cancellationToken);

    public Task TripStatusChangedAsync(TripRecord trip, Guid correlationId, CancellationToken cancellationToken) =>
        EnqueueAsync("TripStatusChanged", Topology.TripStatusChangedRoutingKey, trip.Id, trip.OrganizationId, trip.RowVersion, correlationId, new
        {
            tripId = trip.Id,
            status = trip.Status
        }, cancellationToken);

    private Task EnqueueAsync(
        string type,
        string routingKey,
        Guid aggregateId,
        Guid tenantId,
        long? version,
        Guid correlationId,
        object payload,
        CancellationToken cancellationToken)
    {
        _ = routingKey;
        var json = JsonSerializer.SerializeToElement(payload);
        return outbox.EnqueueAsync(
            new EventMessage(ids.NewUuidV7(), type, 1, DateTimeOffset.UtcNow, "transport", correlationId, aggregateId, json, null, version, tenantId),
            cancellationToken);
    }
}
