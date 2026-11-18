using BusTicketPlatform.Booking.Infrastructure;
using Npgsql;

namespace BusTicketPlatform.Booking.Api;

public static class AdminBookingAuditEndpoints
{
    public static void MapAdminBookingAudit(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/admin/bookings/{id:guid}/audit", async (Guid id, HttpContext context, BookingDatabaseOptions options) =>
        {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            await using var db = new NpgsqlConnection(options.ConnectionString);
            await db.OpenAsync(context.RequestAborted);
            await using var command = new NpgsqlCommand("SELECT created_at,updated_at,paid_at,cancelled_at,completed_at,refunded_at,cancellation_fee,refund_amount,status,ARRAY(SELECT i.seat_code FROM booking_items i WHERE i.booking_id=bookings.id ORDER BY i.created_at,i.id) FROM bookings WHERE id=@id", db);
            command.Parameters.AddWithValue("id", id);
            await using var reader = await command.ExecuteReaderAsync(context.RequestAborted);
            if (!await reader.ReadAsync(context.RequestAborted)) return Results.NotFound();
            var history = new List<object>();
            void Add(int index, string description) { if (!reader.IsDBNull(index)) history.Add(new { occurredAt = reader.GetDateTime(index), description }); }
            Add(0, "Tạo đơn đặt vé");
            Add(2, "Ghi nhận thanh toán");
            Add(3, "Hủy đơn đặt vé");
            Add(4, "Hoàn thành chuyến đi");
            Add(5, "Hoàn tiền thành công");
            if (reader.GetDateTime(1) != reader.GetDateTime(0)) Add(1, $"Cập nhật trạng thái đơn: {reader.GetString(8)}");
            return Results.Json(new { history, updatedAt = reader.GetDateTime(1), cancellationFee = reader.IsDBNull(6) ? (long?)null : reader.GetInt64(6), refundAmount = reader.IsDBNull(7) ? (long?)null : reader.GetInt64(7), seats = reader.GetFieldValue<string[]>(9) });
        }).RequireAuthorization();
    }
}
