using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Identity.Application;

namespace BusTicketPlatform.Identity.Infrastructure;

public sealed class RegistrationEvents(OutboxPublisher outbox) : IRegistrationEvents
{
    public Task UserRegisteredAsync(Guid userId, DateTimeOffset registeredAt, Guid correlationId, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.SerializeToElement(new
        {
            userId,
            verificationChannel = "EMAIL",
            registeredAt
        });
        var message = new EventMessage(
            EventId: userId,
            EventType: "UserRegistered",
            Version: 1,
            OccurredAt: registeredAt,
            Producer: "identity-service",
            CorrelationId: correlationId,
            AggregateId: userId,
            Payload: payload,
            AggregateVersion: 1);
        return outbox.EnqueueAsync(message, cancellationToken);
    }
}
