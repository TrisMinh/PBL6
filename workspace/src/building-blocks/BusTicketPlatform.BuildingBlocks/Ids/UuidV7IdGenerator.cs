namespace BusTicketPlatform.BuildingBlocks.Ids;

public sealed class UuidV7IdGenerator : IIdGenerator
{
    public Guid NewUuidV7() => Guid.CreateVersion7();
}
