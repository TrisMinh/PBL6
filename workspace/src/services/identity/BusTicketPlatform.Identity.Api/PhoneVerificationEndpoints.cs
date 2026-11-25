using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Infrastructure;
using Npgsql;

namespace BusTicketPlatform.Identity.Api;

public static class PhoneVerificationEndpoints
{
    public sealed record VerifyPhoneRequest(Guid ChallengeId, string Code);

    public static void MapPhoneVerification(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users/me/phone-verification").RequireAuthorization();
        group.MapPost("/", StartAsync);
        group.MapPost("/verify", VerifyAsync);
    }

    private static async Task<IResult> StartAsync(HttpContext context, IIdentityRepository users,
        IdentityDatabaseOptions database, IConfiguration config, IHttpClientFactory clients)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!context.User.IsInRole("CUSTOMER") || context.User.UserId() is not Guid userId) return Results.Forbid();
        var ct = context.RequestAborted;
        var user = await users.FindByIdAsync(userId, ct);
        if (user is null) return Results.NotFound();
        if (user.VerifiedPhone is not null) return Results.NoContent();
        var phone = user.NormalizedPhone;
        if (Regex.IsMatch(phone, "^0[0-9]{9}$", RegexOptions.CultureInvariant)) phone = "+84" + phone[1..];
        if (!Regex.IsMatch(phone, @"^\+[1-9][0-9]{8,14}$", RegexOptions.CultureInvariant))
            return HttpResults.Error(IdentityErrors.Validation("Cập nhật số điện thoại hợp lệ trong hồ sơ trước khi xác minh."), context.CorrelationId());
        if (!Uri.TryCreate(config["Sms:Endpoint"], UriKind.Absolute, out var endpoint) || endpoint.Scheme != Uri.UriSchemeHttps ||
            string.IsNullOrWhiteSpace(config["Sms:Token"]))
            return Results.Json(new { code = "SMS_UNAVAILABLE", message = "Tạm thời chưa gửi được mã SMS." }, statusCode: 503);

        var challenge = Guid.NewGuid();
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using (var locks = new NpgsqlCommand("""
            SELECT pg_advisory_xact_lock(hashtextextended('phone-user:' || CAST(@user AS text),0));
            SELECT pg_advisory_xact_lock(hashtextextended('phone-number:' || @phone,0));
            """, connection, tx))
        {
            locks.Parameters.AddWithValue("user", userId);
            locks.Parameters.AddWithValue("phone", phone);
            await locks.ExecuteNonQueryAsync(ct);
        }
        await using (var reserve = new NpgsqlCommand("""
            INSERT INTO phone_verification_requests(id, user_id, phone, profile_phone, code_hash)
            SELECT @id, @user, @phone, @profilePhone, @hash
            WHERE NOT EXISTS (SELECT 1 FROM phone_verification_requests
                WHERE (user_id=@user OR phone=@phone) AND created_at>NOW()-INTERVAL '1 minute')
              AND (SELECT COUNT(*) FROM phone_verification_requests
                WHERE (user_id=@user OR phone=@phone) AND created_at>NOW()-INTERVAL '30 minutes') < 3;
            """, connection, tx))
        {
            reserve.Parameters.AddWithValue("id", challenge);
            reserve.Parameters.AddWithValue("user", userId);
            reserve.Parameters.AddWithValue("phone", phone);
            reserve.Parameters.AddWithValue("profilePhone", user.NormalizedPhone);
            reserve.Parameters.AddWithValue("hash", HashCode(config, challenge, code));
            if (await reserve.ExecuteNonQueryAsync(ct) == 0)
                return HttpResults.Error(IdentityErrors.RateLimited(), context.CorrelationId());
        }
        await tx.CommitAsync(ct);

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config["Sms:Token"]);
        request.Content = JsonContent.Create(new { to = phone, message = $"BLUE: Ma xac minh {code}. Co hieu luc 5 phut." });
        try
        {
            using var response = await clients.CreateClient("phone-verification").SendAsync(request, ct);
            if (response.IsSuccessStatusCode) return Results.Accepted(value: new { challengeId = challenge });
        }
        catch (HttpRequestException) { }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { }
        return Results.Json(new { code = "SMS_UNAVAILABLE", message = "Tạm thời chưa gửi được mã SMS." }, statusCode: 503);
    }

    private static async Task<IResult> VerifyAsync(HttpContext context, VerifyPhoneRequest body, IdentityDatabaseOptions database, IConfiguration config)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!context.User.IsInRole("CUSTOMER") || context.User.UserId() is not Guid userId) return Results.Forbid();
        if (body.Code is null || !Regex.IsMatch(body.Code, "^[0-9]{6}$", RegexOptions.CultureInvariant))
            return HttpResults.Error(IdentityErrors.VerificationInvalid(), context.CorrelationId());
        var ct = context.RequestAborted;
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand("""
            WITH attempt AS (
                UPDATE phone_verification_requests r SET attempts = attempts + 1,
                    used_at = CASE WHEN code_hash = @hash THEN NOW() ELSE used_at END
                WHERE id=@id AND user_id=@user AND used_at IS NULL AND attempts<5 AND expires_at>NOW()
                  AND NOT EXISTS (SELECT 1 FROM phone_verification_requests newer
                    WHERE newer.user_id=r.user_id AND newer.created_at>r.created_at)
                RETURNING phone, profile_phone, code_hash, user_id
            )
            UPDATE users u SET verified_phone=a.phone, updated_at=NOW(), row_version=row_version+1
            FROM attempt a WHERE u.id=a.user_id AND u.normalized_phone=a.profile_phone
                AND u.status='ACTIVE' AND a.code_hash=@hash AND u.deleted_at IS NULL;
            """, connection);
        command.Parameters.AddWithValue("id", body.ChallengeId);
        command.Parameters.AddWithValue("user", userId);
        command.Parameters.AddWithValue("hash", HashCode(config, body.ChallengeId, body.Code));
        try
        {
            if (await command.ExecuteNonQueryAsync(ct) == 1) return Results.NoContent();
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return HttpResults.Error(IdentityErrors.IdentityAlreadyUsed(), context.CorrelationId());
        }
        return HttpResults.Error(IdentityErrors.VerificationInvalid(), context.CorrelationId());
    }

    private static string HashCode(IConfiguration config, Guid id, string code) =>
        Convert.ToHexString(HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(config["Authentication:SigningKey"] ?? "local-dev-only-change-me-32bytes-min"),
            Encoding.UTF8.GetBytes($"phone-verification:{id:N}:{code}")));
}
