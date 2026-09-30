namespace BusTicketPlatform.BuildingBlocks.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
