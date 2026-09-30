using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Reporting.Application;
using BusTicketPlatform.Reporting.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.Reporting.Infrastructure;

public static class ReportingInfrastructureExtensions
{
    public static IServiceCollection AddReportingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var options = new ReportingDatabaseOptions
        {
            ConnectionString = configuration.GetConnectionString(ReportingDatabaseOptions.ConnectionStringName) ?? ""
        };
        services.AddSingleton(options);
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IReportingRepository, ReportingRepository>();
        services.AddSingleton<ReportingService>();
        services.AddEventSubscription(new EventSubscription(
            Topology.ReportingEventsQueue,
            "reporting-facts",
            options.ConnectionString,
            ["booking.booking.*.v1", "payment.payment.*.v1"],
            ReportingEventHandlers.HandleAsync));
        return services;
    }

    public static IHealthChecksBuilder AddReportingDatabaseCheck(this IHealthChecksBuilder builder) =>
        builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
}
