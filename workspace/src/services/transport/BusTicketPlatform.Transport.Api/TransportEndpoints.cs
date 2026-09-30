using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.Transport.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace BusTicketPlatform.Transport.Api;

public static class TransportEndpoints
{
    public static IEndpointRouteBuilder MapTransportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/trips", SearchAsync);
        endpoints.MapGet("/api/v1/trips/{tripId:guid}", GetTripAsync);
        endpoints.MapGet("/api/v1/trips/{tripId:guid}/stops", GetStopsAsync);

        var admin = endpoints.MapGroup("/api/v1/admin").RequireAuthorization();
        admin.MapPost("/organizations", CreateOrgAsync);
        admin.MapGet("/organizations/{organizationId:guid}", GetOrgAdminAsync);

        var op = endpoints.MapGroup("/api/v1/operator").RequireAuthorization();
        op.MapGet("/organization", GetMyOrgAsync);
        op.MapPatch("/organization", UpdateOrgAsync);
        op.MapGet("/buses", ListBusesAsync);
        op.MapPost("/buses", CreateBusAsync);
        op.MapPatch("/buses/{busId:guid}", UpdateBusAsync);
        op.MapPost("/buses/{busId:guid}/deactivate", DeactivateBusAsync);
        op.MapPut("/buses/{busId:guid}/seats", ReplaceSeatsAsync);
        op.MapGet("/drivers", ListDriversAsync);
        op.MapPost("/drivers", CreateDriverAsync);
        op.MapPatch("/drivers/{driverId:guid}", UpdateDriverAsync);
        op.MapPost("/drivers/{driverId:guid}/deactivate", DeactivateDriverAsync);
        op.MapGet("/routes", ListRoutesAsync);
        op.MapPost("/routes", CreateRouteAsync);
        op.MapPatch("/routes/{routeId:guid}", UpdateRouteAsync);
        op.MapPut("/routes/{routeId:guid}/stops", ReplaceStopsAsync);
        op.MapPost("/routes/{routeId:guid}/deactivate", DeactivateRouteAsync);
        op.MapGet("/trips", ListTripsAsync);
        op.MapPost("/trips", CreateTripAsync);
        op.MapPatch("/trips/{tripId:guid}", UpdateTripAsync);
        op.MapPost("/trips/{tripId:guid}/publish", PublishTripAsync);
        op.MapPost("/trips/{tripId:guid}/cancel", CancelTripAsync);
        op.MapPost("/trips/{tripId:guid}/status-transitions", TransitionTripAsync);

