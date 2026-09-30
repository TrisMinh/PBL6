using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed record EventSubscription(
    string Queue,
    string ConsumerName,
    string InboxConnectionString,
    IReadOnlyList<string> RoutingKeys,
    Func<IServiceProvider, EventMessage, CancellationToken, Task> Handle);

public static class MessagingHostExtensions
{
    public static IServiceCollection AddEventSubscription(this IServiceCollection services, EventSubscription subscription)
    {
        services.AddSingleton(subscription);
        services.TryAddEventConsumerHost();
        return services;
    }

    private static void TryAddEventConsumerHost(this IServiceCollection services)
    {
        if (services.Any(descriptor => descriptor.ImplementationType == typeof(IntegrationEventConsumerHost)))
        {
            return;
        }

        services.AddHostedService<IntegrationEventConsumerHost>();
    }
}

public sealed class IntegrationEventConsumerHost(
    IEnumerable<EventSubscription> subscriptions,
    IServiceProvider services,
    IConfiguration configuration,
    ILogger<IntegrationEventConsumerHost> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var uri = configuration["Messaging:AmqpUri"];
        var list = subscriptions.ToArray();
        if (string.IsNullOrWhiteSpace(uri) || list.Length == 0)
        {
            return;
        }

        await using var bus = await RabbitMqSmokeBus.ConnectAsync(uri, stoppingToken);
        foreach (var subscription in list)
        {
            await bus.EnsureConsumerAsync(subscription.Queue, subscription.RoutingKeys, stoppingToken);
        }

        logger.LogInformation("Event consumers bound: {Queues}", string.Join(", ", list.Select(item => item.Queue)));
        await Task.WhenAll(list.Select(subscription => PumpAsync(bus, subscription, stoppingToken)));
    }

    private async Task PumpAsync(RabbitMqSmokeBus bus, EventSubscription subscription, CancellationToken stoppingToken)
    {
        var inbox = new InboxDeduper(subscription.InboxConnectionString);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var delivered = await bus.GetAsync(subscription.Queue, stoppingToken);
                if (delivered is null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
                    continue;
                }

                EventMessage? message = null;
                try
                {
                    message = System.Text.Json.JsonSerializer.Deserialize<EventMessage>(delivered.Value.Body.Span, EventMessageJson.Options);
                    if (message is not null)
                    {
                        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(delivered.Value.Body.Span));
                        if (await inbox.TryAcceptAsync(subscription.ConsumerName, message.EventId, message.EventType, hash, stoppingToken))
                        {
                            await subscription.Handle(services, message, stoppingToken);
                        }
                    }

                    await bus.AckAsync(delivered.Value.DeliveryTag, stoppingToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    logger.LogError(exception, "Failed handling {Type} on {Queue}", message?.EventType ?? delivered.Value.Type, subscription.Queue);
                    await bus.RejectAsync(delivered.Value.DeliveryTag, requeue: false, stoppingToken);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Consume loop failed for {Queue}", subscription.Queue);
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
        }
    }
}
