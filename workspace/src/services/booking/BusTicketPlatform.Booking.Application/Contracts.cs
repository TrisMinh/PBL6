using BusTicketPlatform.BuildingBlocks.Ids;

namespace BusTicketPlatform.Booking.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> Roles)
{
    public bool Has(params string[] roles) => roles.Any(Roles.Contains);
}

public sealed record MoneyDto(long Amount, string Currency);
public sealed record OperationAccepted(Guid OperationId, string Status, string? StatusUrl = null);
public sealed record TripSeatDto(Guid Id, string Code, string Type, string Status, MoneyDto Price, long RowVersion);
public sealed record TripSeatListDto(Guid TripId, IReadOnlyList<TripSeatDto> Seats, DateTimeOffset AvailabilityAsOf, DateTimeOffset ServerTime);
public sealed record CreateSeatHoldRequest(IReadOnlyList<Guid> SeatIds, Guid PickupStopId, Guid DropoffStopId);
public sealed record SeatHoldDto(string HoldToken, Guid TripId, string Status, IReadOnlyList<TripSeatDto> Seats, DateTimeOffset ExpiresAt, DateTimeOffset ServerTime);
public sealed record BookingContact(string FullName, string Email, string Phone);
public sealed record PassengerInput(Guid SeatId, string FullName, string? DocumentType, string? DocumentNumber, Guid PickupStopId, Guid DropoffStopId);
public sealed record CreateBookingRequest(string HoldToken, BookingContact Contact, IReadOnlyList<PassengerInput> Passengers, long ExpectedTotal, string Currency, string PaymentChannel);
public sealed record BookingDto(Guid Id, string Code, Guid CustomerId, Guid TripId, string Status, string PaymentChannel, BookingContact Contact, long Subtotal, long Discount, long Fee, long Total, string Currency, DateTimeOffset ExpiresAt, IReadOnlyList<PassengerInput> Items, long RowVersion);
public sealed record BookingPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<BookingDto> Items);
public sealed record CancellationPreviewRequest(IReadOnlyList<Guid> TicketIds);
public sealed record CancellationPreviewDto(Guid PreviewId, IReadOnlyList<Guid> TicketIds, string PolicyVersion, long Fee, long RefundAmount, string Currency, DateTimeOffset ExpiresAt);
public sealed record CancelBookingRequest(Guid PreviewId, string Reason, long ExpectedVersion);
public sealed record TicketDto(Guid Id, string PublicCode, Guid BookingId, Guid TripId, string PassengerName, string SeatCode, string Status, string PaymentChannel, string? QrPayload, DateTimeOffset IssuedAt, DateTimeOffset? CheckedInAt, long RowVersion);
public sealed record TicketPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<TicketDto> Items);
public sealed record TicketScanRequest(Guid TripId, string ScannedToken, long ExpectedVersion);
public sealed record TicketValidationDto(bool Valid, string? ReasonCode, TicketDto? Ticket);
public sealed record ManifestPassengerDto(Guid TicketId, string PassengerName, string SeatCode, string PickupStopName, string Status);
public sealed record ManifestDto(Guid TripId, DateTimeOffset GeneratedAt, IReadOnlyList<ManifestPassengerDto> Passengers);
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
    string? FarePolicySnapshot);
public sealed record PaymentSucceededMessage(Guid BookingId, Guid PaymentId, long Amount, string Currency);

