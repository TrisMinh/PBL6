using BusTicketPlatform.Reporting.Application;
using Npgsql;

namespace BusTicketPlatform.Reporting.Infrastructure.Persistence;

public sealed class ReportingRepository(ReportingDatabaseOptions options) : IReportingRepository
{
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
              status = EXCLUDED.status, cancellation_fee = EXCLUDED.cancellation_fee, refunded_amount = EXCLUDED.refunded_amount,
              net_amount = EXCLUDED.net_amount, updated_at = NOW(), data_as_of = NOW();
            INSERT INTO revenue_projections (
              organization_id_external, period_date, currency, gross_revenue, refund_amount, cancellation_fee,
              platform_commission, operator_payable, net_revenue, paid_booking_count, cancelled_booking_count, data_as_of, updated_at)
            VALUES (
              @org, (@booked AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, @currency, @gross, @refund, @fee, 0, @gross, @gross - @refund,
              1, 0, NOW(), NOW())
            ON CONFLICT (organization_id_external, period_date, currency) DO UPDATE SET
              gross_revenue = revenue_projections.gross_revenue + EXCLUDED.gross_revenue,
              refund_amount = revenue_projections.refund_amount + EXCLUDED.refund_amount,
              net_revenue = (revenue_projections.gross_revenue + EXCLUDED.gross_revenue) - (revenue_projections.refund_amount + EXCLUDED.refund_amount),
              paid_booking_count = revenue_projections.paid_booking_count + 1,
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
