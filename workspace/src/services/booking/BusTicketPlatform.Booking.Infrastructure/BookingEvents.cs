using System.Text.Json;
using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Messaging;

namespace BusTicketPlatform.Booking.Infrastructure;

public sealed class BookingEvents(OutboxWriter outbox, IIdGenerator ids) : IBookingEvents
{
    public Task BookingCreatedAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("BookingCreated", booking.Id, booking.OrganizationId, correlationId, Fact(booking, booking.Status, 0, 0), cancellationToken);

    public Task BookingPaidAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("BookingPaid", booking.Id, booking.OrganizationId, correlationId, Fact(booking, "PAID", 0, 0), cancellationToken);

    public Task TicketsIssuedAsync(IReadOnlyList<TicketRecord> tickets, Guid correlationId, CancellationToken cancellationToken) =>
        tickets.Count == 0
            ? Task.CompletedTask
            : Enqueue("TicketIssued", tickets[0].BookingId, null, correlationId, new { ticketIds = tickets.Select(t => t.Id).ToArray(), customerId = tickets[0].CustomerId }, cancellationToken);

    public Task TicketsReadyAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("TicketIssued", booking.Id, booking.OrganizationId, correlationId, Fact(booking, booking.Status, 0, 0), cancellationToken);

    public Task RefundRequestedAsync(Guid bookingId, Guid paymentId, long amount, string currency, string reason, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("RefundRequested", bookingId, null, correlationId, new { bookingId, paymentId, amount, currency, reason }, cancellationToken);

    public Task BookingCancelledAsync(BookingRecord booking, string reason, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("BookingCancelled", booking.Id, booking.OrganizationId, correlationId, Fact(booking, "CANCELLED", 0, 0) with { Reason = reason }, cancellationToken);

    private static BookingFactPayload Fact(BookingRecord booking, string status, long cancellationFee, long refundedAmount) =>
        new(
            booking.Id,
            booking.Code,
            booking.OrganizationId,
            booking.CustomerId,
            booking.TripId,
            "",
            booking.ExpiresAt,
            status,
            booking.PaymentChannel,
            booking.Items.Count,
            booking.Total,
            cancellationFee,
            refundedAmount,
            booking.Total - refundedAmount,
            booking.Currency,
            DateTimeOffset.UtcNow,
            null);

    private sealed record BookingFactPayload(
        Guid BookingId,
        string BookingCode,
        Guid OrganizationId,
        Guid CustomerId,
        Guid TripId,
        string RouteName,
        DateTimeOffset DepartureAt,
        string Status,
        string PaymentChannel,
        int SeatCount,
        long GrossAmount,
        long CancellationFee,
        long RefundedAmount,
        long NetAmount,
        string Currency,
        DateTimeOffset BookedAt,
        string? Reason);

    public Task InventoryReadyAsync(Guid tripId, Guid correlationId, CancellationToken cancellationToken) =>
        Enqueue("TripInventoryReady", tripId, null, correlationId, new { tripId }, cancellationToken);

    private Task Enqueue(string type, Guid aggregateId, Guid? tenantId, Guid correlationId, object payload, CancellationToken cancellationToken) =>
        outbox.EnqueueAsync(
            new EventMessage(ids.NewUuidV7(), type, 1, DateTimeOffset.UtcNow, "booking", correlationId, aggregateId, JsonSerializer.SerializeToElement(payload, EventMessageJson.Options), null, null, tenantId),
            cancellationToken);
}
