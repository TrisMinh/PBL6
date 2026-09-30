using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Payment.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Payment.Infrastructure;

public static class PaymentEventHandlers
{
    public static Task HandleAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        return message.EventType switch
        {
            "BookingCreated" => HandleBookingCreatedAsync(services, message, cancellationToken),
            "RefundRequested" or "BookingCancelled" => HandleRefundRequestAsync(services, message, cancellationToken),
            _ => Task.CompletedTask
        };
    }

    private static Task HandleBookingCreatedAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        EventPayload.TryGuid(message.Payload, "bookingId", out var bookingId);
        if (bookingId == Guid.Empty)
        {
            bookingId = message.AggregateId;
        }

        EventPayload.TryGuid(message.Payload, "customerId", out var customerId);
        EventPayload.TryGuid(message.Payload, "organizationId", out var organizationId);
        var amount = 0L;
        decimal? commission = null;
        if (message.Payload.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            if (message.Payload.TryGetProperty("grossAmount", out var amountEl) && amountEl.TryGetInt64(out var parsed))
            {
                amount = parsed;
            }

            if (message.Payload.TryGetProperty("commissionRate", out var rateEl) && rateEl.TryGetDecimal(out var rate))
            {
                commission = rate;
            }
        }

        return services.GetRequiredService<PaymentService>().IngestBookingCreatedAsync(
            bookingId,
            customerId,
            organizationId,
            amount,
            EventPayload.String(message.Payload, "currency", "VND"),
            EventPayload.String(message.Payload, "paymentChannel"),
            commission,
            cancellationToken);
    }

    public static Task HandleRefundRequestAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message.EventType is not ("RefundRequested" or "BookingCancelled"))
        {
            return Task.CompletedTask;
        }

        EventPayload.TryGuid(message.Payload, "bookingId", out var bookingId);
        if (bookingId == Guid.Empty)
        {
            bookingId = message.AggregateId;
        }

        EventPayload.TryGuid(message.Payload, "paymentId", out var paymentId);
        var amount = 0L;
        if (message.Payload.ValueKind == System.Text.Json.JsonValueKind.Object
            && message.Payload.TryGetProperty("amount", out var amountEl)
            && amountEl.TryGetInt64(out var parsed))
        {
            amount = parsed;
        }

        var currency = EventPayload.String(message.Payload, "currency", "VND");
        var reason = EventPayload.String(message.Payload, "reason", message.EventType);
        return services.GetRequiredService<PaymentService>()
            .ApplyRefundRequestedAsync(bookingId, paymentId, amount, currency, reason, cancellationToken);
    }
}
