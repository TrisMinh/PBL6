using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Notification.Application;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Notification.Infrastructure;

public static class NotificationEventHandlers
{
    private static readonly string[] UserIdProperties = ["userId", "customerId"];

    public static Task HandleAsync(IServiceProvider services, EventMessage message, CancellationToken cancellationToken)
    {
        if (!TryUserId(message.Payload, out var userId))
        {
            return Task.CompletedTask;
        }

        var (type, title, body) = message.EventType switch
        {
            "UserRegistered" => ("USER_REGISTERED", "Welcome to BusTicket", "Your account is ready."),
            "BookingCreated" => ("BOOKING_CREATED", "Booking created", "Your booking was created."),
            "BookingPaid" => ("BOOKING_PAID", "Booking paid", "Payment for your booking succeeded."),
            "TicketIssued" => ("TICKET_ISSUED", "Tickets issued", "Your tickets are ready."),
            "BookingCancelled" => ("BOOKING_CANCELLED", "Booking cancelled", "Your booking was cancelled."),
            "PaymentSucceeded" => ("PAYMENT_SUCCEEDED", "Payment received", "Your payment was successful."),
            _ => (message.EventType, message.EventType, "A platform event occurred.")
        };

        return services.GetRequiredService<NotificationService>().IngestAsync(
            new IngestNotification(userId, type, title, body, message.EventId.ToString(), message.EventType, message.AggregateId.ToString()),
            cancellationToken);
    }

    private static bool TryUserId(JsonElement payload, out Guid userId)
    {
        foreach (var name in UserIdProperties)
        {
            if (EventPayload.TryGuid(payload, name, out userId))
            {
                return true;
            }
        }

        userId = Guid.Empty;
        return false;
    }
}
