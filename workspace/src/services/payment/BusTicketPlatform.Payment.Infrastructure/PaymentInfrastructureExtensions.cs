using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Payment.Application;
using BusTicketPlatform.Payment.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.Payment.Infrastructure;

public static class PaymentInfrastructureExtensions
{
    public static IServiceCollection AddPaymentInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var options = new PaymentDatabaseOptions
        {
            ConnectionString = configuration.GetConnectionString(PaymentDatabaseOptions.ConnectionStringName) ?? ""
        };
        services.AddSingleton(options);
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IdempotencyStore>();
        services.AddSingleton<IIdempotencyStore>(sp => sp.GetRequiredService<IdempotencyStore>());
        services.AddSingleton<ICheckoutRequestRecovery>(sp => sp.GetRequiredService<IdempotencyStore>());
        services.AddSingleton<PaymentRepository>();
        services.AddSingleton<IPaymentRepository>(sp => sp.GetRequiredService<PaymentRepository>());
        services.AddSingleton<ISePayPaymentStore>(sp => sp.GetRequiredService<PaymentRepository>());
        var sepay = new SePayOptions();
        configuration.GetSection("SePay").Bind(sepay);
        services.AddSingleton(sepay);
        services.AddSingleton<OutboxWriter>();
        services.AddSingleton(sp => new BusTicketPlatform.BuildingBlocks.Messaging.OutboxRelay(sp.GetRequiredService<PaymentDatabaseOptions>().ConnectionString));
        services.AddHostedService<BusTicketPlatform.BuildingBlocks.Messaging.OutboxDispatchHostedService>();
        services.AddSingleton(_ =>
        {
            var vnPay = new VnPayOptions();
            var section = configuration.GetSection(VnPayOptions.SectionName);
            vnPay.Enabled = bool.TryParse(section["Enabled"], out var enabled) && enabled;
            vnPay.CheckoutBaseUrl = section["CheckoutBaseUrl"] ?? vnPay.CheckoutBaseUrl;
            vnPay.TmnCode = section["TmnCode"] ?? vnPay.TmnCode;
            vnPay.HashSecret = section["HashSecret"] ?? vnPay.HashSecret;
            vnPay.DefaultClientIp = section["DefaultClientIp"] ?? vnPay.DefaultClientIp;
            if (decimal.TryParse(section["DefaultCommissionRate"], out var rate) && rate > 0)
            {
                vnPay.DefaultCommissionRate = rate;
            }

            return vnPay;
        });
        services.AddSingleton<IPaymentEvents, PaymentEvents>();
        services.AddSingleton<PaymentService>();
        services.AddEventSubscription(new EventSubscription(
            Topology.PaymentRefundQueue,
            "payment-refund",
            options.ConnectionString,
            [Topology.BookingCreatedRoutingKey, Topology.BookingCancelledRoutingKey, Topology.RefundRequestedRoutingKey],
            PaymentEventHandlers.HandleAsync));
        return services;
    }

    public static IHealthChecksBuilder AddPaymentDatabaseCheck(this IHealthChecksBuilder builder) =>
        builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
}
