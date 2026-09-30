using BusTicketPlatform.Transport.Domain;

namespace BusTicketPlatform.Transport.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> RoleCodes)
{
    public bool Has(params string[] roles) => roles.Any(RoleCodes.Contains);
    public bool IsPlatformAdmin => Has(Roles.PlatformAdmin);
}

public sealed record MoneyDto(long Amount, string Currency);
public sealed record OperationAccepted(Guid OperationId, string Status, string? StatusUrl = null);
public sealed record OrganizationDto(Guid Id, string Code, string Name, string? ContactEmail, string? ContactPhone, string Status, bool AllowPayLater, decimal CommissionRate, long RowVersion);
public sealed record OrganizationInput(string? Code, string Name, string ContactEmail, string ContactPhone, bool? AllowPayLater, long ExpectedVersion);
public sealed record SeatInput(string Code, int Deck, int Row, int Column, string Type, bool Enabled);
public sealed record BusInput(string PlateNumber, string Type, IReadOnlyList<string> Amenities, long ExpectedVersion);
public sealed record BusDto(Guid Id, string PlateNumber, string Type, IReadOnlyList<string> Amenities, long ExpectedVersion, string Status, int SeatTemplateVersion, IReadOnlyList<SeatInput> Seats);
public sealed record DriverInput(Guid UserId, string LicenseNumber, DateOnly LicenseExpiresOn, long ExpectedVersion);
public sealed record DriverProfileDto(Guid Id, Guid UserId, string LicenseNumber, DateOnly LicenseExpiresOn, long ExpectedVersion, string Status);
public sealed record RouteStopInput(string Name, string? Address, int Sequence, int OffsetMinutes, bool PickupAllowed, bool DropoffAllowed);
public sealed record TripStopDto(Guid Id, string Name, string? Address, int Sequence, int OffsetMinutes, bool PickupAllowed, bool DropoffAllowed);
public sealed record RouteInput(string Name, string Origin, string Destination, decimal? DistanceKm, int? DurationMinutes, long ExpectedVersion);
public sealed record RouteDto(Guid Id, string Name, string Origin, string Destination, decimal? DistanceKm, int? DurationMinutes, long ExpectedVersion, string Status, IReadOnlyList<TripStopDto> Stops);
public sealed record TripInput(Guid RouteId, Guid BusId, Guid DriverId, DateTimeOffset DepartureAt, DateTimeOffset ArrivalAt, MoneyDto Fare, string PolicyVersion, long ExpectedVersion);
public sealed record TripDto(
    Guid Id,
    Guid OrganizationId,
    string OperatorName,
    string BusType,
    IReadOnlyList<string> Amenities,
    DateTimeOffset DepartureAt,
    DateTimeOffset ArrivalAt,
    string Origin,
    string Destination,
    MoneyDto Fare,
    string Status,
    bool Sellable,
    int? AvailableSeatCount,
    DateTimeOffset AvailabilityAsOf,
    string? PolicyVersion,
    IReadOnlyList<TripStopDto> Stops,
    long RowVersion);
public sealed record TripPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<TripDto> Items);
public sealed record ExpectedVersionRequest(long ExpectedVersion);
public sealed record VersionedReasonRequest(string Reason, long ExpectedVersion);
public sealed record TripTransitionRequest(long ExpectedVersion, string TargetStatus, string? Reason);
public sealed record DriverAssignmentDto(Guid TripId, Guid DriverId, DateTimeOffset StartAt, DateTimeOffset EndAt, bool Active);
public sealed record TripSearchQuery(
    string Origin,
    string Destination,
    DateOnly DepartureDate,
    int PassengerCount,
    long? MinPrice,
    long? MaxPrice,
    TimeOnly? DepartureTimeFrom,
    TimeOnly? DepartureTimeTo,
    Guid? OrganizationId,
    string? BusType,
    Guid? PickupStopId,
    Guid? DropoffStopId,
    IReadOnlyList<string>? Amenities,
    string? Sort,
    int Page,
    int Size);

