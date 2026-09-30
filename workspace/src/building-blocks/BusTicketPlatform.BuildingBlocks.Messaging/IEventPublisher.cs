namespace BusTicketPlatform.BuildingBlocks.Messaging;

public interface IEventPublisher
{
    Task PublishAsync(EventMessage message, string routingKey, CancellationToken cancellationToken);
}
