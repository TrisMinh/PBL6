using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Payment.Application;

namespace BusTicketPlatform.Payment.Infrastructure;

public sealed class PaymentEvents(OutboxWriter outbox, IIdGenerator ids) : IPaymentEvents
{
    public Task PaymentSucceededAsync(PaymentRecord payment, Guid correlationId, CancellationToken cancellationToken) =>
        outbox.EnqueueAsync(
            new EventMessage(
                ids.NewUuidV7(),
                "PaymentSucceeded",
                1,
                DateTimeOffset.UtcNow,
                "payment",
                correlationId,
                payment.Id,
                JsonSerializer.SerializeToElement(new { bookingId = payment.BookingId, paymentId = payment.Id, amount = payment.Amount, currency = payment.Currency })),
            cancellationToken);

    public Task RefundSucceededAsync(RefundRecord refund, Guid correlationId, CancellationToken cancellationToken) =>
        outbox.EnqueueAsync(
            new EventMessage(
                ids.NewUuidV7(),
                "RefundSucceeded",
                1,
                DateTimeOffset.UtcNow,
                "payment",
                correlationId,
                refund.Id,
                JsonSerializer.SerializeToElement(new { bookingId = refund.BookingId, paymentId = refund.PaymentId, refundId = refund.Id, amount = refund.Amount, currency = refund.Currency })),
            cancellationToken);
}
