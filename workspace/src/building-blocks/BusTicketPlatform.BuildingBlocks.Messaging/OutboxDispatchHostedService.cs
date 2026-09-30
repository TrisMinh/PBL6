using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed class OutboxDispatchHostedService(
    OutboxRelay relay,
    IConfiguration configuration,
    ILogger<OutboxDispatchHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var uri = configuration["Messaging:AmqpUri"];
        if (string.IsNullOrWhiteSpace(uri))
        {
            return;
        }

        await using var bus = await RabbitMqSmokeBus.ConnectAsync(uri, stoppingToken);
        logger.LogInformation("Outbox dispatcher connected to RabbitMQ");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await relay.PublishPendingAsync(bus, stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Outbox dispatch cycle failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
}