public interface IBookingRepository
{
    Task ImportTripAsync(TripPublishedMessage message, IReadOnlyList<InventorySeat> seats, CancellationToken cancellationToken);
    Task ExpireHoldsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<InventorySeat>> ListSeatsAsync(Guid tripId, CancellationToken cancellationToken);
    Task<TripSnapshot?> GetTripAsync(Guid tripId, CancellationToken cancellationToken);
    Task<SeatHoldRecord?> CreateHoldAsync(SeatHoldRecord hold, IReadOnlyList<Guid> seatIds, CancellationToken cancellationToken);
    Task<SeatHoldRecord?> GetHoldByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task ReleaseHoldAsync(Guid holdId, CancellationToken cancellationToken);
    Task<BookingRecord?> CreateBookingAsync(BookingRecord booking, IReadOnlyList<BookingItemRecord> items, IReadOnlyList<PassengerRecord> passengers, Guid holdId, CancellationToken cancellationToken);
    Task<BookingRecord?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<IReadOnlyList<BookingRecord>> ListBookingsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken);
    Task<long> CountBookingsForCustomerAsync(Guid customerId, CancellationToken cancellationToken);
    Task<IReadOnlyList<BookingRecord>> SearchBookingsAsync(Guid? organizationId, int page, int size, CancellationToken cancellationToken);
    Task<long> CountBookingsAsync(Guid? organizationId, CancellationToken cancellationToken);
    Task ApplyPaidAsync(Guid bookingId, IReadOnlyList<TicketRecord> tickets, CancellationToken cancellationToken);
    Task<CancellationPreviewRecord> InsertPreviewAsync(CancellationPreviewRecord preview, CancellationToken cancellationToken);
    Task<CancellationPreviewRecord?> GetPreviewAsync(Guid previewId, CancellationToken cancellationToken);
    Task CancelAsync(Guid bookingId, IReadOnlyList<Guid> ticketIds, long fee, long refund, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketRecord>> ListTicketsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken);
    Task<long> CountTicketsForCustomerAsync(Guid customerId, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketAsync(Guid ticketId, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketByHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task<TicketRecord?> GetTicketByPublicCodeAsync(string publicCode, CancellationToken cancellationToken);
    Task CheckInAsync(Guid ticketId, Guid actorId, CancellationToken cancellationToken);
    Task<ManifestDto> GetManifestAsync(Guid tripId, CancellationToken cancellationToken);
}

public sealed record InventorySeat(Guid Id, Guid TripId, Guid SourceSeatId, string Code, string Type, int Deck, int Row, int Column, long Price, string Status, long RowVersion);
public sealed record TripSnapshot(Guid TripId, Guid OrganizationId, Guid OriginStopId, Guid DestinationStopId, DateTimeOffset DepartureAt, bool Sellable, string Status, string Currency, bool AllowPayLater, string PolicyVersion);
public sealed record SeatHoldRecord(Guid Id, Guid TripId, Guid CustomerId, string IdempotencyKey, string TokenHash, string TokenPlain, string Status, long TotalAmount, string Currency, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, IReadOnlyList<InventorySeat> Seats);
public sealed record BookingItemRecord(Guid Id, Guid BookingId, Guid TripSeatId, Guid SourceSeatId, string SeatCode, long UnitPrice);
public sealed record PassengerRecord(Guid Id, Guid BookingItemId, string FullName, Guid PickupStopId, Guid DropoffStopId, string? DocumentType, byte[]? DocumentCipher, string? Last4);
public sealed record BookingRecord(
    Guid Id, string Code, Guid HoldId, Guid TripId, Guid OrganizationId, Guid CustomerId,
    string ContactName, string ContactEmail, string ContactPhone, string PaymentChannel, string Status,
    long Subtotal, long Discount, long Fee, long Total, string Currency, DateTimeOffset ExpiresAt, long RowVersion,
    IReadOnlyList<PassengerInput> Items);
public sealed record TicketRecord(Guid Id, Guid BookingId, Guid BookingItemId, Guid TripId, Guid CustomerId, string PublicCode, string QrHash, string? QrPlain, string PaymentChannel, string Status, string PassengerName, string SeatCode, DateTimeOffset IssuedAt, DateTimeOffset? CheckedInAt, long RowVersion);
public sealed record CancellationPreviewRecord(Guid Id, Guid BookingId, Guid RequestedBy, IReadOnlyList<Guid> BookingItemIds, IReadOnlyList<Guid> TicketIds, string PolicyVersion, long Eligible, decimal FeeRate, long Fee, long Refund, DateTimeOffset ExpiresAt);

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

        if (hours >= 2)
        {
            return (0.30m, true);
        }

        return (0m, false);
    }

    public static long HalfUp(decimal value) => (long)decimal.Round(value, 0, MidpointRounding.AwayFromZero);
}
