using System.Text.Json;
using System.Text.RegularExpressions;
using BusTicketPlatform.Identity.Infrastructure;
using Npgsql;

namespace BusTicketPlatform.Identity.Api;

public static class CustomerPreferencesEndpoints
{
    public sealed record Preferences(string Province = "", string Avatar = "", bool Journey = true, bool Reminder = true, bool Offers = false);

    public static IEndpointRouteBuilder MapCustomerPreferencesEndpoints(this IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/api/v1/users/me/preferences").RequireAuthorization();
        me.MapGet("/", async (HttpContext http, IdentityDatabaseOptions options) =>
        {
            var id = http.User.UserId();
            if (id is null) return Results.Unauthorized();
            await using var connection = new NpgsqlConnection(options.ConnectionString);
            await connection.OpenAsync(http.RequestAborted);
            await using var command = new NpgsqlCommand("SELECT preferences::text FROM customer_preferences WHERE user_id = @id", connection);
            command.Parameters.AddWithValue("id", id.Value);
            var value = await command.ExecuteScalarAsync(http.RequestAborted) as string;
            return Results.Ok(value is null ? new Preferences() : JsonSerializer.Deserialize<Preferences>(value));
        });
        me.MapPut("/", async (Preferences body, HttpContext http, IdentityDatabaseOptions options) =>
        {
            var id = http.User.UserId();
            if (id is null) return Results.Unauthorized();
            if (body.Province is null || body.Province.Length > 100 || body.Avatar is null || body.Avatar.Length > 200000 ||
                (body.Avatar.Length > 0 && !Regex.IsMatch(body.Avatar, "^data:image/webp;base64,[A-Za-z0-9+/=]+$")))
                return Results.BadRequest(new { code = "VALIDATION_ERROR", message = "Invalid profile preferences." });
            await using var connection = new NpgsqlConnection(options.ConnectionString);
            await connection.OpenAsync(http.RequestAborted);
            await using var command = new NpgsqlCommand("""
                INSERT INTO customer_preferences (user_id, preferences, updated_at) VALUES (@id, @data::jsonb, NOW())
                ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()
                """, connection);
            command.Parameters.AddWithValue("id", id.Value);
            command.Parameters.AddWithValue("data", JsonSerializer.Serialize(body));
            await command.ExecuteNonQueryAsync(http.RequestAborted);
            return Results.Ok(body);
        });
        return app;
    }
}
