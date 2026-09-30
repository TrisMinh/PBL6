using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Notification.Application;
using BusTicketPlatform.Notification.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.Notification.Infrastructure;

public static class NotificationInfrastructureExtensions
{
    public static IServiceCollection AddNotificationInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var options = new NotificationDatabaseOptions
        {
            ConnectionString = configuration.GetConnectionString(NotificationDatabaseOptions.ConnectionStringName) ?? ""
        };
        services.AddSingleton(options);
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IIdempotencyStore, IdempotencyStore>();
        services.AddSingleton<INotificationRepository, NotificationRepository>();
        services.AddSingleton<NotificationService>();
        services.AddEventSubscription(new EventSubscription(
            Topology.NotificationEventsQueue,
            "notification-events",
            options.ConnectionString,
            [
                Topology.UserRegisteredRoutingKey,
                Topology.BookingCreatedRoutingKey,
                Topology.BookingPaidRoutingKey,
                Topology.BookingCancelledRoutingKey,
                Topology.TicketIssuedRoutingKey,
                Topology.PaymentSucceededRoutingKey
            ],
            NotificationEventHandlers.HandleAsync));
        return services;
    }

    public static IHealthChecksBuilder AddNotificationDatabaseCheck(this IHealthChecksBuilder builder) =>
        builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
}
