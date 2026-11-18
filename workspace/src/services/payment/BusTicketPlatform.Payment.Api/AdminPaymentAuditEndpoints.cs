using BusTicketPlatform.Payment.Infrastructure;
using Npgsql;

namespace BusTicketPlatform.Payment.Api;

public static class AdminPaymentAuditEndpoints
{
    public static void MapAdminPaymentAudit(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/admin/payments/{id:guid}/audit", async (Guid id, HttpContext context, PaymentDatabaseOptions options) =>
        {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            await using var db = new NpgsqlConnection(options.ConnectionString);
            await db.OpenAsync(context.RequestAborted);
            await using var command = new NpgsqlCommand("SELECT p.created_at,p.updated_at,p.succeeded_at,p.failed_at,p.cancelled_at,p.refunded_at,p.status,(SELECT a.provider_transaction_id FROM payment_attempts a WHERE a.payment_id=p.id AND a.provider_transaction_id IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) FROM payments p WHERE p.id=@id", db);
            command.Parameters.AddWithValue("id", id);
            await using var reader = await command.ExecuteReaderAsync(context.RequestAborted);
            if (!await reader.ReadAsync(context.RequestAborted)) return Results.NotFound();
            var history = new List<object>();
            void Add(int index, string description) { if (!reader.IsDBNull(index)) history.Add(new { occurredAt = reader.GetDateTime(index), description }); }
            Add(0, "Khởi tạo thanh toán"); Add(2, "Thu tiền thành công"); Add(3, "Thanh toán thất bại"); Add(4, "Hủy thanh toán"); Add(5, "Đã hoàn toàn bộ tiền");
            if (reader.GetDateTime(1) != reader.GetDateTime(0)) Add(1, $"Cập nhật thanh toán: {reader.GetString(6)}");
            return Results.Json(new { history, updatedAt = reader.GetDateTime(1), partnerCode = reader.IsDBNull(7) ? null : reader.GetString(7) });
        }).RequireAuthorization();
        endpoints.MapGet("/api/v1/admin/refunds/{id:guid}/audit", async (Guid id, HttpContext context, PaymentDatabaseOptions options) =>
        {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            await using var db = new NpgsqlConnection(options.ConnectionString);
            await db.OpenAsync(context.RequestAborted);
            await using var command = new NpgsqlCommand("SELECT created_at,updated_at,succeeded_at,status,provider_refund_id FROM refunds WHERE id=@id", db);
            command.Parameters.AddWithValue("id", id);
            await using var reader = await command.ExecuteReaderAsync(context.RequestAborted);
            if (!await reader.ReadAsync(context.RequestAborted)) return Results.NotFound();
            var history = new List<object> { new { occurredAt = reader.GetDateTime(0), description = "Yêu cầu hoàn tiền" } };
            if (!reader.IsDBNull(2)) history.Add(new { occurredAt = reader.GetDateTime(2), description = "Hoàn tiền thành công" });
            if (reader.GetDateTime(1) != reader.GetDateTime(0)) history.Add(new { occurredAt = reader.GetDateTime(1), description = $"Cập nhật khoản hoàn: {reader.GetString(3)}" });
            return Results.Json(new { history, updatedAt = reader.GetDateTime(1), partnerCode = reader.IsDBNull(4) ? null : reader.GetString(4) });
        }).RequireAuthorization();
    }
}