public interface ITransportRepository
{
    Task<OrganizationRecord?> GetOrganizationAsync(Guid id, CancellationToken cancellationToken);
    Task InsertOrganizationAsync(OrganizationRecord org, CancellationToken cancellationToken);
    Task UpdateOrganizationAsync(OrganizationRecord org, CancellationToken cancellationToken);
    Task<IReadOnlyList<BusRecord>> ListBusesAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<BusRecord?> GetBusAsync(Guid organizationId, Guid busId, CancellationToken cancellationToken);
    Task InsertBusAsync(BusRecord bus, IReadOnlyList<SeatRecord> seats, CancellationToken cancellationToken);
    Task UpdateBusAsync(BusRecord bus, CancellationToken cancellationToken);
    Task ReplaceSeatsAsync(Guid busId, IReadOnlyList<SeatRecord> seats, int seatCount, long rowVersion, CancellationToken cancellationToken);
    Task<bool> BusHasActiveTripsAsync(Guid busId, CancellationToken cancellationToken);
    Task<IReadOnlyList<DriverRecord>> ListDriversAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<DriverRecord?> GetDriverAsync(Guid organizationId, Guid driverId, CancellationToken cancellationToken);
    Task InsertDriverAsync(DriverRecord driver, CancellationToken cancellationToken);
    Task UpdateDriverAsync(DriverRecord driver, CancellationToken cancellationToken);
    Task<IReadOnlyList<RouteRecord>> ListRoutesAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<RouteRecord?> GetRouteAsync(Guid organizationId, Guid routeId, CancellationToken cancellationToken);
    Task InsertRouteAsync(RouteRecord route, IReadOnlyList<RouteStopRecord> stops, CancellationToken cancellationToken);
    Task UpdateRouteAsync(RouteRecord route, IReadOnlyList<RouteStopRecord>? stops, CancellationToken cancellationToken);
    Task<StopRecord> UpsertStopAsync(Guid organizationId, string name, string? address, CancellationToken cancellationToken);
    Task InsertTripAsync(TripRecord trip, DriverAssignmentRecord assignment, CancellationToken cancellationToken);
    Task UpdateTripAsync(TripRecord trip, CancellationToken cancellationToken);
    Task<TripRecord?> GetTripAsync(Guid tripId, CancellationToken cancellationToken);
    Task<IReadOnlyList<TripRecord>> ListOperatorTripsAsync(Guid organizationId, int page, int size, CancellationToken cancellationToken);
    Task<long> CountOperatorTripsAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<TripRecord> Items, long Total)> SearchSellableAsync(TripSearchQuery query, CancellationToken cancellationToken);
    Task<IReadOnlyList<TripStopDto>> GetTripStopsAsync(Guid tripId, CancellationToken cancellationToken);
    Task<IReadOnlyList<DriverAssignmentDto>> ListAssignmentsForDriverAsync(Guid driverUserId, CancellationToken cancellationToken);
    Task MarkSellableAsync(Guid tripId, bool sellable, CancellationToken cancellationToken);
}

public sealed record OrganizationRecord(Guid Id, string Code, string Name, string? ContactEmail, string? ContactPhone, string Status, bool AllowPayLater, decimal CommissionRate, long RowVersion);
public sealed record SeatRecord(Guid Id, Guid BusId, string Code, int Deck, int Row, int Column, string Type, bool Active);
public sealed record BusRecord(Guid Id, Guid OrganizationId, string PlateNumber, string NormalizedPlate, string DisplayName, string Type, IReadOnlyList<string> Amenities, int SeatCount, string Status, long RowVersion, IReadOnlyList<SeatRecord> Seats);
public sealed record DriverRecord(Guid Id, Guid OrganizationId, Guid UserId, string EmployeeCode, string LicenseNumber, DateOnly LicenseExpiresOn, string Status, long RowVersion);
public sealed record StopRecord(Guid Id, Guid OrganizationId, string Name, string Address, string ProvinceCode);
public sealed record RouteStopRecord(Guid Id, Guid RouteId, Guid StopId, int Sequence, string Role, int OffsetMinutes, bool PickupAllowed, bool DropoffAllowed, string StopName, string? Address);
public sealed record RouteRecord(Guid Id, Guid OrganizationId, string Code, string Name, Guid OriginStopId, Guid DestinationStopId, string OriginName, string DestinationName, int DurationMinutes, decimal? DistanceKm, string Status, long RowVersion, IReadOnlyList<RouteStopRecord> Stops);
public sealed record TripRecord(
    Guid Id,
    Guid OrganizationId,
    string OperatorName,
    Guid RouteId,
    Guid BusId,
    Guid OriginStopId,
    Guid DestinationStopId,
    DateTimeOffset DepartureAt,
    DateTimeOffset ArrivalAt,
    long BaseFare,
    string Currency,
    string Status,
    bool Sellable,
    long? PublishedVersion,
    string? PolicyVersion,
    string BusType,
    IReadOnlyList<string> Amenities,
    string Origin,
    string Destination,
    int SeatCount,
    string? RouteSnapshot,
    string? BusSnapshot,
    string? FareSnapshot,
    long RowVersion,
    Guid? DriverId);
public sealed record DriverAssignmentRecord(Guid Id, Guid TripId, Guid DriverProfileId, string Role, DateTimeOffset Start, DateTimeOffset End, Guid AssignedBy);

public interface ITransportEvents
{
    Task TripPublishedAsync(TripRecord trip, Guid correlationId, CancellationToken cancellationToken);
    Task TripCancelledAsync(TripRecord trip, string reason, Guid correlationId, CancellationToken cancellationToken);
    Task TripStatusChangedAsync(TripRecord trip, Guid correlationId, CancellationToken cancellationToken);
}