        endpoints.MapGet("/api/v1/driver/assignments", GetAssignmentsAsync).RequireAuthorization();
        endpoints.MapPost("/internal/trips/{tripId:guid}/inventory-ready", InventoryReadyAsync);
        return endpoints;
    }

    private static Actor? ActorOf(HttpContext context)
    {
        var userId = context.User.UserId();
        return userId is null
            ? null
            : new Actor(userId.Value, context.User.OrganizationId(), context.User.Claims.Where(c => c.Type.EndsWith("/role", StringComparison.Ordinal) || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray());
    }

    private static IResult NeedUser(Guid correlationId) => PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), correlationId);

    private static async Task<IResult> SearchAsync(HttpContext context, TransportService service, string origin, string destination, DateOnly departureDate, int passengerCount, long? minPrice, long? maxPrice, TimeOnly? departureTimeFrom, TimeOnly? departureTimeTo, Guid? organizationId, string? busType, Guid? pickupStopId, Guid? dropoffStopId, string? amenities, string? sort, int page = 0, int size = 20)
    {
        var amenityList = string.IsNullOrWhiteSpace(amenities) ? null : amenities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var result = await service.SearchAsync(
            new TripSearchQuery(origin, destination, departureDate, passengerCount, minPrice, maxPrice, departureTimeFrom, departureTimeTo, organizationId, busType, pickupStopId, dropoffStopId, amenityList, sort, page, size),
            context.RequestAborted);
        return result.ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> GetTripAsync(HttpContext context, TransportService service, Guid tripId) =>
        (await service.GetPublicTripAsync(tripId, context.RequestAborted)).ToHttp(context.CorrelationId());

    private static async Task<IResult> GetStopsAsync(HttpContext context, TransportService service, Guid tripId) =>
        (await service.GetTripStopsAsync(tripId, context.RequestAborted)).ToHttp(context.CorrelationId());

    private static async Task<IResult> CreateOrgAsync(HttpContext context, TransportService service, IIdempotencyStore store, OrganizationInput body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await context.WithIdempotency(store, "transport", "create-org", actor.UserId.ToString(), PlatformHttp.HashPayload(body), async () =>
        {
            var result = await service.CreateOrganizationAsync(actor, body, context.RequestAborted);
            return result.IsSuccess ? (201, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, context.CorrelationId()));
        });
    }

    private static object ErrorEnvelopeBody(AppError error, Guid correlationId) =>
        BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(error, correlationId);

    private static async Task<IResult> GetOrgAdminAsync(HttpContext context, TransportService service, Guid organizationId)
    {
        var actor = ActorOf(context);
        return actor is null
            ? NeedUser(context.CorrelationId())
            : (await service.GetOrganizationAsync(actor, organizationId, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> GetMyOrgAsync(HttpContext context, TransportService service)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        if (actor.OrganizationId is null)
        {
            return PlatformHttp.Error(PlatformErrors.AccessDenied(), context.CorrelationId());
        }

        return (await service.GetOrganizationAsync(actor, actor.OrganizationId.Value, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> UpdateOrgAsync(HttpContext context, TransportService service, OrganizationInput body)
    {
        var actor = ActorOf(context);
        return actor is null
            ? NeedUser(context.CorrelationId())
            : (await service.UpdateOrganizationAsync(actor, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ListBusesAsync(HttpContext context, TransportService service)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.ListBusesAsync(actor, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CreateBusAsync(HttpContext context, TransportService service, IIdempotencyStore store, BusInput body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "create-bus", body, () => service.CreateBusAsync(actor, body, context.RequestAborted), 201);
    }

    private static async Task<IResult> UpdateBusAsync(HttpContext context, TransportService service, Guid busId, BusInput body)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.UpdateBusAsync(actor, busId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> DeactivateBusAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid busId)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "deactivate-bus", busId, () => service.DeactivateBusAsync(actor, busId, context.RequestAborted), 200);
    }

    private static async Task<IResult> ReplaceSeatsAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid busId, List<SeatInput> body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "replace-seats", body, () => service.ReplaceSeatsAsync(actor, busId, body, context.RequestAborted), 200);
    }

    private static async Task<IResult> ListDriversAsync(HttpContext context, TransportService service)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.ListDriversAsync(actor, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CreateDriverAsync(HttpContext context, TransportService service, IIdempotencyStore store, DriverInput body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "create-driver", body, () => service.CreateDriverAsync(actor, body, context.RequestAborted), 201);
    }

    private static async Task<IResult> UpdateDriverAsync(HttpContext context, TransportService service, Guid driverId, DriverInput body)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.UpdateDriverAsync(actor, driverId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> DeactivateDriverAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid driverId)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "deactivate-driver", driverId, () => service.DeactivateDriverAsync(actor, driverId, context.RequestAborted), 200);
    }

    private static async Task<IResult> ListRoutesAsync(HttpContext context, TransportService service)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.ListRoutesAsync(actor, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CreateRouteAsync(HttpContext context, TransportService service, IIdempotencyStore store, RouteInput body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "create-route", body, () => service.CreateRouteAsync(actor, body, context.RequestAborted), 201);
    }

    private static async Task<IResult> UpdateRouteAsync(HttpContext context, TransportService service, Guid routeId, RouteInput body)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.UpdateRouteAsync(actor, routeId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> ReplaceStopsAsync(HttpContext context, TransportService service, Guid routeId, List<RouteStopInput> body)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.ReplaceRouteStopsAsync(actor, routeId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> DeactivateRouteAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid routeId)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "deactivate-route", routeId, () => service.DeactivateRouteAsync(actor, routeId, context.RequestAborted), 200);
    }

    private static async Task<IResult> ListTripsAsync(HttpContext context, TransportService service, int page = 0, int size = 20)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.ListOperatorTripsAsync(actor, page, size, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> CreateTripAsync(HttpContext context, TransportService service, IIdempotencyStore store, TripInput body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "create-trip", body, () => service.CreateTripDraftAsync(actor, body, context.RequestAborted), 201);
    }

    private static async Task<IResult> UpdateTripAsync(HttpContext context, TransportService service, Guid tripId, TripInput body)
    {
        var actor = ActorOf(context);
        return actor is null ? NeedUser(context.CorrelationId()) : (await service.UpdateTripDraftAsync(actor, tripId, body, context.RequestAborted)).ToHttp(context.CorrelationId());
    }

    private static async Task<IResult> PublishTripAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid tripId, ExpectedVersionRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "publish-trip", body, () => service.PublishTripAsync(actor, tripId, body.ExpectedVersion, context.CorrelationId(), context.RequestAborted), 202);
    }

    private static async Task<IResult> CancelTripAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid tripId, VersionedReasonRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "cancel-trip", body, () => service.CancelTripAsync(actor, tripId, body, context.CorrelationId(), context.RequestAborted), 202);
    }

    private static async Task<IResult> TransitionTripAsync(HttpContext context, TransportService service, IIdempotencyStore store, Guid tripId, TripTransitionRequest body)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        return await Mutate(context, store, "transition-trip", body, () => service.TransitionTripAsync(actor, tripId, body, context.CorrelationId(), context.RequestAborted), 200);
    }

    private static async Task<IResult> GetAssignmentsAsync(HttpContext context, TransportService service)
    {
        var actor = ActorOf(context);
        if (actor is null)
        {
            return NeedUser(context.CorrelationId());
        }

        var items = await service.GetMyAssignmentsAsync(actor, context.RequestAborted);
        return Results.Json(items, PlatformHttp.Json);
    }

    private static async Task<IResult> InventoryReadyAsync(HttpContext context, TransportService service, Guid tripId)
    {
        await service.MarkInventoryReadyAsync(tripId, context.RequestAborted);
        return Results.Json(new OperationAccepted(tripId, "ACCEPTED"), PlatformHttp.Json, statusCode: 202);
    }

    private static Task<IResult> Mutate<TBody, TResult>(
        HttpContext context,
        IIdempotencyStore store,
        string operation,
        TBody body,
        Func<Task<BusTicketPlatform.BuildingBlocks.Results.Result<TResult>>> execute,
        int successStatus) =>
        context.WithIdempotency(store, "transport", operation, context.User.UserId()?.ToString() ?? "anon", PlatformHttp.HashPayload(body), async () =>
        {
            var result = await execute();
            return result.IsSuccess
                ? (successStatus, (object?)result.Value)
                : (result.Error!.StatusCode, (object?)BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(result.Error, context.CorrelationId()));
        });
}
