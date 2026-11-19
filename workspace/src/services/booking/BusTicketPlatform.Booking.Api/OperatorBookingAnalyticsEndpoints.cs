using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Booking.Infrastructure;
using Npgsql;
using NpgsqlTypes;

namespace BusTicketPlatform.Booking.Api;

public static class OperatorBookingAnalyticsEndpoints
{
    private static readonly TimeZoneInfo VietnamTime = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");

    public static void MapOperatorBookingAnalytics(this IEndpointRouteBuilder endpoints)
    {
        var report = endpoints.MapGroup("/api/v1/operator/bookings/analytics").RequireAuthorization();
        report.MapGet("", ReadAsync);
        report.MapGet("/orders", ReadOrdersAsync);
    }

    private static bool HasReportAccess(HttpContext context, Guid? organization) =>
        organization is not null && organization != Guid.Empty &&
        context.User.FindAll("org_role").Any(claim => claim.Value is "OPERATOR_ADMIN" or "OPERATOR_FINANCE");

    private static bool ValidRange(DateOnly from, DateOnly to, bool allTime) =>
        to != DateOnly.MaxValue && (allTime || (to >= from && to.DayNumber - from.DayNumber < 366));

    private static bool ValidChannel(string? channel) => channel is null or "PREPAID" or "PAY_LATER";

