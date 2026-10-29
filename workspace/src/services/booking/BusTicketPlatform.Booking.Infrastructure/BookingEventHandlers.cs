using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Booking.Infrastructure;

public static class BookingEventHandlers
{
    public static async Task HandleTripAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        var service = services.GetRequiredService<BookingService>();
        if (message.EventType == "TripPublished")
        {
            var body = EventPayload.Deserialize<TripPublishedMessage>(message.Payload);
            if (body is not null && body.TripId != Guid.Empty)
            {
                await service.ImportPublishedTripAsync(body, message.CorrelationId, cancellationToken);
            }

            return;
        }

        if (message.EventType == "TripStatusChanged")
        {
            var body = EventPayload.Deserialize<TripStatusChangedMessage>(message.Payload);
            if (body is not null)
            {
                await service.ApplyTripStatusAsync(body, cancellationToken);
            }

            return;
        }

        if (message.EventType == "TripCancelled" && EventPayload.TryGuid(message.Payload, "tripId", out var tripId))
        {
            await service.ApplyTripStatusAsync(new TripStatusChangedMessage(tripId, "CANCELLED"), cancellationToken);
        }
    }

    public static async Task HandlePaymentAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (message.EventType != "PaymentSucceeded")
        {
            return;
        }

        var body = EventPayload.Deserialize<PaymentSucceededMessage>(message.Payload);
        if (body is null || body.BookingId == Guid.Empty)
        {
            if (!EventPayload.TryGuid(message.Payload, "bookingId", out var bookingId))
            {
                return;
            }

            EventPayload.TryGuid(message.Payload, "paymentId", out var paymentId);
            var amount = message.Payload.TryGetProperty("amount", out var amountEl) && amountEl.TryGetInt64(out var parsed) ? parsed : 0;
            body = new PaymentSucceededMessage(bookingId, paymentId, amount, EventPayload.String(message.Payload, "currency", "VND"));
        }

        await services.GetRequiredService<BookingService>().ApplyPaymentSucceededAsync(body, message.CorrelationId, cancellationToken);
    }
}
