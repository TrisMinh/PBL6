namespace BusTicketPlatform.Identity.Api;

public sealed record ErrorEnvelope(ErrorBody Error);

public sealed record ErrorBody(string Code, string Message, Guid CorrelationId);

public static class ApiErrors
{
    public const string CorrelationKey = "CorrelationId";

    public static Guid GetCorrelationId(HttpContext context)
    {
        if (context.Items.TryGetValue(CorrelationKey, out var value) && value is Guid correlationId)
        {
            return correlationId;
        }

        correlationId = Guid.NewGuid();
        context.Items[CorrelationKey] = correlationId;
        return correlationId;
    }

    public static ErrorEnvelope Create(HttpContext context, string code, string message) =>
        new(new ErrorBody(code, message, GetCorrelationId(context)));
}
