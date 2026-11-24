using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Reporting.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Reporting.Infrastructure;

public static class ReportingEventHandlers
{
    public static Task HandleAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message is { EventType: "PaymentBookingLinked", Producer: "payment", Version: 1 })
        {
            var link = EventPayload.Deserialize<PaymentBookingLink>(message.Payload);
            if (link is null || link.PaymentId == Guid.Empty || link.PaymentId != message.AggregateId
                || link.BookingId == Guid.Empty || message.TenantId is not Guid organization || organization == Guid.Empty)
            {
                throw new InvalidOperationException("Payment booking link is missing source identity.");
            }

            return services.GetRequiredService<IReportingRepository>()
                .RecordPaymentBookingAsync(organization, link.PaymentId, link.BookingId, cancellationToken);
        }

        if (message is { EventType: "BookingRevenueContextRecorded", Producer: "booking", Version: 1 })
        {
            var context = EventPayload.Deserialize<BookingRevenueContext>(message.Payload);
            if (context is null || context.BookingId == Guid.Empty || context.BookingId != message.AggregateId
                || string.IsNullOrWhiteSpace(context.BookingCode) || string.IsNullOrWhiteSpace(context.RouteName)
                || message.TenantId is not Guid organization || organization == Guid.Empty)
            {
                throw new InvalidOperationException("Booking revenue context is missing order or route information.");
            }

            return services.GetRequiredService<IReportingRepository>()
                .RecordRevenueBookingAsync(organization, context.BookingId, context.BookingCode, context.RouteName, cancellationToken);
        }

        if (message is { EventType: "RevenueMovementRecorded", Producer: "payment", Version: 1 })
        {
            var movement = EventPayload.Deserialize<RevenueMovement>(message.Payload);
            if (movement is null || string.IsNullOrWhiteSpace(movement.MovementKey) || movement.OrganizationId == Guid.Empty
                || movement.PaymentId == Guid.Empty || movement.EffectiveAt == default || movement.OrganizationId != message.TenantId
                || movement.PaymentId != message.AggregateId)
            {
                throw new InvalidOperationException("Revenue movement is missing source identity or effective time.");
            }

            return services.GetRequiredService<ReportingService>().IngestRevenueAsync(movement, cancellationToken);
        }

        if (message.EventType == "RefundSucceeded")
        {
            EventPayload.TryGuid(message.Payload, "bookingId", out var refundedBookingId);
            return services.GetRequiredService<ReportingService>()
                .IngestRefundAsync(refundedBookingId, ReadLong(message.Payload, "amount"), cancellationToken);
        }

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

    private sealed record PaymentBookingLink(Guid PaymentId, Guid BookingId);
    private sealed record BookingRevenueContext(Guid BookingId, string BookingCode, string RouteName);

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
