using BusTicketPlatform.Booking.Application;
using Npgsql;
using NpgsqlTypes;
namespace BusTicketPlatform.Booking.Infrastructure.Persistence;

public sealed partial class BookingRepository
{
    private const string CouponSelect = "SELECT code, percent, cap, minimum, organization_id, starts_at, expires_at, active FROM coupons";
    public async Task<IReadOnlyList<CouponDto>> ListCouponsAsync(Guid organizationId, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = new NpgsqlCommand(CouponSelect + " WHERE active AND starts_at<=NOW() AND expires_at>NOW() AND (organization_id IS NULL OR organization_id=@org) ORDER BY percent DESC, code LIMIT 20", connection);
        command.Parameters.AddWithValue("org", organizationId);
        return await ReadCoupons(command, ct);
    }
    public async Task<CouponDto?> GetCouponAsync(string code, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = new NpgsqlCommand(CouponSelect + " WHERE code=@code", connection);
        command.Parameters.AddWithValue("code", code);
        return (await ReadCoupons(command, ct)).FirstOrDefault();
    }
    public async Task SaveCouponAsync(CouponDto coupon, CancellationToken ct)
    {
        await using var connection = await OpenAsync(ct);
        await using var command = new NpgsqlCommand("""
          INSERT INTO coupons(code,percent,cap,minimum,organization_id,starts_at,expires_at,active)
          VALUES(@code,@percent,@cap,@min,@org,@start,@end,@active)
          ON CONFLICT(code) DO UPDATE SET percent=EXCLUDED.percent,cap=EXCLUDED.cap,minimum=EXCLUDED.minimum,
            organization_id=EXCLUDED.organization_id,starts_at=EXCLUDED.starts_at,expires_at=EXCLUDED.expires_at,active=EXCLUDED.active;
          """, connection);
        command.Parameters.AddWithValue("code",coupon.Code); command.Parameters.AddWithValue("percent",coupon.Percent);
        command.Parameters.AddWithValue("cap",coupon.Cap); command.Parameters.AddWithValue("min",coupon.Minimum);
        command.Parameters.AddWithValue("org",NpgsqlDbType.Uuid,(object?)coupon.OrganizationId ?? DBNull.Value);
        command.Parameters.AddWithValue("start",coupon.StartsAt.UtcDateTime); command.Parameters.AddWithValue("end",coupon.ExpiresAt.UtcDateTime);
        command.Parameters.AddWithValue("active",coupon.Active); await command.ExecuteNonQueryAsync(ct);
    }
    private static async Task<IReadOnlyList<CouponDto>> ReadCoupons(NpgsqlCommand command, CancellationToken ct)
    {
        await using var reader=await command.ExecuteReaderAsync(ct); var result=new List<CouponDto>();
        while(await reader.ReadAsync(ct)) result.Add(new(reader.GetString(0),reader.GetInt32(1),reader.GetInt64(2),reader.GetInt64(3),reader.IsDBNull(4)?null:reader.GetGuid(4),reader.GetFieldValue<DateTimeOffset>(5),reader.GetFieldValue<DateTimeOffset>(6),reader.GetBoolean(7)));
        return result;
    }
}
