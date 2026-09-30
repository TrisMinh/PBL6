using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Reporting.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Reporting.Infrastructure;

public static class ReportingEventHandlers
{
    public static Task HandleAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message.EventType is not ("BookingCreated" or "BookingPaid" or "BookingCancelled"))
        {
            return Task.CompletedTask;
        }

        var fact = EventPayload.Deserialize<BookingFact>(message.Payload);
        if (fact is null || fact.BookingId == Guid.Empty)
        {
            if (!EventPayload.TryGuid(message.Payload, "bookingId", out var bookingId))
            {
                return Task.CompletedTask;
            }

            EventPayload.TryGuid(message.Payload, "organizationId", out var organizationId);
            EventPayload.TryGuid(message.Payload, "customerId", out var customerId);
            EventPayload.TryGuid(message.Payload, "tripId", out var tripId);
            var status = message.EventType switch
            {
                "BookingPaid" => "PAID",
                "BookingCancelled" => "CANCELLED",
                _ => EventPayload.String(message.Payload, "status", "HELD")
            };
            fact = new BookingFact(
                bookingId,
                EventPayload.String(message.Payload, "bookingCode", bookingId.ToString("N")[^12..]),
                organizationId == Guid.Empty ? message.TenantId ?? Guid.Empty : organizationId,
                customerId,
                tripId == Guid.Empty ? message.AggregateId : tripId,
                EventPayload.String(message.Payload, "routeName"),
                DateTimeOffset.UtcNow,
                status,
                EventPayload.String(message.Payload, "paymentChannel", "PREPAID"),
                0,
                ReadLong(message.Payload, "grossAmount"),
                ReadLong(message.Payload, "cancellationFee"),
                ReadLong(message.Payload, "refundedAmount"),
                ReadLong(message.Payload, "netAmount"),
                EventPayload.String(message.Payload, "currency", "VND"),
                DateTimeOffset.UtcNow);
        }

        return services.GetRequiredService<ReportingService>().IngestAsync(fact, cancellationToken);
    }

    private static long ReadLong(System.Text.Json.JsonElement payload, string name)
    {
        if (payload.ValueKind == System.Text.Json.JsonValueKind.Object
            && payload.TryGetProperty(name, out var element)
            && element.TryGetInt64(out var value))
        {
            return value;
        }

        return 0;
    }
}
