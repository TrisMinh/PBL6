using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.Messaging.IntegrationTests;

[Collection("MessagingSmoke")]
public sealed class IntegrationEventConsumerTests
{
    private readonly MessagingSmokeFixture _fixture;

    public IntegrationEventConsumerTests(MessagingSmokeFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Host_consumes_trip_published_once()
    {
        var hits = new int[1];
        var first = new TaskCompletionSource<EventMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var config = new ConfigurationManager();
        config["Messaging:AmqpUri"] = _fixture.Rabbit.GetConnectionString();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(config);
        services.AddEventSubscription(new EventSubscription(
            "booking.trip-events.q",
            "booking-trip-it",
            _fixture.Postgres.GetConnectionString(),
            ["transport.trip.*.v1"],
            (_, message, _) =>
            {
                Interlocked.Increment(ref hits[0]);
                first.TrySetResult(message);
                return Task.CompletedTask;
            }));

        await using var provider = services.BuildServiceProvider();
        var hosted = provider.GetServices<IHostedService>().OfType<IntegrationEventConsumerHost>().Single();
        await hosted.StartAsync(CancellationToken.None);
        try
        {
            await using var bus = await RabbitMqSmokeBus.ConnectAsync(_fixture.Rabbit.GetConnectionString(), CancellationToken.None);
            var payload = JsonSerializer.SerializeToElement(new { tripId = Guid.CreateVersion7() }, EventMessageJson.Options);
            var message = new EventMessage(
                Guid.CreateVersion7(),
                "TripPublished",
                1,
                DateTimeOffset.UtcNow,
                "transport",
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                payload);
            await Task.Delay(TimeSpan.FromSeconds(2));
            await bus.PublishAsync(message, Topology.TripPublishedRoutingKey, CancellationToken.None);
            var received = await first.Task.WaitAsync(TimeSpan.FromSeconds(20));
            Assert.Equal("TripPublished", received.EventType);

            await bus.PublishAsync(message, Topology.TripPublishedRoutingKey, CancellationToken.None);
            await Task.Delay(1500);
            Assert.Equal(1, hits[0]);
        }
        finally
        {
            await hosted.StopAsync(CancellationToken.None);
        }
    }
}
