using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Correlation;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Http;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Identity.Application;

namespace BusTicketPlatform.Identity.Api;

public static class HttpResults
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static IResult ToHttp(this Result result, Guid correlationId, int successStatus = 204)
    {
        if (result.IsSuccess)
        {
            return successStatus == 204 ? Results.NoContent() : Results.StatusCode(successStatus);
        }

        return Error(result.Error!, correlationId);
    }

    public static IResult ToHttp<T>(this Result<T> result, Guid correlationId, int successStatus = 200)
    {
        if (!result.IsSuccess)
        {
            return Error(result.Error!, correlationId);
        }

        return Results.Json(result.Value, Json, statusCode: successStatus);
    }

    public static IResult Error(AppError error, Guid correlationId) =>
        Results.Json(ErrorEnvelope.From(error, correlationId), Json, statusCode: error.StatusCode);

    public static Guid CorrelationId(this HttpContext context) => context.GetCorrelationId();

    public static Guid? UserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var id) ? id : null;
    }

    public static Guid? SessionId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("sid"), out var id) ? id : null;

    public static bool IsPlatformAdmin(this ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN");

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
        string operation,
        string target,
        string requestHash,
        Func<Task<(int Status, object? Body)>> execute)
    {
        var correlationId = context.CorrelationId();
        var key = context.Request.IdempotencyKey();
        if (key is null)
        {
            return Error(IdentityErrors.IdempotencyKeyRequired(), correlationId);
        }

        if (key.Length == 0)
        {
            return Error(IdentityErrors.Validation("Idempotency-Key is invalid.", "Idempotency-Key"), correlationId);
        }

        var outcome = await store.BeginAsync("identity", operation, target, key, requestHash, context.RequestAborted);
        return outcome switch
        {
            IdempotencyOutcome.Conflict => Error(IdentityErrors.IdempotencyConflict(), correlationId),
            IdempotencyOutcome.InProgress => Error(IdentityErrors.IdempotencyInProgress(), correlationId),
            IdempotencyOutcome.Completed completed => completed.Status == 204
                ? Results.StatusCode(204)
                : Results.Json(JsonSerializer.Deserialize<object>(completed.Snapshot, Json), Json, statusCode: completed.Status),
            _ => await FinishAsync()
        };

        async Task<IResult> FinishAsync()
        {
            var (status, body) = await execute();
            var snapshot = body is null ? "{}" : JsonSerializer.Serialize(body, Json);
            await store.CompleteAsync("identity", operation, target, key, status, snapshot, context.RequestAborted);
            return body is null ? Results.StatusCode(status) : Results.Json(body, Json, statusCode: status);
        }
    }
}

public sealed record RegisterRequest(string FullName, string Email, string Phone, string Password);
public sealed record VerificationRequest(Guid ChallengeId, string Code);
public sealed record EmailRequest(string Email);
public sealed record LoginRequest(string Identifier, string Password);
public sealed record RefreshRequest(string? RefreshToken);
public sealed record ResetPasswordRequest(Guid ChallengeId, string Code, string NewPassword);
public sealed record UpdateProfileRequest(string? FullName, string? Email, string? Phone, long ExpectedVersion);
public sealed record VersionedStatusRequest(string Status, string Reason, long ExpectedVersion);
public sealed record ReplaceRolesRequest(IReadOnlyList<string> RoleCodes, string Reason, long ExpectedVersion);
public sealed record MembershipInput(Guid UserId, IReadOnlyList<string> RoleCodes, string Status, string Reason, long ExpectedVersion);
