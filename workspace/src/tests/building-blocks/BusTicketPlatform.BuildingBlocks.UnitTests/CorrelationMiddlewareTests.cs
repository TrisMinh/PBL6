using BusTicketPlatform.BuildingBlocks.AspNetCore.Correlation;
using BusTicketPlatform.BuildingBlocks.Ids;

namespace BusTicketPlatform.BuildingBlocks.UnitTests;

public sealed class CorrelationMiddlewareTests
{
    [Fact]
    public void Reuses_valid_incoming_correlation_id()
    {
        var incoming = Guid.CreateVersion7();
        var resolved = CorrelationMiddleware.Resolve(incoming.ToString(), new ThrowingIdGenerator());
        Assert.Equal(incoming, resolved);
    }

    [Fact]
    public void Generates_uuidv7_when_header_missing()
    {
        var generated = Guid.CreateVersion7();
        var resolved = CorrelationMiddleware.Resolve(null, new StubIdGenerator(generated));
        Assert.Equal(generated, resolved);
        Assert.Equal(7, resolved.Version);
    }

    private sealed class StubIdGenerator(Guid value) : IIdGenerator
    {
        public Guid NewUuidV7() => value;
    }

    private sealed class ThrowingIdGenerator : IIdGenerator
    {
        public Guid NewUuidV7() => throw new InvalidOperationException("should not generate");
    }
}
