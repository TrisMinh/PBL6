using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Idempotency;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace BusTicketPlatform.Booking.Api;

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");
        api.MapGet("/trips/{tripId:guid}/seats", GetSeatsAsync).RequireAuthorization();
        api.MapPost("/trips/{tripId:guid}/seat-holds", CreateHoldAsync).RequireAuthorization();
        api.MapGet("/seat-holds/{**holdToken}", GetHoldAsync).RequireAuthorization();
        api.MapDelete("/seat-holds/{**holdToken}", ReleaseHoldAsync).RequireAuthorization();
        api.MapPost("/bookings", CreateBookingAsync).RequireAuthorization();
        api.MapGet("/bookings", ListBookingsAsync).RequireAuthorization();
        api.MapGet("/bookings/{bookingId:guid}", GetBookingAsync).RequireAuthorization();
        api.MapPost("/bookings/{bookingId:guid}/cancellation-preview", PreviewAsync).RequireAuthorization();
        api.MapPost("/bookings/{bookingId:guid}/cancel", CancelAsync).RequireAuthorization();
        api.MapGet("/tickets", ListTicketsAsync).RequireAuthorization();
        api.MapGet("/tickets/{ticketId:guid}", GetTicketAsync).RequireAuthorization();
        api.MapPost("/tickets/validate", ValidateAsync).RequireAuthorization();
        api.MapPost("/tickets/{ticketId:guid}/check-in", CheckInAsync).RequireAuthorization();
        api.MapGet("/operator/trips/{tripId:guid}/manifest", ManifestAsync).RequireAuthorization();
        api.MapGet("/admin/bookings", SearchAsync).RequireAuthorization();
        api.MapPost("/internal/trips/published", ImportAsync);
        api.MapPost("/internal/payments/succeeded", PaymentSucceededAsync);
        return endpoints;
    }

    private static Actor? ActorOf(HttpContext context)
    {
        var userId = context.User.UserId();
        return userId is null
            ? null
            : new Actor(
                userId.Value,
                context.User.OrganizationId(),
                context.User.Claims.Where(c => c.Type.EndsWith("/role", StringComparison.Ordinal) || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray());
    }

    private static async Task<IResult> GetSeatsAsync(HttpContext context, BookingService service, Guid tripId) =>
        (await service.GetSeatsAsync(tripId, context.RequestAborted)).ToHttp(context.CorrelationId());

    private static async Task<IResult> CreateHoldAsync(HttpContext context, BookingService service, IIdempotencyStore store, Guid tripId, CreateSeatHoldRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        var key = context.Request.IdempotencyKey() ?? "";
        return await context.WithIdempotency(store, "booking", "create-hold", actor.UserId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CreateHoldAsync(actor, tripId, body, key, context.RequestAborted);
            return result.IsSuccess ? (201, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> GetHoldAsync(HttpContext context, BookingService service, string holdToken)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.GetHoldAsync(actor, holdToken, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ReleaseHoldAsync(HttpContext context, BookingService service, IIdempotencyStore store, string holdToken)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "booking", "release-hold", holdToken, PlatformHttp.HashPayload(holdToken), async () =>
        {
            var result = await service.ReleaseHoldAsync(actor, holdToken, context.RequestAborted);
            return result.IsSuccess ? (204, (object?)null) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> CreateBookingAsync(HttpContext context, BookingService service, IIdempotencyStore store, CreateBookingRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "booking", "create-booking", actor.UserId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CreateBookingAsync(actor, body, context.CorrelationId(), context.RequestAborted);
            return result.IsSuccess ? (201, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> ListBookingsAsync(HttpContext context, BookingService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.ListMyBookingsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> GetBookingAsync(HttpContext context, BookingService service, Guid bookingId)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.GetBookingAsync(actor, bookingId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> PreviewAsync(HttpContext context, BookingService service, Guid bookingId, CancellationPreviewRequest body)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.PreviewAsync(actor, bookingId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CancelAsync(HttpContext context, BookingService service, IIdempotencyStore store, Guid bookingId, CancelBookingRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "booking", "cancel", bookingId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CancelAsync(actor, bookingId, body, context.CorrelationId(), context.RequestAborted);
            return result.IsSuccess ? (202, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> ListTicketsAsync(HttpContext context, BookingService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.ListTicketsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> GetTicketAsync(HttpContext context, BookingService service, Guid ticketId)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.GetTicketAsync(actor, ticketId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ValidateAsync(HttpContext context, BookingService service, TicketScanRequest body)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.ValidateAsync(actor, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CheckInAsync(HttpContext context, BookingService service, IIdempotencyStore store, Guid ticketId, TicketScanRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
        }

        return await context.WithIdempotency(store, "booking", "check-in", ticketId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CheckInAsync(actor, ticketId, body, context.RequestAborted);
            return result.IsSuccess ? (200, (object?)result.Value) : (result.Error!.StatusCode, BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
    }

    private static async Task<IResult> ManifestAsync(HttpContext context, BookingService service, Guid tripId)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.ManifestAsync(actor, tripId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> SearchAsync(HttpContext context, BookingService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null
            ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
            : (await service.SearchBookingsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ImportAsync(HttpContext context, BookingService service, TripPublishedMessage body) =>
        (await service.ImportPublishedTripAsync(body, context.CorrelationId(), context.RequestAborted)).ToHttp(context.CorrelationId(), 202);

    private static async Task<IResult> PaymentSucceededAsync(HttpContext context, BookingService service, PaymentSucceededMessage body) =>
        (await service.ApplyPaymentSucceededAsync(body, context.CorrelationId(), context.RequestAborted)).ToHttp(context.CorrelationId());
}
