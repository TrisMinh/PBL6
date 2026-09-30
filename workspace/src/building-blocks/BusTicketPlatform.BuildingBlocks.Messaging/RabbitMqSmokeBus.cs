using System.Text.Json;
using RabbitMQ.Client;

namespace BusTicketPlatform.BuildingBlocks.Messaging;

public sealed class RabbitMqSmokeBus : IEventPublisher, IAsyncDisposable
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;

    private RabbitMqSmokeBus(IConnection connection, IChannel channel)
    {
        _connection = connection;
        _channel = channel;
    }

    public static async Task<RabbitMqSmokeBus> ConnectAsync(string amqpUri, CancellationToken cancellationToken)
    {
        var factory = new ConnectionFactory { Uri = new Uri(amqpUri) };
        var connection = await factory.CreateConnectionAsync(cancellationToken);
        var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
        return new RabbitMqSmokeBus(connection, channel);
    }

    public async Task DeclareSmokeTopologyAsync(string queue, string dlq, CancellationToken cancellationToken)
    {
        await _channel.ExchangeDeclareAsync(Topology.EventsExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await _channel.ExchangeDeclareAsync(Topology.DeadLetterExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await _channel.QueueDeclareAsync(dlq, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
        await _channel.QueueBindAsync(dlq, Topology.DeadLetterExchange, routingKey: "#", cancellationToken: cancellationToken);
        await _channel.QueueDeclareAsync(
            queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-dead-letter-exchange"] = Topology.DeadLetterExchange
            },
            cancellationToken: cancellationToken);
        await _channel.QueueBindAsync(queue, Topology.EventsExchange, Topology.UserRegisteredRoutingKey, cancellationToken: cancellationToken);
    }

    public async Task EnsureConsumerAsync(string queue, IReadOnlyList<string> routingKeys, CancellationToken cancellationToken)
    {
        await _channel.ExchangeDeclareAsync(Topology.EventsExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await _channel.ExchangeDeclareAsync(Topology.DeadLetterExchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
        await _channel.QueueDeclareAsync(
            queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-dead-letter-exchange"] = Topology.DeadLetterExchange
            },
            cancellationToken: cancellationToken);
        foreach (var routingKey in routingKeys)
        {
            await _channel.QueueBindAsync(queue, Topology.EventsExchange, routingKey, cancellationToken: cancellationToken);
        }
    }

    public async Task PublishAsync(EventMessage message, string routingKey, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(message, EventMessageJson.Options);
        var properties = new BasicProperties
        {
            MessageId = message.EventId.ToString(),
            Type = message.EventType,
            ContentType = "application/json",
            ContentEncoding = "utf-8",
            DeliveryMode = DeliveryModes.Persistent,
            CorrelationId = message.CorrelationId.ToString(),
            Headers = new Dictionary<string, object?> { ["schema-version"] = message.Version }
        };

        await _channel.BasicPublishAsync(
            Topology.EventsExchange,
            routingKey,
            mandatory: true,
            basicProperties: properties,
            body: body,
            cancellationToken: cancellationToken);
    }

    public async Task<(ulong DeliveryTag, string? Type, ReadOnlyMemory<byte> Body)?> GetAsync(string queue, CancellationToken cancellationToken)
    {
        var result = await _channel.BasicGetAsync(queue, autoAck: false, cancellationToken);
        if (result is null)
        {
            return null;
        }

        return (result.DeliveryTag, result.BasicProperties.Type, result.Body);
    }

    public Task AckAsync(ulong deliveryTag, CancellationToken cancellationToken) =>
        _channel.BasicAckAsync(deliveryTag, multiple: false, cancellationToken).AsTask();

    public Task RejectAsync(ulong deliveryTag, bool requeue, CancellationToken cancellationToken) =>
        _channel.BasicNackAsync(deliveryTag, multiple: false, requeue, cancellationToken).AsTask();

    public async ValueTask DisposeAsync()
    {
        await _channel.DisposeAsync();
        await _connection.DisposeAsync();
    }
}
