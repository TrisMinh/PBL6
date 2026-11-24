using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Transport.Application;
using BusTicketPlatform.Transport.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace BusTicketPlatform.Transport.Infrastructure;

public static class TransportInfrastructureExtensions
{
    public static IServiceCollection AddTransportInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<PublicTransportCache>();
        var connectionString = configuration.GetConnectionString(TransportDatabaseOptions.ConnectionStringName);
        var connection = string.IsNullOrWhiteSpace(connectionString) ? null : new NpgsqlConnectionStringBuilder(connectionString);
        if (connection is not null && !connection.ShouldSerialize("MaxPoolSize"))
            connection.MaxPoolSize = 24;
        var options = new TransportDatabaseOptions
        {
            ConnectionString = connection?.ConnectionString ?? ""
        };
        services.AddSingleton(options);
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IIdempotencyStore, IdempotencyStore>();
        services.AddSingleton<ITransportRepository, TransportRepository>();
        services.AddSingleton<OutboxWriter>();
        services.AddSingleton(sp => new BusTicketPlatform.BuildingBlocks.Messaging.OutboxRelay(sp.GetRequiredService<TransportDatabaseOptions>().ConnectionString));
        services.AddHostedService<BusTicketPlatform.BuildingBlocks.Messaging.OutboxDispatchHostedService>();
        services.AddSingleton<ITransportEvents, TransportEvents>();
        services.AddSingleton<TransportService>();
        services.AddEventSubscription(new EventSubscription(
            Topology.TransportInventoryQueue,
            "transport-inventory",
            options.ConnectionString,
            [Topology.TripInventoryReadyRoutingKey],
            TransportEventHandlers.HandleInventoryReadyAsync));
        return services;
    }

    public static IHealthChecksBuilder AddTransportDatabaseCheck(this IHealthChecksBuilder builder) =>
        builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
}
