using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Correlation;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Http;
using BusTicketPlatform.BuildingBlocks.Idempotency;
using BusTicketPlatform.BuildingBlocks.Results;
using Microsoft.AspNetCore.Http;
using HttpResults = Microsoft.AspNetCore.Http.Results;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore.Http;

public static class PlatformHttp
{
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static IResult ToHttp(this Result result, Guid correlationId, int successStatus = 204)
    {
        if (result.IsSuccess)
        {
            return successStatus == 204 ? HttpResults.NoContent() : HttpResults.StatusCode(successStatus);
        }

        return Error(result.Error!, correlationId);
    }

    public static IResult ToHttp<T>(this Result<T> result, Guid correlationId, int successStatus = 200)
    {
        if (!result.IsSuccess)
        {
            return Error(result.Error!, correlationId);
        }

        return HttpResults.Json(result.Value, Json, statusCode: successStatus);
    }

    public static IResult Error(AppError error, Guid correlationId) =>
        HttpResults.Json(ErrorEnvelope.From(error, correlationId), Json, statusCode: error.StatusCode);

    public static Guid CorrelationId(this HttpContext context) => context.GetCorrelationId();

    public static Guid? UserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var id) ? id : null;
    }

    public static Guid? OrganizationId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("org"), out var id) ? id : null;

    public static bool HasRole(this ClaimsPrincipal user, params string[] roles) =>
        roles.Any(user.IsInRole);

    public static string? IdempotencyKey(this HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Idempotency-Key", out var values))
        {
            return null;
        }

        var key = values.ToString();
        return key.Length is >= 16 and <= 200 ? key : "";
    }

    public static string HashPayload<T>(T payload) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(payload, Json)));

    public static async Task<IResult> WithIdempotency(
        this HttpContext context,
        IIdempotencyStore store,
        string actorScope,
        string operation,
        string target,
        string requestHash,
        Func<Task<(int Status, object? Body)>> execute)
    {
        var correlationId = context.CorrelationId();
        var key = context.Request.IdempotencyKey();
        if (key is null)
        {
            return Error(PlatformErrors.IdempotencyKeyRequired(), correlationId);
        }

        if (key.Length == 0)
        {
            return Error(PlatformErrors.Validation("Idempotency-Key is invalid.", "Idempotency-Key"), correlationId);
        }

        var outcome = await store.BeginAsync(actorScope, operation, target, key, requestHash, context.RequestAborted);
        return outcome switch
        {
            IdempotencyOutcome.Conflict => Error(PlatformErrors.IdempotencyConflict(), correlationId),
            IdempotencyOutcome.InProgress => Error(PlatformErrors.IdempotencyInProgress(), correlationId),
            IdempotencyOutcome.Completed completed => completed.Status == 204
                ? HttpResults.StatusCode(204)
                : HttpResults.Json(JsonSerializer.Deserialize<object>(completed.Snapshot, Json), Json, statusCode: completed.Status),
            _ => await FinishAsync()
        };

        async Task<IResult> FinishAsync()
        {
            var (status, body) = await execute();
            var snapshot = body is null ? "{}" : JsonSerializer.Serialize(body, Json);
            await store.CompleteAsync(actorScope, operation, target, key, status, snapshot, context.RequestAborted);
            return body is null ? HttpResults.StatusCode(status) : HttpResults.Json(body, Json, statusCode: status);
        }
    }
}
