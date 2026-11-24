using BusTicketPlatform.BuildingBlocks.Ids;

namespace BusTicketPlatform.Booking.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> Roles)
{
    public bool Has(params string[] roles) => roles.Any(Roles.Contains);
}

public sealed record MoneyDto(long Amount, string Currency);
public sealed record OperationAccepted(Guid OperationId, string Status, string? StatusUrl = null, DateTimeOffset? AcceptedAt = null);
public sealed record TripSeatDto(Guid Id, string Code, string Type, string Status, MoneyDto Price, long RowVersion);
public sealed record TripSeatListDto(Guid TripId, IReadOnlyList<TripSeatDto> Seats, DateTimeOffset AvailabilityAsOf, DateTimeOffset ServerTime);
public sealed record CreateSeatHoldRequest(IReadOnlyList<Guid> SeatIds, Guid PickupStopId, Guid DropoffStopId);
public sealed record SeatHoldDto(string HoldToken, Guid TripId, string Status, IReadOnlyList<TripSeatDto> Seats, DateTimeOffset ExpiresAt, DateTimeOffset ServerTime);
public sealed record BookingContact(string FullName, string Email, string Phone);
public sealed record PassengerInput(Guid SeatId, string FullName, string? DocumentType, string? DocumentNumber, Guid PickupStopId, Guid DropoffStopId);
public sealed record CreateBookingRequest(string HoldToken, BookingContact Contact, IReadOnlyList<PassengerInput> Passengers, long ExpectedTotal, string Currency, string PaymentChannel, string? CouponCode = null);
public sealed record BookingDto(Guid Id, string Code, Guid CustomerId, Guid TripId, string Status, string PaymentChannel, BookingContact Contact, long Subtotal, long Discount, long Fee, long Total, string Currency, DateTimeOffset ExpiresAt, IReadOnlyList<PassengerInput> Items, long RowVersion, Guid? OrganizationId = null, DateTimeOffset? CreatedAt = null, string? CouponCode = null, IReadOnlyList<string>? SeatCodes = null);
public sealed record BookingPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<BookingDto> Items);
public sealed record BookingListFilter(Guid? OrganizationId, string? Status, string? Search, Guid[] MatchingOrganizations,
    DateTimeOffset? CreatedFrom = null, DateTimeOffset? CreatedBefore = null, string? OperatorStatus = null, string? OperatorPayment = null,
    Guid[]? BookingIds = null);
public sealed record BookingReference(Guid Id, string Code)
{
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? CreatedAt { get; init; }
}
public sealed record CancellationPreviewRequest(IReadOnlyList<Guid> TicketIds);
public sealed record CancellationPreviewDto(Guid PreviewId, IReadOnlyList<Guid> TicketIds, string PolicyVersion, long Fee, long RefundAmount, string Currency, DateTimeOffset ExpiresAt);
public sealed record CancelBookingRequest(Guid PreviewId, string Reason, long ExpectedVersion);
public sealed record TicketJourney(string BookingCode, Guid SeatId, Guid PickupStopId, Guid DropoffStopId);
public sealed record TicketDto(Guid Id, string PublicCode, Guid BookingId, Guid TripId, string PassengerName, string SeatCode, string Status, string PaymentChannel, string? QrPayload, DateTimeOffset IssuedAt, DateTimeOffset? CheckedInAt, long RowVersion, long UnitPrice = 0)
{
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public TicketJourney? Journey { get; init; }
}
public sealed record TicketPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<TicketDto> Items);
public sealed record TicketScanRequest(Guid TripId, string ScannedToken, long ExpectedVersion);
public sealed record TicketValidationDto(bool Valid, string? ReasonCode, TicketDto? Ticket);
public sealed record ManifestPassengerDto(Guid TicketId, string PassengerName, string SeatCode, string PickupStopName, string Status);
public sealed record ManifestDto(Guid TripId, DateTimeOffset GeneratedAt, IReadOnlyList<ManifestPassengerDto> Passengers);
public sealed record ManifestCount(Guid TripId, int Booked, int CheckedIn);
public sealed record CancelledSeat(Guid BookingId, string SeatCode);
public sealed record TripPublishedMessage(
    Guid TripId,
    Guid OrganizationId,
    Guid RouteId,
    Guid BusId,
    Guid OriginStopId,
    Guid DestinationStopId,
    DateTimeOffset DepartureAt,
    DateTimeOffset ArrivalAt,
    string Currency,
    string Status,
    long SourceTripVersion,
    string? RouteSnapshot,
    string? BusSnapshot,
    string? FarePolicySnapshot,
    Guid? DriverUserId = null);
