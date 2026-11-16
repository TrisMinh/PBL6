using System.Security.Cryptography;
using System.Net.Mail;
using System.Text.RegularExpressions;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;
using BusTicketPlatform.Identity.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Npgsql;

namespace BusTicketPlatform.Identity.Api;
public sealed record AdminUserProfileInput(string FullName, string Email, string Phone, long ExpectedVersion);
public static class AdminUserEndpoints
{
    public static void MapAdminUserProfiles(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/admin/users").RequireAuthorization();
        group.MapPost("/", (HttpContext context, AdminUserProfileInput body, IIdentityRepository store, IPasswordHasher hasher, AdminIdentityService admin, IIdempotencyStore idempotency) =>
        {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Task.FromResult<IResult>(Results.Forbid());
            return context.WithIdempotency(idempotency, "adminCreateUser", "users", HttpResults.HashPayload(body), async () =>
            {
                if (!Valid(body)) return (400, (object?)new { message = "Thông tin nhân sự chưa hợp lệ." });
                var email = body.Email.Trim(); var phone = NormalizePhone(body.Phone);
                if (await store.FindByNormalizedEmailAsync(email.ToUpperInvariant(), context.RequestAborted) is not null || await store.FindByNormalizedPhoneAsync(phone, context.RequestAborted) is not null) return (409, (object?)new { message = "Email hoặc số điện thoại đã được sử dụng." });
                var user = new UserRecord(Guid.CreateVersion7(), body.FullName.Trim(), email, email.ToUpperInvariant(), phone, phone, hasher.Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))), "ACTIVE", null, 0, null, 0, 0, DateTimeOffset.UtcNow);
                await store.InsertUserAsync(user, context.RequestAborted);
                await store.InsertAuditAsync(context.User.UserId(), user.Id, "ADMIN_CREATE_USER", "SUCCEEDED", "Tạo hồ sơ nhân sự", context.CorrelationId(), context.RequestAborted);
                var profile = await admin.GetUserAsync(user.Id, context.RequestAborted);
                return (201, (object?)profile.Value);
            });
        });
        group.MapPatch("/{id:guid}", async (Guid id, HttpContext context, AdminUserProfileInput body, IdentityDatabaseOptions options, IIdentityRepository store, AdminIdentityService admin) =>
        {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            if (!Valid(body)) return Results.BadRequest();
            var user = await store.FindByIdAsync(id, context.RequestAborted);
            if (user is null) return Results.NotFound();
            if (user.RowVersion != body.ExpectedVersion) return HttpResults.Error(IdentityErrors.VersionConflict(), context.CorrelationId());
            var email = body.Email.Trim(); var phone = NormalizePhone(body.Phone);
            var byEmail = await store.FindByNormalizedEmailAsync(email.ToUpperInvariant(), context.RequestAborted);
            var byPhone = await store.FindByNormalizedPhoneAsync(phone, context.RequestAborted);
            if ((byEmail is not null && byEmail.Id != id) || (byPhone is not null && byPhone.Id != id)) return HttpResults.Error(IdentityErrors.IdentityAlreadyUsed(), context.CorrelationId());
            await using var connection = new NpgsqlConnection(options.ConnectionString); await connection.OpenAsync(context.RequestAborted);
            await using var command = new NpgsqlCommand("UPDATE users SET full_name=@name,email=@email,normalized_email=@normalized,phone=@phone,normalized_phone=@phone,email_verified_at=CASE WHEN email=@email THEN email_verified_at ELSE NULL END,row_version=row_version+1,updated_at=now() WHERE id=@id AND row_version=@version", connection);
            command.Parameters.AddWithValue("id",id); command.Parameters.AddWithValue("version",body.ExpectedVersion); command.Parameters.AddWithValue("name",body.FullName.Trim()); command.Parameters.AddWithValue("email",email); command.Parameters.AddWithValue("normalized",email.ToUpperInvariant()); command.Parameters.AddWithValue("phone",phone);
            if (await command.ExecuteNonQueryAsync(context.RequestAborted) != 1) return HttpResults.Error(IdentityErrors.VersionConflict(), context.CorrelationId());
            await store.InsertAuditAsync(context.User.UserId(), id, "ADMIN_PROFILE_UPDATE", "SUCCEEDED", "Cập nhật hồ sơ nhân sự", context.CorrelationId(), context.RequestAborted);
            return (await admin.GetUserAsync(id, context.RequestAborted)).ToHttp(context.CorrelationId());
        });
    }
    private static bool Valid(AdminUserProfileInput value) =>
        !string.IsNullOrWhiteSpace(value.FullName) && value.FullName.Trim().Length <= 120
        && value.Email is { Length: <= 160 } && MailAddress.TryCreate(value.Email, out _)
        && value.Phone is not null && IdentityNormalizer.IsPhone(NormalizePhone(value.Phone));

    private static string NormalizePhone(string value)
    {
        var phone = value.Trim();
        return Regex.IsMatch(phone, "^0[35789][0-9]{8}$") ? "+84" + phone[1..] : phone;
    }
}
