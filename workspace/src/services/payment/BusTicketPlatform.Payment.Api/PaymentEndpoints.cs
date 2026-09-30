using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.Payment.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace BusTicketPlatform.Payment.Api;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1").RequireAuthorization();
        api.MapPost("/bookings/{bookingId:guid}/payments", CreateAsync);
        api.MapGet("/bookings/{bookingId:guid}/payments", ListAsync);
        api.MapGet("/payments/{paymentId:guid}", GetAsync);
        api.MapPost("/payments/{paymentId:guid}/cancel", CancelAsync);
        api.MapPost("/refunds", RefundAsync);
        api.MapGet("/refunds/{refundId:guid}", GetRefundAsync);
        api.MapGet("/admin/payments", SearchPaymentsAsync);
        api.MapGet("/admin/refunds", SearchRefundsAsync);
        api.MapGet("/operator/settlements", OperatorSettlementsAsync);
        api.MapGet("/admin/settlements", AdminSettlementsAsync);
        api.MapPost("/admin/payouts", PayoutAsync);
        endpoints.MapPost("/integrations/payments/{provider}/webhooks", WebhookAsync);
        endpoints.MapGet("/integrations/payments/{provider}/return", ReturnAsync);
        endpoints.MapPost("/internal/quotes", QuoteAsync);
        return endpoints;
    }

    private static Actor? ActorOf(HttpContext context)
    {
        var userId = context.User.UserId();
        return userId is null
            ? null
            : new Actor(userId.Value, context.User.OrganizationId(), context.User.Claims.Where(c => c.Type.EndsWith("/role", StringComparison.Ordinal) || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray());
    }

    private static async Task<IResult> CreateAsync(HttpContext context, PaymentService service, IIdempotencyStore store, Guid bookingId, CreatePaymentRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "payment", "create", bookingId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CreateAsync(actor, bookingId, body, context.CorrelationId(), context.RequestAborted);
            return result.IsSuccess ? (201, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> ListAsync(HttpContext context, PaymentService service, Guid bookingId)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.ListBookingAsync(actor, bookingId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> GetAsync(HttpContext context, PaymentService service, Guid paymentId)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.GetAsync(actor, paymentId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CancelAsync(HttpContext context, PaymentService service, IIdempotencyStore store, Guid paymentId)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "payment", "cancel", paymentId.ToString(), paymentId.ToString("N"), async () =>
        {
            var result = await service.CancelAsync(actor, paymentId, context.RequestAborted);
            return result.IsSuccess ? (202, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> RefundAsync(HttpContext context, PaymentService service, IIdempotencyStore store, CreateRefundRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "payment", "refund", body.RefundReference, PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CreateRefundAsync(actor, body, context.RequestAborted);
            return result.IsSuccess ? (202, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> GetRefundAsync(HttpContext context, PaymentService service, Guid refundId)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.GetRefundAsync(actor, refundId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> SearchPaymentsAsync(HttpContext context, PaymentService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.SearchPaymentsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> SearchRefundsAsync(HttpContext context, PaymentService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.SearchRefundsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> OperatorSettlementsAsync(HttpContext context, PaymentService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.ListSettlementsAsync(actor, false, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> AdminSettlementsAsync(HttpContext context, PaymentService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.ListSettlementsAsync(actor, true, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> PayoutAsync(HttpContext context, PaymentService service, CreatePayoutRequest body)
    {
        var actor = ActorOf(context);
        return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.CreatePayoutAsync(actor, body, context.RequestAborted)).ToHttp(context.CorrelationId(), 201);
    }

    private static async Task<IResult> WebhookAsync(HttpContext context, PaymentService service, string provider)
    {
        var map = await ReadProviderPayloadAsync(context);
        return (await service.HandleWebhookAsync(provider, map, context.CorrelationId(), context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ReturnAsync(HttpContext context, PaymentService service, string provider)
    {
        var map = context.Request.Query.ToDictionary(pair => pair.Key, pair => (object)pair.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        var result = await service.HandleWebhookAsync(provider, map, context.CorrelationId(), context.RequestAborted);
        var returnUri = map.TryGetValue("vnp_ReturnUrl", out var raw) ? raw?.ToString() : null;
        if (!string.IsNullOrWhiteSpace(returnUri) && Uri.TryCreate(returnUri, UriKind.Absolute, out var uri))
        {
            return Results.Redirect(uri.ToString());
        }

        return result.ToHttp(context.CorrelationId());
    }

    private static async Task<Dictionary<string, object>> ReadProviderPayloadAsync(HttpContext context)
    {
        if (context.Request.HasFormContentType)
        {
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            return form.ToDictionary(pair => pair.Key, pair => (object)pair.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        }

        if (context.Request.Query.Count > 0 && context.Request.Query.Keys.Any(key => key.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase)))
        {
            return context.Request.Query.ToDictionary(pair => pair.Key, pair => (object)pair.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        }

        var body = await context.Request.ReadFromJsonAsync<Dictionary<string, JsonElement>>(context.RequestAborted) ?? [];
        return body
            .Where(pair => pair.Value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined)
            .ToDictionary(pair => pair.Key, pair => (object)pair.Value.ToString(), StringComparer.OrdinalIgnoreCase);
    }

    private static async Task<IResult> QuoteAsync(HttpContext context, PaymentService service, BookingQuote body)
    {
        await service.RegisterQuoteAsync(body, context.RequestAborted);
        return Results.StatusCode(204);
    }
}
