namespace BusTicketPlatform.BuildingBlocks.Messaging;

public static class OutboxRouting
{
    public static string KeyFor(string messageType) => messageType switch
    {
        "UserRegistered" => Topology.UserRegisteredRoutingKey,
        "TripPublished" => Topology.TripPublishedRoutingKey,
        "TripUpdated" => Topology.TripUpdatedRoutingKey,
        "TripStatusChanged" => Topology.TripStatusChangedRoutingKey,
        "TripCancelled" => Topology.TripCancelledRoutingKey,
        "TripInventoryReady" => Topology.TripInventoryReadyRoutingKey,
        "SeatHoldCreated" => Topology.SeatHoldCreatedRoutingKey,
        "BookingCreated" => Topology.BookingCreatedRoutingKey,
        "BookingPaid" => Topology.BookingPaidRoutingKey,
        "BookingCancelled" => Topology.BookingCancelledRoutingKey,
        "TicketIssued" => Topology.TicketIssuedRoutingKey,
        "TicketCancelled" => Topology.TicketCancelledRoutingKey,
        "TicketCheckedIn" => Topology.TicketCheckedInRoutingKey,
        "RefundRequested" => Topology.RefundRequestedRoutingKey,
        "PaymentSucceeded" => Topology.PaymentSucceededRoutingKey,
        "PaymentFailed" => Topology.PaymentFailedRoutingKey,
        "RefundSucceeded" => Topology.RefundSucceededRoutingKey,
        "RefundFailed" => Topology.RefundFailedRoutingKey,
        _ => throw new InvalidOperationException($"No routing key mapped for '{messageType}'.")
    };
}
