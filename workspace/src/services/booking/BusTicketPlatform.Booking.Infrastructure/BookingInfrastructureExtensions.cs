using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.Booking.Infrastructure.Persistence;
using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.Booking.Infrastructure;

public static class BookingInfrastructureExtensions
{
    public static IServiceCollection AddBookingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var options = new BookingDatabaseOptions
        {
            ConnectionString = configuration.GetConnectionString(BookingDatabaseOptions.ConnectionStringName) ?? ""
        };
        services.AddSingleton(options);
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IIdempotencyStore, IdempotencyStore>();
        services.AddSingleton<IBookingRepository, BookingRepository>();
        services.AddSingleton<OutboxWriter>();
        services.AddSingleton(sp => new BusTicketPlatform.BuildingBlocks.Messaging.OutboxRelay(sp.GetRequiredService<BookingDatabaseOptions>().ConnectionString));
        services.AddHostedService<BusTicketPlatform.BuildingBlocks.Messaging.OutboxDispatchHostedService>();
        services.AddSingleton<IBookingEvents, BookingEvents>();
        services.AddSingleton(new TicketQrOptions
        {
            SigningKey = configuration["Authentication:SigningKey"] ?? "local-dev-only-change-me-32bytes-min"
        });
        services.AddSingleton<BookingService>();
        services.AddEventSubscription(new EventSubscription(
            Topology.BookingTripQueue,
            "booking-trip",
            options.ConnectionString,
            ["transport.trip.*.v1"],
            BookingEventHandlers.HandleTripAsync));
        services.AddEventSubscription(new EventSubscription(
            Topology.BookingPaymentQueue,
            "booking-payment",
            options.ConnectionString,
            ["payment.payment.*.v1", "payment.refund.*.v1"],
            BookingEventHandlers.HandlePaymentAsync));
        return services;
    }

    public static IHealthChecksBuilder AddBookingDatabaseCheck(this IHealthChecksBuilder builder) =>
        builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
}
