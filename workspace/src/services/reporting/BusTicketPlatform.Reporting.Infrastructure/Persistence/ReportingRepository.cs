using BusTicketPlatform.Reporting.Application;
using Npgsql;

namespace BusTicketPlatform.Reporting.Infrastructure.Persistence;

public sealed class ReportingRepository(ReportingDatabaseOptions options) : IReportingRepository
{
    public async Task ApplyRefundAsync(Guid bookingId, long amount, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH current AS (
              SELECT booking_id, refunded_amount AS old_refunded
              FROM booking_projections WHERE booking_id = @booking FOR UPDATE
            ), changed AS (
              UPDATE booking_projections b
              SET refunded_amount = LEAST(b.gross_amount, current.old_refunded + @amount),
                  net_amount = b.gross_amount - LEAST(b.gross_amount, current.old_refunded + @amount),
                  status = CASE WHEN current.old_refunded + @amount >= b.gross_amount THEN 'REFUNDED' ELSE b.status END,
                  data_as_of = NOW(), updated_at = NOW()
              FROM current WHERE b.booking_id = current.booking_id
              RETURNING b.organization_id_external, (b.booked_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS period_date,
                        b.currency, LEAST(@amount, b.gross_amount - current.old_refunded) AS applied
            )
            UPDATE revenue_projections r
            SET refund_amount = r.refund_amount + changed.applied,
                net_revenue = r.gross_revenue - (r.refund_amount + changed.applied),
                data_as_of = NOW(), updated_at = NOW()
            FROM changed
            WHERE r.organization_id_external = changed.organization_id_external
              AND r.period_date = changed.period_date AND r.currency = changed.currency;
            """, connection);
        command.Parameters.AddWithValue("booking", bookingId);
        command.Parameters.AddWithValue("amount", amount);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpsertBookingAsync(BookingFact fact, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO booking_projections (
              booking_id, booking_code, organization_id_external, customer_id_external, trip_id_external, route_name,
              departure_at, status, payment_channel, seat_count, gross_amount, cancellation_fee, refunded_amount, net_amount,
              currency, booked_at, source_version, data_as_of, updated_at)
            VALUES (
              @id, @code, @org, @customer, @trip, @route, @dep, @status, @channel, @seats, @gross, @fee, @refund, @net,
              @currency, @booked, 1, NOW(), NOW())
            ON CONFLICT (booking_id) DO UPDATE SET
              status = CASE
                WHEN booking_projections.refunded_amount > 0 AND EXCLUDED.refunded_amount = 0 THEN booking_projections.status
                ELSE EXCLUDED.status END,
              cancellation_fee = GREATEST(booking_projections.cancellation_fee, EXCLUDED.cancellation_fee),
              refunded_amount = GREATEST(booking_projections.refunded_amount, EXCLUDED.refunded_amount),
              net_amount = EXCLUDED.gross_amount - GREATEST(booking_projections.refunded_amount, EXCLUDED.refunded_amount),
              updated_at = NOW(), data_as_of = NOW();
            INSERT INTO revenue_projections (
              organization_id_external, period_date, currency, gross_revenue, refund_amount, cancellation_fee,
              platform_commission, operator_payable, net_revenue, paid_booking_count, cancelled_booking_count, data_as_of, updated_at)
            SELECT organization_id_external, (booked_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, currency,
              SUM(CASE WHEN status IN ('CONFIRMED','PAID','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED') THEN gross_amount ELSE 0 END),
              SUM(refunded_amount), SUM(cancellation_fee), 0,
              SUM(CASE WHEN status IN ('CONFIRMED','PAID','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED') THEN gross_amount ELSE 0 END) - SUM(refunded_amount),
              SUM(CASE WHEN status IN ('CONFIRMED','PAID','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED') THEN gross_amount ELSE 0 END) - SUM(refunded_amount),
              SUM(CASE WHEN status IN ('CONFIRMED','PAID','REFUND_PENDING','REFUNDED','COMPLETED') THEN 1 ELSE 0 END)::integer,
              SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)::integer, NOW(), NOW()
            FROM booking_projections
            WHERE organization_id_external = @org
              AND (booked_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (@booked AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              AND currency = @currency
            GROUP BY organization_id_external, (booked_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, currency
            ON CONFLICT (organization_id_external, period_date, currency) DO UPDATE SET
              gross_revenue = EXCLUDED.gross_revenue, refund_amount = EXCLUDED.refund_amount,
              cancellation_fee = EXCLUDED.cancellation_fee, operator_payable = EXCLUDED.operator_payable,
              net_revenue = EXCLUDED.net_revenue, paid_booking_count = EXCLUDED.paid_booking_count,
              cancelled_booking_count = EXCLUDED.cancelled_booking_count,
              updated_at = NOW(), data_as_of = NOW();
            """, connection);
        command.Parameters.AddWithValue("id", fact.BookingId);
        command.Parameters.AddWithValue("code", fact.BookingCode);
        command.Parameters.AddWithValue("org", fact.OrganizationId);
        command.Parameters.AddWithValue("customer", fact.CustomerId);
        command.Parameters.AddWithValue("trip", fact.TripId);
        command.Parameters.AddWithValue("route", fact.RouteName);
        command.Parameters.AddWithValue("dep", fact.DepartureAt.UtcDateTime);
        command.Parameters.AddWithValue("status", fact.Status);
        command.Parameters.AddWithValue("channel", fact.PaymentChannel);
        command.Parameters.AddWithValue("seats", fact.SeatCount);
        command.Parameters.AddWithValue("gross", fact.GrossAmount);
        command.Parameters.AddWithValue("fee", fact.CancellationFee);
        command.Parameters.AddWithValue("refund", fact.RefundedAmount);
        command.Parameters.AddWithValue("net", fact.NetAmount);
        command.Parameters.AddWithValue("currency", fact.Currency);
        command.Parameters.AddWithValue("booked", fact.BookedAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> RevenueAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken) =>
        Query("""
            SELECT organization_id_external AS organizationId, period_date AS periodDate, currency, gross_revenue AS grossRevenue,
                   refund_amount AS refundAmount, net_revenue AS netRevenue, paid_booking_count AS paidBookingCount
            FROM revenue_projections
            WHERE period_date BETWEEN @from AND @to AND (@org::uuid IS NULL OR organization_id_external = @org)
            ORDER BY period_date
            """, orgId, from, to, cancellationToken);

    public Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> BookingsAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken) =>
        Query("""
            SELECT booking_id AS bookingId, booking_code AS bookingCode, status, payment_channel AS paymentChannel, gross_amount AS grossAmount, booked_at AS bookedAt
            FROM booking_projections
            WHERE booked_at BETWEEN @from AND @to AND (@org::uuid IS NULL OR organization_id_external = @org)
            ORDER BY booked_at DESC
            """, orgId, from, to, cancellationToken);

    public Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> OccupancyAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken) =>
        Query("""
            SELECT trip_id AS tripId, route_name AS routeName, departure_at AS departureAt, booked_count AS bookedCount, capacity
            FROM occupancy_projections
            WHERE departure_at BETWEEN @from AND @to AND (@org::uuid IS NULL OR organization_id_external = @org)
            ORDER BY departure_at
            """, orgId, from, to, cancellationToken);

    private async Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> Query(string sql, Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("from", from.UtcDateTime);
        command.Parameters.AddWithValue("to", to.UtcDateTime);
        command.Parameters.AddWithValue("org", (object?)orgId ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<IReadOnlyDictionary<string, object>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = new Dictionary<string, object>(StringComparer.Ordinal);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? "" : reader.GetValue(i);
            }

            rows.Add(row);
        }

        return rows;
    }
}
