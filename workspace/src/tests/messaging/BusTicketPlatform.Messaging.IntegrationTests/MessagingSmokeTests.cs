using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Identity.Infrastructure;
using Json.Schema;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;

namespace BusTicketPlatform.Messaging.IntegrationTests;

[CollectionDefinition("MessagingSmoke", DisableParallelization = true)]
public sealed class MessagingSmokeCollection : ICollectionFixture<MessagingSmokeFixture>;

public sealed class MessagingSmokeFixture : IAsyncLifetime
{
    public PostgreSqlContainer Postgres { get; } = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("identity")
        .WithUsername("platform")
        .WithPassword("postgres")
        .Build();

    public RabbitMqContainer Rabbit { get; } = new RabbitMqBuilder()
        .WithImage("rabbitmq:4.1-management-alpine")
        .Build();

    public async Task InitializeAsync()
    {
        await Task.WhenAll(Postgres.StartAsync(), Rabbit.StartAsync());
        var migrator = new SqlBaselineMigrator(new IdentityDatabaseOptions
        {
            ConnectionString = Postgres.GetConnectionString()
        });
        await migrator.ApplyAsync();
    }

    public async Task DisposeAsync()
    {
        await Rabbit.DisposeAsync();
        await Postgres.DisposeAsync();
    }
}

[Collection("MessagingSmoke")]
public sealed class MessagingSmokeTests
{
    private readonly MessagingSmokeFixture _fixture;

