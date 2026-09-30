using System.Text.Json.Serialization;
using BusTicketPlatform.BuildingBlocks.Errors;

namespace BusTicketPlatform.BuildingBlocks.Http;

public sealed record ErrorEnvelope(ErrorEnvelopeBody Error)
{
    public static ErrorEnvelope From(AppError error, Guid correlationId) =>
        new(new ErrorEnvelopeBody(error.Code, error.Message, correlationId, error.Details));
}

public sealed record ErrorEnvelopeBody(
    string Code,
    string Message,
    [property: JsonPropertyName("correlationId")] Guid CorrelationId,
    IReadOnlyDictionary<string, object>? Details);
