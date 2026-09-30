using BusTicketPlatform.BuildingBlocks.Correlation;
using BusTicketPlatform.BuildingBlocks.Ids;
using Microsoft.AspNetCore.Http;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore.Correlation;

public sealed class CorrelationMiddleware(RequestDelegate next, IIdGenerator idGenerator)
{
    public const string HttpContextItemKey = "CorrelationId";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = Resolve(context.Request.Headers[CorrelationDefaults.HeaderName], idGenerator);
        context.Items[HttpContextItemKey] = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationDefaults.HeaderName] = correlationId.ToString();
            return Task.CompletedTask;
        });

        await next(context);
    }

    public static Guid Resolve(string? rawHeader, IIdGenerator idGenerator)
    {
        if (Guid.TryParse(rawHeader, out var parsed) && parsed != Guid.Empty)
        {
            return parsed;
        }

        return idGenerator.NewUuidV7();
    }
}

public static class HttpContextCorrelationExtensions
{
    public static Guid GetCorrelationId(this HttpContext context)
    {
        if (context.Items.TryGetValue(CorrelationMiddleware.HttpContextItemKey, out var value) && value is Guid id)
        {
            return id;
        }

        return Guid.Empty;
    }
}
