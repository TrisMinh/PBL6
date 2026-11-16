using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.RegularExpressions;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Notification.Infrastructure;
using Npgsql;

public static partial class CustomerRequests
{
    public sealed record SupportInput(string? Email, string? Message);
    public sealed record PartnerInput(string? Operator, string? Contact, string? Phone, string? Email, string? Route);

    public static Task<IResult> SupportAsync(HttpContext context, NotificationDatabaseOptions database, SupportInput input)
    {
        var email = input.Email?.Trim() ?? "";
        var message = input.Message?.Trim() ?? "";
        if (!ValidEmail(email) || message.Length is < 10 or > 2000)
            return Task.FromResult(Invalid(context));
        return SaveAsync(context, database, "support", "BLUE-SUP-", new { email, message });
    }

    public static Task<IResult> PartnerAsync(HttpContext context, NotificationDatabaseOptions database, PartnerInput input)
    {
        var name = input.Operator?.Trim() ?? "";
        var contact = input.Contact?.Trim() ?? "";
        var phone = input.Phone?.Trim() ?? "";
        var email = input.Email?.Trim() ?? "";
        var route = input.Route?.Trim() ?? "";
        if (name.Length is < 1 or > 160 || contact.Length is < 1 or > 100
            || !PhonePattern().IsMatch(phone) || (email.Length > 0 && !ValidEmail(email)) || route.Length > 300)
            return Task.FromResult(Invalid(context));
        return SaveAsync(context, database, "partner", "BLUE-NX-", new { @operator = name, contact, phone, email, route });
    }

    private static bool ValidEmail(string value) => value.Length is > 0 and <= 254 && new EmailAddressAttribute().IsValid(value);

    [GeneratedRegex(@"^(?:\+84|0)[0-9]{9}$")]
    private static partial Regex PhonePattern();

    private static IResult Invalid(HttpContext context) =>
        PlatformHttp.Error(PlatformErrors.Validation("Thông tin yêu cầu không hợp lệ."), context.CorrelationId());

    private static async Task<IResult> SaveAsync(HttpContext context, NotificationDatabaseOptions database, string kind, string prefix, object payload)
    {
        var id = Guid.NewGuid();
        var reference = prefix + id.ToString("N")[..12].ToUpperInvariant();
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(context.RequestAborted);
        await using var command = new NpgsqlCommand("""
            INSERT INTO customer_requests(id, kind, reference, payload, customer_id)
            VALUES (@id, @kind, @reference, CAST(@payload AS jsonb), @customer);
            """, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("kind", kind);
        command.Parameters.AddWithValue("reference", reference);
        command.Parameters.AddWithValue("payload", JsonSerializer.Serialize(payload));
        command.Parameters.AddWithValue("customer", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)context.User.UserId() ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(context.RequestAborted);
        return Results.Json(new { reference }, PlatformHttp.Json, statusCode: 201);
    }
}