    private static async Task<IResult> ReadAsync(HttpContext context, BookingDatabaseOptions options,
        DateOnly from, DateOnly to, Guid? routeId, string? channel, bool allTime = false)
    {
        var organization = context.User.OrganizationId();
        if (!HasReportAccess(context, organization))
            return PlatformHttp.Error(PlatformErrors.AccessDenied(), context.CorrelationId());

        if (!ValidRange(from, to, allTime))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose an increasing range of at most 366 calendar days.", "to"), context.CorrelationId());
        if (!ValidChannel(channel))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose a supported payment channel.", "channel"), context.CorrelationId());

        var cancellationToken = context.RequestAborted;
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH in_range AS MATERIALIZED (
              SELECT * FROM bi.booking_activity
              WHERE organization_id_external = @org AND (@start IS NULL OR created_at >= @start) AND created_at < @end
            ), selected AS MATERIALIZED (
              SELECT * FROM in_range
              WHERE (@route IS NULL OR route_id = @route) AND (@channel IS NULL OR payment_channel = @channel)
            ), totals AS (
              SELECT COUNT(*) AS bookings,
                     COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'PAID', 'COMPLETED')) AS confirmed,
                     COUNT(DISTINCT customer_id_external) FILTER (WHERE tickets > 0) AS customers,
                     COUNT(DISTINCT trip_id) FILTER (WHERE tickets > 0) AS trips,
                     COALESCE(SUM(tickets), 0) AS tickets, COALESCE(SUM(boarded), 0) AS boarded
              FROM selected
            ), daily AS (
              SELECT period_date AS date, COUNT(*) AS bookings,
                     SUM(tickets) AS tickets, SUM(boarded) AS boarded
              FROM selected GROUP BY period_date
            ), route_options AS (
              SELECT DISTINCT ON (route_id) route_id AS id, route_name AS name
              FROM in_range ORDER BY route_id, created_at DESC, route_name
            ), matrix AS (
              SELECT s.period_date AS date, s.route_id AS "routeId", o.name, s.payment_channel AS channel,
                     COUNT(*) AS bookings, SUM(s.tickets) AS tickets, SUM(s.boarded) AS boarded
              FROM selected s JOIN route_options o ON o.id = s.route_id
              GROUP BY s.period_date, s.route_id, o.name, s.payment_channel
            ), statuses AS (
              SELECT status, COUNT(*) AS bookings FROM selected GROUP BY status
            )
            SELECT jsonb_build_object(
              'totals', (SELECT to_jsonb(totals) FROM totals),
              'daily', COALESCE((SELECT jsonb_agg(daily ORDER BY date) FROM daily), '[]'),
              'routes', COALESCE((SELECT jsonb_agg(route_options ORDER BY name, id) FROM route_options), '[]'),
              'matrix', COALESCE((SELECT jsonb_agg(matrix ORDER BY date, name, channel) FROM matrix), '[]'),
              'statuses', COALESCE((SELECT jsonb_agg(statuses ORDER BY bookings DESC, status) FROM statuses), '[]')
            )::text
            """, connection);
        command.Parameters.AddWithValue("org", organization.GetValueOrDefault());
        command.Parameters.AddWithValue("start", NpgsqlDbType.TimestampTz, allTime ? DBNull.Value : ToUtc(from));
        command.Parameters.AddWithValue("end", ToUtc(to.AddDays(1)));
        command.Parameters.AddWithValue("route", NpgsqlDbType.Uuid, (object?)routeId ?? DBNull.Value);
        command.Parameters.AddWithValue("channel", NpgsqlDbType.Text, (object?)channel ?? DBNull.Value);
        var json = (string)(await command.ExecuteScalarAsync(cancellationToken))!;
        return Results.Content(json, "application/json");
    }

    private static async Task<IResult> ReadOrdersAsync(HttpContext context, BookingDatabaseOptions options,
        DateOnly from, DateOnly to, Guid? routeId, string? channel, string? status, string? tickets, string? q,
        int page = 1, bool allTime = false)
    {
        var organization = context.User.OrganizationId();
        if (!HasReportAccess(context, organization))
            return PlatformHttp.Error(PlatformErrors.AccessDenied(), context.CorrelationId());

        if (!ValidRange(from, to, allTime))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose an increasing range of at most 366 calendar days.", "to"), context.CorrelationId());
        if (!ValidChannel(channel))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose a supported payment channel.", "channel"), context.CorrelationId());
        if (status is not (null or "PENDING_PAYMENT" or "CONFIRMED" or "PAID" or "EXPIRED" or "CANCELLED" or "REFUND_PENDING" or "REFUNDED" or "COMPLETED"))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose a supported booking status.", "status"), context.CorrelationId());
        if (tickets is not (null or "valid" or "checked-in"))
            return PlatformHttp.Error(PlatformErrors.Validation("Choose a supported ticket filter.", "tickets"), context.CorrelationId());
        if (q?.Length > 64)
            return PlatformHttp.Error(PlatformErrors.Validation("Search must be at most 64 characters.", "q"), context.CorrelationId());
        if (page < 1)
            return PlatformHttp.Error(PlatformErrors.Validation("Page must be at least 1.", "page"), context.CorrelationId());

        var cancellationToken = context.RequestAborted;
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH filtered AS MATERIALIZED (
              SELECT b.id, b.booking_code AS code, b.created_at, b.status, b.payment_channel AS channel,
                     COALESCE(NULLIF(trip.route_snapshot ->> 'Name', ''),
                              NULLIF(trip.route_snapshot ->> 'name', ''),
                              'Tuyến ' || left(trip.route_id_external::text, 8)) AS route
              FROM bookings b
              JOIN trip_snapshots trip ON trip.trip_id = b.trip_id
                AND trip.organization_id_external = b.organization_id_external
              WHERE b.organization_id_external = @org AND (@start IS NULL OR b.created_at >= @start) AND b.created_at < @end
                AND (@route IS NULL OR trip.route_id_external = @route)
                AND (@channel IS NULL OR b.payment_channel = @channel)
                AND (@status IS NULL OR b.status = @status)
                AND (@search = '' OR strpos(lower(b.booking_code), lower(@search)) > 0)
                AND (@tickets IS NULL OR EXISTS (
                  SELECT 1 FROM tickets t WHERE t.booking_id = b.id
                    AND (t.status IN ('CHECKED_IN', 'USED') OR (@tickets = 'valid' AND t.status = 'ISSUED'))
                ))
            ), page_rows AS (
              SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT 15 OFFSET @offset
            )
            SELECT jsonb_build_object(
              'total', (SELECT COUNT(*) FROM filtered),
              'items', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'code', p.code, 'date', (p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
                  'route', p.route, 'status', p.status, 'channel', p.channel,
                  'tickets', t.valid, 'checkedIn', t.checked_in
                ) ORDER BY p.created_at DESC, p.id DESC)
                FROM page_rows p CROSS JOIN LATERAL (
                  SELECT COUNT(*) FILTER (WHERE status IN ('ISSUED', 'CHECKED_IN', 'USED')) AS valid,
                         COUNT(*) FILTER (WHERE status IN ('CHECKED_IN', 'USED')) AS checked_in
                  FROM tickets WHERE booking_id = p.id
                ) t
              ), '[]'::jsonb)
            )::text
            """, connection);
        command.Parameters.AddWithValue("org", organization.GetValueOrDefault());
        command.Parameters.AddWithValue("start", NpgsqlDbType.TimestampTz, allTime ? DBNull.Value : ToUtc(from));
        command.Parameters.AddWithValue("end", ToUtc(to.AddDays(1)));
        command.Parameters.AddWithValue("route", NpgsqlDbType.Uuid, (object?)routeId ?? DBNull.Value);
        command.Parameters.AddWithValue("channel", NpgsqlDbType.Text, (object?)channel ?? DBNull.Value);
        command.Parameters.AddWithValue("status", NpgsqlDbType.Text, (object?)status ?? DBNull.Value);
        command.Parameters.AddWithValue("tickets", NpgsqlDbType.Text, (object?)tickets ?? DBNull.Value);
        command.Parameters.AddWithValue("search", q?.Trim() ?? "");
        command.Parameters.AddWithValue("offset", (page - 1L) * 15);
        var json = (string)(await command.ExecuteScalarAsync(cancellationToken))!;
        return Results.Content(json, "application/json");
    }

    private static DateTime ToUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), VietnamTime);
}