public sealed record PaymentSucceededMessage(Guid BookingId, Guid PaymentId, long Amount, string Currency);
public sealed record TripStatusChangedMessage(Guid TripId, string Status);

public sealed class CouponUnavailableException : Exception;

public sealed record CouponDto(string Code, int Percent, long Cap, long Minimum, Guid? OrganizationId, DateTimeOffset StartsAt, DateTimeOffset ExpiresAt, bool Active);
public sealed record CouponQuoteRequest(string HoldToken, string Code);
public sealed record CouponQuoteDto(string Code, long Subtotal, long Discount, long Total, string Currency, DateTimeOffset ExpiresAt);

public interface IBookingRepository
{
    Task<IReadOnlyList<CouponDto>> ListCouponsAsync(Guid organizationId, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task<CouponDto?> GetCouponAsync(string code, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task SaveCouponAsync(CouponDto coupon, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task ImportTripAsync(TripPublishedMessage message, IReadOnlyList<InventorySeat> seats, CancellationToken cancellationToken);
    Task ApplyTripStatusAsync(Guid tripId, string status, CancellationToken cancellationToken);
    Task ExpireHoldsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<InventorySeat>> ListSeatsAsync(Guid tripId, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, int>> AvailableSeatsAsync(Guid[] tripIds, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task<TripSnapshot?> GetTripAsync(Guid tripId, CancellationToken cancellationToken);
    Task<SeatHoldRecord?> CreateHoldAsync(SeatHoldRecord hold, IReadOnlyList<Guid> seatIds, CancellationToken cancellationToken);
    Task<SeatHoldRecord?> ReplaceHoldAsync(SeatHoldRecord hold, IReadOnlyList<Guid> seatIds, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task<SeatHoldRecord?> GetHoldByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task ReleaseHoldAsync(Guid holdId, CancellationToken cancellationToken);
    Task<BookingRecord?> CreateBookingAsync(BookingRecord booking, IReadOnlyList<BookingItemRecord> items, IReadOnlyList<PassengerRecord> passengers, Guid holdId, CancellationToken cancellationToken);
    Task<BookingRecord?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<BookingRecord?> GetBookingByCodeAsync(string code, CancellationToken cancellationToken) => throw new NotSupportedException();
    Task<IReadOnlyList<BookingRecord>> ListBookingsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken);
    Task<long> CountBookingsForCustomerAsync(Guid customerId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<BookingRecord> Items, long Total)> SearchBookingsAsync(BookingListFilter filter, int page, int size, CancellationToken cancellationToken);
    Task<IReadOnlyList<BookingReference>> FindBookingReferencesAsync(string? search, Guid[] ids, Guid? organizationId, CancellationToken cancellationToken);
    Task<bool> ApplyPaidAsync(Guid bookingId, IReadOnlyList<TicketRecord> tickets, CancellationToken cancellationToken, Guid correlationId = default);
    Task<CancellationPreviewRecord> InsertPreviewAsync(CancellationPreviewRecord preview, CancellationToken cancellationToken);
    Task<CancellationPreviewRecord?> GetPreviewAsync(Guid previewId, CancellationToken cancellationToken);
    Task CancelAsync(Guid bookingId, IReadOnlyList<Guid> ticketIds, long fee, long refund, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketRecord>> ListTicketsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketRecord>> ListTicketsForBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<long> CountTicketsForCustomerAsync(Guid customerId, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketAsync(Guid ticketId, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketByHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketByPublicCodeAsync(string publicCode, CancellationToken cancellationToken);
    Task CheckInAsync(Guid ticketId, Guid actorId, CancellationToken cancellationToken);
    Task<ManifestDto> GetManifestAsync(Guid tripId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ManifestCount>> GetManifestCountsAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CancelledSeat>> GetCancelledSeatsAsync(Guid organizationId, Guid[] bookings, CancellationToken cancellationToken);
}

public sealed record InventorySeat(Guid Id, Guid TripId, Guid SourceSeatId, string Code, string Type, int Deck, int Row, int Column, long Price, string Status, long RowVersion);
public sealed record TripSnapshot(Guid TripId, Guid OrganizationId, Guid OriginStopId, Guid DestinationStopId, DateTimeOffset DepartureAt, bool Sellable, string Status, string Currency, bool AllowPayLater, string PolicyVersion, Guid? DriverUserId);
public sealed record SeatHoldRecord(Guid Id, Guid TripId, Guid CustomerId, string IdempotencyKey, string TokenHash, string TokenPlain, string Status, long TotalAmount, string Currency, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, IReadOnlyList<InventorySeat> Seats);
public sealed record BookingItemRecord(Guid Id, Guid BookingId, Guid TripSeatId, Guid SourceSeatId, string SeatCode, long UnitPrice, long Discount = 0);
public sealed record PassengerRecord(Guid Id, Guid BookingItemId, string FullName, Guid PickupStopId, Guid DropoffStopId, string? DocumentType, byte[]? DocumentCipher, string? Last4);
public sealed record BookingRecord(
    Guid Id, string Code, Guid HoldId, Guid TripId, Guid OrganizationId, Guid CustomerId,
    string ContactName, string ContactEmail, string ContactPhone, string PaymentChannel, string Status,
    long Subtotal, long Discount, long Fee, long Total, string Currency, DateTimeOffset ExpiresAt, long RowVersion,
    IReadOnlyList<PassengerInput> Items, DateTimeOffset? CreatedAt = null, string? CouponCode = null,
    IReadOnlyList<string>? SeatCodes = null);
public sealed record TicketRecord(Guid Id, Guid BookingId, Guid BookingItemId, Guid TripId, Guid CustomerId, string PublicCode, string QrHash, string? QrPlain, string PaymentChannel, string Status, string PassengerName, string SeatCode, long UnitPrice, DateTimeOffset IssuedAt, DateTimeOffset? CheckedInAt, long RowVersion)
{
    public TicketJourney? Journey { get; init; }
}
public sealed record CancellationPreviewRecord(Guid Id, Guid BookingId, Guid RequestedBy, IReadOnlyList<Guid> BookingItemIds, IReadOnlyList<Guid> TicketIds, string PolicyVersion, long Eligible, decimal FeeRate, long Fee, long Refund, DateTimeOffset ExpiresAt, DateTimeOffset? ConsumedAt = null);

public interface IBookingEvents
{
    Task BookingCreatedAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken);
    Task BookingPaidAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken);
    Task TicketsIssuedAsync(IReadOnlyList<TicketRecord> tickets, Guid correlationId, CancellationToken cancellationToken);
    Task TicketsReadyAsync(BookingRecord booking, Guid correlationId, CancellationToken cancellationToken);
    Task RefundRequestedAsync(Guid bookingId, Guid paymentId, long amount, string currency, string reason, Guid correlationId, CancellationToken cancellationToken);
    Task BookingCancelledAsync(BookingRecord booking, string reason, Guid correlationId, CancellationToken cancellationToken);
    Task InventoryReadyAsync(Guid tripId, Guid correlationId, CancellationToken cancellationToken);
}

public static class CancellationPolicy
{
    public static DateTimeOffset SelfServiceCutoff(DateTimeOffset departureAt) => departureAt.AddHours(-2);

    public static (decimal Rate, bool Allowed) For(DateTimeOffset departureAt, DateTimeOffset now)
    {
        var hours = (departureAt - now).TotalHours;
        if (hours >= 24)
        {
            return (0.10m, true);
        }

        if (hours >= 6)
        {
            return (0.20m, true);
        }

        if (now <= SelfServiceCutoff(departureAt))
        {
            return (0.30m, true);
        }

        return (0m, false);
    }

    public static long HalfUp(decimal value) => (long)decimal.Round(value, 0, MidpointRounding.AwayFromZero);
}
