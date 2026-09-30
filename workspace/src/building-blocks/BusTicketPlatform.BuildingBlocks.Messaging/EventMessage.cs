using System.Text.Json;
using System.Text.Json.Serialization;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed record EventMessage(
    Guid EventId,
    string EventType,
    int Version,
    DateTimeOffset OccurredAt,
    string Producer,
    Guid CorrelationId,
    Guid AggregateId,
    JsonElement Payload,
    string? CausationId = null,
    long? AggregateVersion = null,
    Guid? TenantId = null);

public static class EventMessageJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

public static class EventPayload
{
    public static T? Deserialize<T>(JsonElement payload) =>
        payload.ValueKind is JsonValueKind.Object or JsonValueKind.Array
            ? payload.Deserialize<T>(EventMessageJson.Options)
            : default;

    public static bool TryGuid(JsonElement payload, string name, out Guid value)
    {
        value = Guid.Empty;
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(name, out var element))
        {
            return false;
        }

        if (element.ValueKind == JsonValueKind.String && Guid.TryParse(element.GetString(), out value))
        {
            return true;
        }

        return element.TryGetGuid(out value);
    }

    public static string String(JsonElement payload, string name, string fallback = "")
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(name, out var element))
        {
            return fallback;
        }

        return element.ValueKind == JsonValueKind.String ? element.GetString() ?? fallback : fallback;
    }
}

public static class Topology
{
    public const string EventsExchange = "platform.events";
    public const string CommandsExchange = "platform.commands";
    public const string RetryExchange = "platform.retry";
    public const string DeadLetterExchange = "platform.dlx";
    public const string BookingTripQueue = "booking.trip-events.q";
    public const string BookingPaymentQueue = "booking.payment-events.q";
    public const string TransportInventoryQueue = "transport.inventory-events.q";
    public const string PaymentRefundQueue = "payment.refund-requests.q";
    public const string NotificationEventsQueue = "notification.integration-events.q";
    public const string ReportingEventsQueue = "reporting.integration-events.q";
    public const string UserRegisteredRoutingKey = "identity.user.registered.v1";
    public const string TripPublishedRoutingKey = "transport.trip.published.v1";
    public const string TripUpdatedRoutingKey = "transport.trip.updated.v1";
    public const string TripStatusChangedRoutingKey = "transport.trip.status-changed.v1";
    public const string TripCancelledRoutingKey = "transport.trip.cancelled.v1";
    public const string TripInventoryReadyRoutingKey = "booking.trip-inventory.ready.v1";
    public const string SeatHoldCreatedRoutingKey = "booking.seat-hold.created.v1";
    public const string BookingCreatedRoutingKey = "booking.booking.created.v1";
    public const string BookingPaidRoutingKey = "booking.booking.paid.v1";
    public const string BookingCancelledRoutingKey = "booking.booking.cancelled.v1";
    public const string TicketIssuedRoutingKey = "booking.ticket.issued.v1";
    public const string TicketCancelledRoutingKey = "booking.ticket.cancelled.v1";
    public const string TicketCheckedInRoutingKey = "booking.ticket.checked-in.v1";
    public const string RefundRequestedRoutingKey = "booking.refund.requested.v1";
    public const string PaymentSucceededRoutingKey = "payment.payment.succeeded.v1";
    public const string PaymentFailedRoutingKey = "payment.payment.failed.v1";
    public const string RefundSucceededRoutingKey = "payment.refund.succeeded.v1";
    public const string RefundFailedRoutingKey = "payment.refund.failed.v1";
}