    public MessagingSmokeTests(MessagingSmokeFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Publish_consume_dedupes_and_poison_goes_to_dlq()
    {
        var inbox = new global::BusTicketPlatform.BuildingBlocks.Messaging.InboxDeduper(_fixture.Postgres.GetConnectionString());
        await using var bus = await RabbitMqSmokeBus.ConnectAsync(_fixture.Rabbit.GetConnectionString(), CancellationToken.None);
        const string queue = "identity.smoke.q";
        const string dlq = "identity.smoke.dlq";
        await bus.DeclareSmokeTopologyAsync(queue, dlq, CancellationToken.None);

        var message = CreateUserRegistered();
        await bus.PublishAsync(message, Topology.UserRegisteredRoutingKey, CancellationToken.None);
        var first = await WaitForMessage(bus, queue);
        Assert.Equal("UserRegistered", first.Type);
        AssertValidEnvelope(first.Body);
        var hash = Convert.ToHexString(SHA256.HashData(first.Body.Span));
        Assert.True(await inbox.TryAcceptAsync("identity-smoke", message.EventId, "UserRegistered", hash, CancellationToken.None));
        await bus.AckAsync(first.DeliveryTag, CancellationToken.None);

        await bus.PublishAsync(message, Topology.UserRegisteredRoutingKey, CancellationToken.None);
        var duplicate = await WaitForMessage(bus, queue);
        Assert.False(await inbox.TryAcceptAsync("identity-smoke", message.EventId, "UserRegistered", hash, CancellationToken.None));
        await bus.AckAsync(duplicate.DeliveryTag, CancellationToken.None);

        await bus.PublishAsync(
            message with { EventType = "NotARealEvent" },
            Topology.UserRegisteredRoutingKey,
            CancellationToken.None);
        var poison = await WaitForMessage(bus, queue);
        Assert.NotEqual("UserRegistered", poison.Type);
        await bus.RejectAsync(poison.DeliveryTag, requeue: false, CancellationToken.None);
        var dead = await WaitForMessage(bus, dlq);
        Assert.Equal("NotARealEvent", dead.Type);
        await bus.AckAsync(dead.DeliveryTag, CancellationToken.None);
    }

    [Fact]
    public async Task Outbox_retries_after_publish_failure()
    {
        var options = new IdentityDatabaseOptions { ConnectionString = _fixture.Postgres.GetConnectionString() };
        var outbox = new OutboxPublisher(options);
        var message = CreateUserRegistered();
        await outbox.EnqueueAsync(message, CancellationToken.None);

        var failed = await outbox.PublishPendingAsync(new ThrowingPublisher(), CancellationToken.None);
        Assert.Equal(0, failed.Published);
        Assert.True(failed.Failed >= 1);

        await using var bus = await RabbitMqSmokeBus.ConnectAsync(_fixture.Rabbit.GetConnectionString(), CancellationToken.None);
        const string queue = "identity.outbox.q";
        const string dlq = "identity.outbox.dlq";
        await bus.DeclareSmokeTopologyAsync(queue, dlq, CancellationToken.None);

        var published = await outbox.PublishPendingAsync(bus, CancellationToken.None);
        Assert.Equal(1, published.Published);
        Assert.Equal(0, published.Failed);

        var consumed = await WaitForMessage(bus, queue);
        Assert.Equal("UserRegistered", consumed.Type);
        AssertValidEnvelope(consumed.Body);
        await bus.AckAsync(consumed.DeliveryTag, CancellationToken.None);
    }

    [Fact]
    public async Task Reconnects_after_broker_restart()
    {
        await using (var warmup = await RabbitMqSmokeBus.ConnectAsync(_fixture.Rabbit.GetConnectionString(), CancellationToken.None))
        {
            await warmup.DeclareSmokeTopologyAsync("identity.restart.q", "identity.restart.dlq", CancellationToken.None);
        }

        await _fixture.Rabbit.StopAsync();
        await _fixture.Rabbit.StartAsync();

        await using var bus = await RabbitMqSmokeBus.ConnectAsync(_fixture.Rabbit.GetConnectionString(), CancellationToken.None);
        await bus.DeclareSmokeTopologyAsync("identity.restart.q", "identity.restart.dlq", CancellationToken.None);
        var message = CreateUserRegistered();
        await bus.PublishAsync(message, Topology.UserRegisteredRoutingKey, CancellationToken.None);
        var consumed = await WaitForMessage(bus, "identity.restart.q");
        Assert.Equal("UserRegistered", consumed.Type);
        await bus.AckAsync(consumed.DeliveryTag, CancellationToken.None);
    }

    private static EventMessage CreateUserRegistered()
    {
        var userId = Guid.CreateVersion7();
        var payload = JsonSerializer.SerializeToElement(new
        {
            userId,
            verificationChannel = "EMAIL",
            registeredAt = DateTimeOffset.UtcNow
        });
        return new EventMessage(
            EventId: Guid.CreateVersion7(),
            EventType: "UserRegistered",
            Version: 1,
            OccurredAt: DateTimeOffset.UtcNow,
            Producer: "identity-service",
            CorrelationId: Guid.CreateVersion7(),
            AggregateId: userId,
            Payload: payload);
    }

    private static void AssertValidEnvelope(ReadOnlyMemory<byte> body)
    {
        var node = JsonNode.Parse(body.Span);
        var schema = JsonSchema.FromFile(Path.Combine(RepoRoot(), "docs", "contracts", "schemas", "platform-message.schema.json"));
        var result = schema.Evaluate(node, new EvaluationOptions { OutputFormat = OutputFormat.List });
        Assert.True(result.IsValid);
    }

    private static async Task<(ulong DeliveryTag, string? Type, ReadOnlyMemory<byte> Body)> WaitForMessage(
        RabbitMqSmokeBus bus,
        string queue)
    {
        for (var i = 0; i < 40; i++)
        {
            var got = await bus.GetAsync(queue, CancellationToken.None);
            if (got is not null)
            {
                return got.Value;
            }

            await Task.Delay(250);
        }

        throw new TimeoutException($"No message on {queue}.");
    }

    private static string RepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docs", "contracts", "schemas", "platform-message.schema.json")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("repository root was not found.");
    }

    private sealed class ThrowingPublisher : IEventPublisher
    {
        public Task PublishAsync(EventMessage message, string routingKey, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("broker unavailable");
    }
}
