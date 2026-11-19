using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;
using System.Text.Json.Serialization;

namespace BusTicketPlatform.Reporting.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> RoleCodes, IReadOnlyList<string>? OrganizationRoles = null)
{
    public bool Has(params string[] roles) => roles.Any(RoleCodes.Contains);
}

public sealed record ReportDto(IReadOnlyList<object> Data, DateTimeOffset GeneratedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTimeOffset? DataAsOf,
    string Timezone, IReadOnlyDictionary<string, string> MetricDefinitions);
public sealed record BookingFact(Guid BookingId, string BookingCode, Guid OrganizationId, Guid CustomerId, Guid TripId, string RouteName, DateTimeOffset DepartureAt, string Status, string PaymentChannel, int SeatCount, long GrossAmount, long CancellationFee, long RefundedAmount, long NetAmount, string Currency, DateTimeOffset BookedAt);
public sealed record RevenueMovement(string MovementKey, string Kind, Guid PaymentId, Guid OrganizationId, string Currency,
    DateTimeOffset EffectiveAt, long Amount, long Commission, long Payable);
public sealed record RevenueDay(Guid OrganizationId, DateOnly PeriodDate, string Currency, long GrossRevenue,
    long RefundAmount, long NetRevenue, long PlatformCommission, long OperatorPayable, long UnsettledAmount,
    long PaymentCount, long RefundCount, DateTimeOffset DataAsOf);

public interface IReportingRepository
{
    Task UpsertBookingAsync(BookingFact fact, CancellationToken cancellationToken);
    Task ApplyRefundAsync(Guid bookingId, long amount, CancellationToken cancellationToken);
    Task RecordRevenueAsync(RevenueMovement movement, CancellationToken cancellationToken);
    Task<IReadOnlyList<RevenueDay>> RevenueAsync(Guid? orgId, DateOnly from, DateOnly to, CancellationToken cancellationToken);
    Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> BookingsAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
    Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> OccupancyAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
}

public sealed class ReportingService(IReportingRepository store)
{
    public const string RevenueTimezone = "Asia/Ho_Chi_Minh";
    private static readonly TimeZoneInfo VietnamTime = TimeZoneInfo.FindSystemTimeZoneById(RevenueTimezone);
    private static readonly IReadOnlyDictionary<string, string> RevenueDefinitions = new Dictionary<string, string>
    {
        ["grossRevenue"] = "Successful platform payment captures, on the capture date.",
        ["refundAmount"] = "Successful refunds, on the refund date.",
        ["netRevenue"] = "Gross revenue less refunds in the selected period.",
        ["platformCommission"] = "Net platform commission movements from prepaid settlements.",
        ["operatorPayable"] = "Net operator payable movements from prepaid settlements, before payouts.",
        ["unsettledAmount"] = "Net collection less commission and operator payable movements in the period."
    };

    public Task IngestAsync(BookingFact fact, CancellationToken cancellationToken) => store.UpsertBookingAsync(fact, cancellationToken);
    public Task IngestRevenueAsync(RevenueMovement movement, CancellationToken cancellationToken) =>
        store.RecordRevenueAsync(movement, cancellationToken);

    public Task IngestRefundAsync(Guid bookingId, long amount, CancellationToken cancellationToken) =>
        bookingId == Guid.Empty || amount <= 0 ? Task.CompletedTask : store.ApplyRefundAsync(bookingId, amount, cancellationToken);

    public async Task<Result<ReportDto>> RevenueAsync(Actor actor, DateTimeOffset from, DateTimeOffset to, string timezone,
        CancellationToken cancellationToken, bool operatorOnly = false, bool allTime = false)
    {
        var platformScope = !allTime && !operatorOnly && actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE");
        var operatorScope = actor.OrganizationId is Guid id && id != Guid.Empty &&
            actor.OrganizationRoles?.Any(role => role is "OPERATOR_ADMIN" or "OPERATOR_FINANCE") == true;
        if (!platformScope && !operatorScope)
        {
            return Result<ReportDto>.Failure(PlatformErrors.AccessDenied());
        }

        if (!string.Equals(timezone, RevenueTimezone, StringComparison.Ordinal))
        {
            return Result<ReportDto>.Failure(PlatformErrors.Validation("Revenue reports use Asia/Ho_Chi_Minh.", "timezone"));
        }

        if (from >= to)
        {
            return Result<ReportDto>.Failure(PlatformErrors.Validation("Report start must be before report end.", "from"));
        }

        var start = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(from, VietnamTime).DateTime);
        var end = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(to, VietnamTime).DateTime);
        if (!allTime && end.DayNumber - start.DayNumber >= 366)
        {
            return Result<ReportDto>.Failure(PlatformErrors.Validation("Revenue reports are limited to 366 calendar days.", "to"));
        }

        var data = await store.RevenueAsync(platformScope ? null : actor.OrganizationId, allTime ? DateOnly.MinValue : start, end, cancellationToken);
        return Result<ReportDto>.Success(new ReportDto(data, DateTimeOffset.UtcNow,
            data.Count == 0 ? null : data.Max(row => row.DataAsOf), RevenueTimezone, RevenueDefinitions));
    }

    public async Task<Result<ReportDto>> BookingsAsync(Actor actor, DateTimeOffset from, DateTimeOffset to, string timezone, CancellationToken cancellationToken)
    {
        if (!CanRead(actor))
        {
            return Result<ReportDto>.Failure(PlatformErrors.AccessDenied());
        }

        if (from >= to)
        {
            return Result<ReportDto>.Failure(PlatformErrors.Validation("Report start must be before report end.", "from"));
        }

        var data = await store.BookingsAsync(Scope(actor), from, to, cancellationToken);
        return Result<ReportDto>.Success(Report(data, timezone, "booking_count", "Booking rows in range"));
    }

    public async Task<Result<ReportDto>> OccupancyAsync(Actor actor, DateTimeOffset from, DateTimeOffset to, string timezone, CancellationToken cancellationToken)
    {
        if (!CanRead(actor))
        {
            return Result<ReportDto>.Failure(PlatformErrors.AccessDenied());
        }

        if (from >= to)
        {
            return Result<ReportDto>.Failure(PlatformErrors.Validation("Report start must be before report end.", "from"));
        }

        var data = await store.OccupancyAsync(Scope(actor), from, to, cancellationToken);
        return Result<ReportDto>.Success(Report(data, timezone, "booked_count", "Booked seats by trip"));
    }

    private static bool CanRead(Actor actor) =>
        actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE") ||
        (actor.OrganizationId is Guid id && id != Guid.Empty && actor.Has("OPERATOR_ADMIN", "OPERATOR_FINANCE"));
    private static Guid? Scope(Actor actor) => actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE") ? null : actor.OrganizationId;
    private static ReportDto Report(IReadOnlyList<IReadOnlyDictionary<string, object>> data, string timezone, string metric, string definition) =>
        new(data.Cast<object>().ToArray(), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, timezone, new Dictionary<string, string> { [metric] = definition });
}
