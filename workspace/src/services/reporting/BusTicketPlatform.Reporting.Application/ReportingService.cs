using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Reporting.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> RoleCodes)
{
    public bool Has(params string[] roles) => roles.Any(RoleCodes.Contains);
}

public sealed record ReportDto(IReadOnlyList<object> Data, DateTimeOffset GeneratedAt, DateTimeOffset DataAsOf, string Timezone, IReadOnlyDictionary<string, string> MetricDefinitions);
public sealed record BookingFact(Guid BookingId, string BookingCode, Guid OrganizationId, Guid CustomerId, Guid TripId, string RouteName, DateTimeOffset DepartureAt, string Status, string PaymentChannel, int SeatCount, long GrossAmount, long CancellationFee, long RefundedAmount, long NetAmount, string Currency, DateTimeOffset BookedAt);

public interface IReportingRepository
{
    Task UpsertBookingAsync(BookingFact fact, CancellationToken cancellationToken);
    Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> RevenueAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
    Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> BookingsAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
    Task<IReadOnlyList<IReadOnlyDictionary<string, object>>> OccupancyAsync(Guid? orgId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
}

public sealed class ReportingService(IReportingRepository store)
{
    public Task IngestAsync(BookingFact fact, CancellationToken cancellationToken) => store.UpsertBookingAsync(fact, cancellationToken);

    public async Task<Result<ReportDto>> RevenueAsync(Actor actor, DateTimeOffset from, DateTimeOffset to, string timezone, CancellationToken cancellationToken)
    {
        if (!CanRead(actor))
        {
            return Result<ReportDto>.Failure(PlatformErrors.AccessDenied());
        }

        var data = await store.RevenueAsync(Scope(actor), from, to, cancellationToken);
        return Result<ReportDto>.Success(Report(data, timezone, "gross_revenue", "Gross prepaid and confirmed booking value"));
    }

    public async Task<Result<ReportDto>> BookingsAsync(Actor actor, DateTimeOffset from, DateTimeOffset to, string timezone, CancellationToken cancellationToken)
    {
        if (!CanRead(actor))
        {
            return Result<ReportDto>.Failure(PlatformErrors.AccessDenied());
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

        var data = await store.OccupancyAsync(Scope(actor), from, to, cancellationToken);
        return Result<ReportDto>.Success(Report(data, timezone, "booked_count", "Booked seats by trip"));
    }

    private static bool CanRead(Actor actor) => actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE", "OPERATOR_ADMIN", "OPERATOR_FINANCE");
    private static Guid? Scope(Actor actor) => actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE") ? null : actor.OrganizationId;
    private static ReportDto Report(IReadOnlyList<IReadOnlyDictionary<string, object>> data, string timezone, string metric, string definition) =>
        new(data.Cast<object>().ToArray(), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, timezone, new Dictionary<string, string> { [metric] = definition });
}
