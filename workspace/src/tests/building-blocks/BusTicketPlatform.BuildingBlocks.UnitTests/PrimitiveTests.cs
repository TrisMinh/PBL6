using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Time;

namespace BusTicketPlatform.BuildingBlocks.UnitTests;

public sealed class PrimitiveTests
{
    [Fact]
    public void Uuid_v7_generator_creates_version_7()
    {
        var id = new UuidV7IdGenerator().NewUuidV7();
        Assert.Equal(7, id.Version);
        Assert.NotEqual(Guid.Empty, id);
    }

    [Fact]
    public void System_clock_is_utc()
    {
        var now = new SystemClock().UtcNow;
        Assert.Equal(TimeSpan.Zero, now.Offset);
        Assert.True(now <= DateTimeOffset.UtcNow.AddSeconds(1));
    }
}
