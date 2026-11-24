using BusTicketPlatform.Payment.Application;
using BusTicketPlatform.Payment.Infrastructure;

namespace BusTicketPlatform.Payment.Api;

public sealed class SePayReconciliationWorker(
    SePayOptions options,
    PaymentDatabaseOptions database,
    IServiceProvider services,
    ILogger<SePayReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.AutomaticReconciliationEnabled || !options.IsConfigured || !database.IsConfigured) return;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = services.CreateAsyncScope();
                var reconciliation = scope.ServiceProvider.GetRequiredService<SePayReconciliation>();
                var failures = await reconciliation.CheckDueAsync(stoppingToken);
                if (failures > 0)
                    logger.LogWarning("Scheduled SePay lookup could not verify {PaymentCount} payments", failures);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Scheduled SePay reconciliation failed");
            }
        }
    }
}
