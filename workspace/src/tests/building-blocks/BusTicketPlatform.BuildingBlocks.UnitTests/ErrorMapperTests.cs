using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Http;

namespace BusTicketPlatform.BuildingBlocks.UnitTests;

public sealed class ErrorMapperTests
{
    [Fact]
    public void Unknown_exception_maps_to_internal_error()
    {
        var correlationId = Guid.CreateVersion7();
        var error = ErrorMapper.FromUnknown(new InvalidOperationException("secret"), correlationId);

        Assert.Equal(ErrorCodes.InternalError, error.Code);
        Assert.Equal(500, error.StatusCode);
        Assert.DoesNotContain("secret", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(404, ErrorCodes.ResourceNotFound)]
    [InlineData(401, ErrorCodes.AuthenticationRequired)]
    [InlineData(403, ErrorCodes.AccessDenied)]
    [InlineData(503, ErrorCodes.UpstreamUnavailable)]
    public void Status_code_maps_to_catalog(int status, string code)
    {
        var error = ErrorMapper.FromStatus(status, Guid.CreateVersion7());
        Assert.Equal(code, error.Code);
        Assert.Equal(status, error.StatusCode);
    }

    [Fact]
    public void Envelope_includes_correlation_id()
    {
        var correlationId = Guid.CreateVersion7();
        var envelope = ErrorEnvelope.From(AppError.NotFound("missing"), correlationId);

        Assert.Equal(ErrorCodes.ResourceNotFound, envelope.Error.Code);
        Assert.Equal(correlationId, envelope.Error.CorrelationId);
    }
}
