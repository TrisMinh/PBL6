using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Transport.Domain;

namespace BusTicketPlatform.Transport.Application;

public sealed class TransportService(ITransportRepository store, ITransportEvents events, IIdGenerator ids)
{
    private static readonly string[] FleetRoles = [Roles.OperatorAdmin, Roles.OperatorScheduler];
    private static readonly string[] OperateRoles = [Roles.OperatorAdmin, Roles.OperatorOperations, Roles.Driver];
    private static readonly string[] CancelRoles = [Roles.OperatorAdmin, Roles.OperatorOperations];
    private static readonly string[] ReadRoles =
    [
        Roles.OperatorAdmin, Roles.OperatorScheduler, Roles.OperatorOperations, Roles.Driver
    ];

    public async Task<Result<OrganizationDto>> CreateOrganizationAsync(Actor actor, OrganizationInput input, CancellationToken cancellationToken)
    {
        if (!actor.IsPlatformAdmin)
        {
            return Fail<OrganizationDto>(PlatformErrors.AccessDenied());
        }

        if (string.IsNullOrWhiteSpace(input.Code) || input.Name.Length is < 2 or > 200)
        {
            return Fail<OrganizationDto>(PlatformErrors.Validation("Organization input is invalid."));
        }

        var org = new OrganizationRecord(
            ids.NewUuidV7(),
            input.Code.Trim().ToUpperInvariant(),
            input.Name.Trim(),
            input.ContactEmail,
            input.ContactPhone,
            OrganizationStatuses.Active,
            input.AllowPayLater ?? false,
            0.1000m,
            0);
        await store.InsertOrganizationAsync(org, cancellationToken);
        return Result<OrganizationDto>.Success(Map(org));
    }

    public async Task<Result<OrganizationDto>> GetOrganizationAsync(Actor actor, Guid organizationId, CancellationToken cancellationToken)
    {
        if (!CanReadOrg(actor, organizationId))
        {
            return Fail<OrganizationDto>(PlatformErrors.AccessDenied());
        }

        var org = await store.GetOrganizationAsync(organizationId, cancellationToken);
        return org is null ? Fail<OrganizationDto>(PlatformErrors.NotFound()) : Result<OrganizationDto>.Success(Map(org));
    }

    public async Task<Result<OrganizationDto>> UpdateOrganizationAsync(Actor actor, OrganizationInput input, CancellationToken cancellationToken)
    {
        if (actor.OrganizationId is null || !actor.Has(Roles.OperatorAdmin))
        {
            return Fail<OrganizationDto>(PlatformErrors.AccessDenied());
        }

        var org = await store.GetOrganizationAsync(actor.OrganizationId.Value, cancellationToken);
        if (org is null)
        {
            return Fail<OrganizationDto>(PlatformErrors.NotFound());
        }

        if (org.RowVersion != input.ExpectedVersion)
        {
            return Fail<OrganizationDto>(PlatformErrors.VersionConflict());
        }

        var updated = org with
        {
            Name = input.Name.Trim(),
            ContactEmail = input.ContactEmail,
            ContactPhone = input.ContactPhone,
            AllowPayLater = input.AllowPayLater ?? org.AllowPayLater,
            RowVersion = org.RowVersion + 1
        };
        await store.UpdateOrganizationAsync(updated, cancellationToken);
        return Result<OrganizationDto>.Success(Map(updated));
    }

    public async Task<Result<IReadOnlyList<BusDto>>> ListBusesAsync(Actor actor, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
        {
            return Fail<IReadOnlyList<BusDto>>(error);
        }

        var buses = await store.ListBusesAsync(orgId, cancellationToken);
        return Result<IReadOnlyList<BusDto>>.Success(buses.Select(Map).ToArray());
    }

    public async Task<Result<BusDto>> CreateBusAsync(Actor actor, BusInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<BusDto>(error);
        }

        if (input.PlateNumber.Length is < 5 or > 20)
        {
            return Fail<BusDto>(PlatformErrors.Validation("Plate number is invalid.", "plateNumber"));
        }

        var busId = ids.NewUuidV7();
        var seat = new SeatRecord(ids.NewUuidV7(), busId, "1A", 1, 1, 1, "STANDARD", true);
        var bus = new BusRecord(
            busId,
            orgId,
            input.PlateNumber.Trim(),
            NormalizePlate(input.PlateNumber),
            input.PlateNumber.Trim(),
            input.Type,
            input.Amenities,
            1,
            "ACTIVE",
            0,
            [seat]);
        await store.InsertBusAsync(bus, bus.Seats, cancellationToken);
        return Result<BusDto>.Success(Map(bus));
    }

    public async Task<Result<BusDto>> UpdateBusAsync(Actor actor, Guid busId, BusInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<BusDto>(error);
        }

        var bus = await store.GetBusAsync(orgId, busId, cancellationToken);
        if (bus is null)
        {
            return Fail<BusDto>(PlatformErrors.NotFound());
        }

        if (bus.RowVersion != input.ExpectedVersion)
        {
            return Fail<BusDto>(PlatformErrors.VersionConflict());
        }

        var updated = bus with
        {
            PlateNumber = input.PlateNumber.Trim(),
            NormalizedPlate = NormalizePlate(input.PlateNumber),
            DisplayName = input.PlateNumber.Trim(),
            Type = input.Type,
            Amenities = input.Amenities,
            RowVersion = bus.RowVersion + 1
        };
        await store.UpdateBusAsync(updated, cancellationToken);
        return Result<BusDto>.Success(Map(updated));
    }

    public async Task<Result<BusDto>> DeactivateBusAsync(Actor actor, Guid busId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<BusDto>(error);
        }

        var bus = await store.GetBusAsync(orgId, busId, cancellationToken);
        if (bus is null)
        {
            return Fail<BusDto>(PlatformErrors.NotFound());
        }

        var updated = bus with { Status = "INACTIVE", RowVersion = bus.RowVersion + 1 };
        await store.UpdateBusAsync(updated, cancellationToken);
        return Result<BusDto>.Success(Map(updated));
    }

    public async Task<Result<BusDto>> ReplaceSeatsAsync(Actor actor, Guid busId, IReadOnlyList<SeatInput> seats, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<BusDto>(error);
        }

        var bus = await store.GetBusAsync(orgId, busId, cancellationToken);
        if (bus is null)
        {
            return Fail<BusDto>(PlatformErrors.NotFound());
        }

        if (await store.BusHasActiveTripsAsync(busId, cancellationToken))
        {
            return Fail<BusDto>(PlatformErrors.Validation("Seat layout cannot change while the bus has active trips."));
        }

        var records = seats.Select(seat => new SeatRecord(
            ids.NewUuidV7(),
            busId,
            seat.Code,
            seat.Deck,
            seat.Row,
            seat.Column,
            seat.Type,
            seat.Enabled)).ToArray();
        await store.ReplaceSeatsAsync(busId, records, records.Length, bus.RowVersion + 1, cancellationToken);
        var updated = await store.GetBusAsync(orgId, busId, cancellationToken);
        return Result<BusDto>.Success(Map(updated!));
    }

    public async Task<Result<IReadOnlyList<DriverProfileDto>>> ListDriversAsync(Actor actor, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
        {
            return Fail<IReadOnlyList<DriverProfileDto>>(error);
        }

        var drivers = await store.ListDriversAsync(orgId, cancellationToken);
        return Result<IReadOnlyList<DriverProfileDto>>.Success(drivers.Select(Map).ToArray());
    }

    public async Task<Result<DriverProfileDto>> CreateDriverAsync(Actor actor, DriverInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<DriverProfileDto>(error);
        }

        var driverId = ids.NewUuidV7();
        var driver = new DriverRecord(
            driverId,
            orgId,
            input.UserId,
            "EMP-" + driverId.ToString("N")[^12..].ToUpperInvariant(),
            input.LicenseNumber.Trim(),
            input.LicenseExpiresOn,
            "ACTIVE",
            0);
        await store.InsertDriverAsync(driver, cancellationToken);
        return Result<DriverProfileDto>.Success(Map(driver));
    }

    public async Task<Result<DriverProfileDto>> UpdateDriverAsync(Actor actor, Guid driverId, DriverInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<DriverProfileDto>(error);
        }

        var driver = await store.GetDriverAsync(orgId, driverId, cancellationToken);
        if (driver is null)
        {
            return Fail<DriverProfileDto>(PlatformErrors.NotFound());
        }

        if (driver.RowVersion != input.ExpectedVersion)
        {
            return Fail<DriverProfileDto>(PlatformErrors.VersionConflict());
        }

        var updated = driver with
        {
            UserId = input.UserId,
            LicenseNumber = input.LicenseNumber.Trim(),
            LicenseExpiresOn = input.LicenseExpiresOn,
            RowVersion = driver.RowVersion + 1
        };
        await store.UpdateDriverAsync(updated, cancellationToken);
        return Result<DriverProfileDto>.Success(Map(updated));
    }

    public async Task<Result<DriverProfileDto>> DeactivateDriverAsync(Actor actor, Guid driverId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<DriverProfileDto>(error);
        }

        var driver = await store.GetDriverAsync(orgId, driverId, cancellationToken);
        if (driver is null)
        {
            return Fail<DriverProfileDto>(PlatformErrors.NotFound());
        }

        var updated = driver with { Status = "INACTIVE", RowVersion = driver.RowVersion + 1 };
        await store.UpdateDriverAsync(updated, cancellationToken);
        return Result<DriverProfileDto>.Success(Map(updated));
    }

    public async Task<Result<IReadOnlyList<RouteDto>>> ListRoutesAsync(Actor actor, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
        {
            return Fail<IReadOnlyList<RouteDto>>(error);
        }

        var routes = await store.ListRoutesAsync(orgId, cancellationToken);
        return Result<IReadOnlyList<RouteDto>>.Success(routes.Select(Map).ToArray());
    }

    public async Task<Result<RouteDto>> CreateRouteAsync(Actor actor, RouteInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<RouteDto>(error);
        }

        var origin = await store.UpsertStopAsync(orgId, input.Origin, null, cancellationToken);
        var destination = await store.UpsertStopAsync(orgId, input.Destination, null, cancellationToken);
        var routeId = ids.NewUuidV7();
        var duration = input.DurationMinutes ?? 60;
        var stops = new[]
        {
            new RouteStopRecord(ids.NewUuidV7(), routeId, origin.Id, 0, "ORIGIN", 0, true, false, origin.Name, origin.Address),
            new RouteStopRecord(ids.NewUuidV7(), routeId, destination.Id, 1, "DESTINATION", duration, false, true, destination.Name, destination.Address)
        };
        var route = new RouteRecord(
            routeId,
            orgId,
            "RT-" + routeId.ToString("N")[^12..].ToUpperInvariant(),
            input.Name.Trim(),
            origin.Id,
            destination.Id,
            origin.Name,
            destination.Name,
            duration,
            input.DistanceKm,
            "ACTIVE",
            0,
            stops);
        await store.InsertRouteAsync(route, stops, cancellationToken);
        return Result<RouteDto>.Success(Map(route));
    }

    public async Task<Result<RouteDto>> UpdateRouteAsync(Actor actor, Guid routeId, RouteInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<RouteDto>(error);
        }

        var route = await store.GetRouteAsync(orgId, routeId, cancellationToken);
        if (route is null)
        {
            return Fail<RouteDto>(PlatformErrors.NotFound());
        }

        if (route.RowVersion != input.ExpectedVersion)
        {
            return Fail<RouteDto>(PlatformErrors.VersionConflict());
        }

        var origin = await store.UpsertStopAsync(orgId, input.Origin, null, cancellationToken);
        var destination = await store.UpsertStopAsync(orgId, input.Destination, null, cancellationToken);
        var updated = route with
        {
            Name = input.Name.Trim(),
            OriginStopId = origin.Id,
            DestinationStopId = destination.Id,
            OriginName = origin.Name,
            DestinationName = destination.Name,
            DurationMinutes = input.DurationMinutes ?? route.DurationMinutes,
            DistanceKm = input.DistanceKm,
            RowVersion = route.RowVersion + 1
        };
        await store.UpdateRouteAsync(updated, null, cancellationToken);
        var loaded = await store.GetRouteAsync(orgId, routeId, cancellationToken);
        return Result<RouteDto>.Success(Map(loaded!));
    }

    public async Task<Result<RouteDto>> ReplaceRouteStopsAsync(Actor actor, Guid routeId, IReadOnlyList<RouteStopInput> stops, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<RouteDto>(error);
        }

        var route = await store.GetRouteAsync(orgId, routeId, cancellationToken);
        if (route is null)
        {
            return Fail<RouteDto>(PlatformErrors.NotFound());
        }

        var ordered = stops.OrderBy(item => item.Sequence).ToArray();
        var records = new List<RouteStopRecord>();
        for (var i = 0; i < ordered.Length; i++)
        {
            var item = ordered[i];
            var stop = await store.UpsertStopAsync(orgId, item.Name, item.Address, cancellationToken);
            var role = i == 0 ? "ORIGIN" : i == ordered.Length - 1 ? "DESTINATION" : "INTERMEDIATE";
            records.Add(new RouteStopRecord(ids.NewUuidV7(), routeId, stop.Id, item.Sequence, role, item.OffsetMinutes, item.PickupAllowed, item.DropoffAllowed, stop.Name, item.Address));
        }

        var updated = route with
        {
            OriginStopId = records[0].StopId,
            DestinationStopId = records[^1].StopId,
            OriginName = records[0].StopName,
            DestinationName = records[^1].StopName,
            Stops = records,
            RowVersion = route.RowVersion + 1
        };
        await store.UpdateRouteAsync(updated, records, cancellationToken);
        var loaded = await store.GetRouteAsync(orgId, routeId, cancellationToken);
        return Result<RouteDto>.Success(Map(loaded!));
    }

    public async Task<Result<RouteDto>> DeactivateRouteAsync(Actor actor, Guid routeId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<RouteDto>(error);
        }

        var route = await store.GetRouteAsync(orgId, routeId, cancellationToken);
        if (route is null)
        {
            return Fail<RouteDto>(PlatformErrors.NotFound());
        }

        var updated = route with { Status = "INACTIVE", RowVersion = route.RowVersion + 1 };
        await store.UpdateRouteAsync(updated, null, cancellationToken);
        return Result<RouteDto>.Success(Map(updated));
    }

    public async Task<Result<TripPageDto>> ListOperatorTripsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
        {
            return Fail<TripPageDto>(error);
        }

        size = size is < 1 or > 100 ? 20 : size;
        var items = await store.ListOperatorTripsAsync(orgId, page, size, cancellationToken);
        var total = await store.CountOperatorTripsAsync(orgId, cancellationToken);
        var mapped = new List<TripDto>();
        foreach (var trip in items)
        {
            mapped.Add(await MapTripAsync(trip, cancellationToken));
        }

        return Result<TripPageDto>.Success(Page(mapped, page, size, total));
    }

    public async Task<Result<TripDto>> CreateTripDraftAsync(Actor actor, TripInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<TripDto>(error);
        }

        if (input.Fare.Currency != "VND" || input.PolicyVersion != "cancel-mvp-v1" || input.ArrivalAt <= input.DepartureAt)
        {
            return Fail<TripDto>(PlatformErrors.Validation("Trip input is invalid."));
        }

        var route = await store.GetRouteAsync(orgId, input.RouteId, cancellationToken);
        var bus = await store.GetBusAsync(orgId, input.BusId, cancellationToken);
        var driver = await store.GetDriverAsync(orgId, input.DriverId, cancellationToken);
        if (route is null || bus is null || driver is null || bus.Status != "ACTIVE" || driver.Status != "ACTIVE")
        {
            return Fail<TripDto>(PlatformErrors.Validation("Route, bus or driver is not usable."));
        }

        var tripId = ids.NewUuidV7();
        var trip = new TripRecord(
            tripId,
            orgId,
            (await store.GetOrganizationAsync(orgId, cancellationToken))!.Name,
            route.Id,
            bus.Id,
            route.OriginStopId,
            route.DestinationStopId,
            input.DepartureAt,
            input.ArrivalAt,
            input.Fare.Amount,
            "VND",
            TripStatuses.Draft,
            false,
            null,
            input.PolicyVersion,
            bus.Type,
            bus.Amenities,
            route.OriginName,
            route.DestinationName,
            bus.SeatCount,
            null,
            null,
            null,
            0,
            driver.Id);
        var assignment = new DriverAssignmentRecord(
            ids.NewUuidV7(),
            tripId,
            driver.Id,
            "PRIMARY",
            input.DepartureAt.AddHours(-1),
            input.ArrivalAt.AddHours(1),
            actor.UserId);
        await store.InsertTripAsync(trip, assignment, cancellationToken);
        return Result<TripDto>.Success(await MapTripAsync(trip, cancellationToken));
    }

    public async Task<Result<TripDto>> UpdateTripDraftAsync(Actor actor, Guid tripId, TripInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<TripDto>(error);
        }

        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null || trip.OrganizationId != orgId)
        {
            return Fail<TripDto>(PlatformErrors.NotFound());
        }

        if (trip.Status != TripStatuses.Draft)
        {
            return Fail<TripDto>(PlatformErrors.Validation("Only draft trips can be updated."));
        }

        if (trip.RowVersion != input.ExpectedVersion)
        {
            return Fail<TripDto>(PlatformErrors.VersionConflict());
        }

        var updated = trip with
        {
            RouteId = input.RouteId,
            BusId = input.BusId,
            DriverId = input.DriverId,
            DepartureAt = input.DepartureAt,
            ArrivalAt = input.ArrivalAt,
            BaseFare = input.Fare.Amount,
            PolicyVersion = input.PolicyVersion,
            RowVersion = trip.RowVersion + 1
        };
        await store.UpdateTripAsync(updated, cancellationToken);
        return Result<TripDto>.Success(await MapTripAsync(updated, cancellationToken));
    }

    public async Task<Result<OperationAccepted>> PublishTripAsync(Actor actor, Guid tripId, long expectedVersion, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<OperationAccepted>(error);
        }

        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null || trip.OrganizationId != orgId)
        {
            return Fail<OperationAccepted>(PlatformErrors.NotFound());
        }

        if (trip.RowVersion != expectedVersion)
        {
            return Fail<OperationAccepted>(PlatformErrors.VersionConflict());
        }

        if (trip.Status != TripStatuses.Draft)
        {
            return Fail<OperationAccepted>(PlatformErrors.Validation("Only draft trips can be published."));
        }

        var bus = await store.GetBusAsync(orgId, trip.BusId, cancellationToken);
        var route = await store.GetRouteAsync(orgId, trip.RouteId, cancellationToken);
        var published = trip with
        {
            Status = TripStatuses.Scheduled,
            PublishedVersion = 1,
            RouteSnapshot = JsonSerializer.Serialize(new { route!.Id, route.Name, route.Stops }),
            BusSnapshot = JsonSerializer.Serialize(new
            {
                bus!.Id,
                bus.Type,
                bus.Amenities,
                seats = bus.Seats.Select(seat => new { seat.Id, seat.Code, seat.Deck, row = seat.Row, column = seat.Column, seat.Type, seat.Active })
            }),
            FareSnapshot = JsonSerializer.Serialize(new { baseFare = trip.BaseFare, trip.Currency, policyVersion = trip.PolicyVersion, allowPayLater = (await store.GetOrganizationAsync(orgId, cancellationToken))!.AllowPayLater }),
            RowVersion = trip.RowVersion + 1
        };
        try
        {
            await store.UpdateTripAsync(published, cancellationToken);
        }
        catch (InvalidOperationException exception) when (exception.Message == "SCHEDULE_CONFLICT")
        {
            return Fail<OperationAccepted>(PlatformErrors.ScheduleConflict());
        }

        await events.TripPublishedAsync(published, correlationId, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(tripId, "ACCEPTED"));
    }

    public async Task<Result<OperationAccepted>> CancelTripAsync(Actor actor, Guid tripId, VersionedReasonRequest request, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, CancelRoles, out var orgId, out var error))
        {
            return Fail<OperationAccepted>(error);
        }

        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null || trip.OrganizationId != orgId)
        {
            return Fail<OperationAccepted>(PlatformErrors.NotFound());
        }

        if (trip.RowVersion != request.ExpectedVersion)
        {
            return Fail<OperationAccepted>(PlatformErrors.VersionConflict());
        }

        var cancelled = trip with { Status = TripStatuses.Cancelled, Sellable = false, RowVersion = trip.RowVersion + 1 };
        await store.UpdateTripAsync(cancelled, cancellationToken);
        await events.TripCancelledAsync(cancelled, request.Reason, correlationId, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(tripId, "ACCEPTED"));
    }

    public async Task<Result<TripDto>> TransitionTripAsync(Actor actor, Guid tripId, TripTransitionRequest request, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, OperateRoles, out var orgId, out var error))
        {
            return Fail<TripDto>(error);
        }

        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null || trip.OrganizationId != orgId)
        {
            return Fail<TripDto>(PlatformErrors.NotFound());
        }

        if (trip.RowVersion != request.ExpectedVersion)
        {
            return Fail<TripDto>(PlatformErrors.VersionConflict());
        }

        if (!IsAllowedTransition(trip.Status, request.TargetStatus))
        {
            return Fail<TripDto>(PlatformErrors.Validation("The trip transition is not allowed.", "targetStatus"));
        }

        var sellable = request.TargetStatus is TripStatuses.Scheduled or TripStatuses.Boarding && trip.Sellable;
        var updated = trip with { Status = request.TargetStatus, Sellable = sellable, RowVersion = trip.RowVersion + 1 };
        await store.UpdateTripAsync(updated, cancellationToken);
        await events.TripStatusChangedAsync(updated, correlationId, cancellationToken);
        return Result<TripDto>.Success(await MapTripAsync(updated, cancellationToken));
    }

    public async Task<Result<TripPageDto>> SearchAsync(TripSearchQuery query, CancellationToken cancellationToken)
    {
        if (query.PassengerCount is < 1 or > 10 || string.IsNullOrWhiteSpace(query.Origin) || string.IsNullOrWhiteSpace(query.Destination))
        {
            return Fail<TripPageDto>(PlatformErrors.Validation("Search query is invalid."));
        }

        if (!string.IsNullOrWhiteSpace(query.Sort) && query.Sort is not ("PRICE_ASC" or "PRICE_DESC" or "DEPARTURE_ASC" or "DEPARTURE_DESC" or "DURATION_ASC" or "DURATION_DESC"))
        {
            return Fail<TripPageDto>(PlatformErrors.Validation("Sort is not allowed.", "sort"));
        }

        var (items, total) = await store.SearchSellableAsync(query, cancellationToken);
        var mapped = new List<TripDto>();
        foreach (var trip in items)
        {
            mapped.Add(await MapTripAsync(trip, cancellationToken));
        }

        return Result<TripPageDto>.Success(Page(mapped, query.Page, query.Size, total));
    }

    public async Task<Result<TripDto>> GetPublicTripAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var trip = await store.GetTripAsync(tripId, cancellationToken);
        return trip is null ? Fail<TripDto>(PlatformErrors.NotFound()) : Result<TripDto>.Success(await MapTripAsync(trip, cancellationToken));
    }

    public async Task<Result<IReadOnlyList<TripStopDto>>> GetTripStopsAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null)
        {
            return Fail<IReadOnlyList<TripStopDto>>(PlatformErrors.NotFound());
        }

        return Result<IReadOnlyList<TripStopDto>>.Success(await store.GetTripStopsAsync(tripId, cancellationToken));
    }

    public Task<IReadOnlyList<DriverAssignmentDto>> GetMyAssignmentsAsync(Actor actor, CancellationToken cancellationToken) =>
        store.ListAssignmentsForDriverAsync(actor.UserId, cancellationToken);

    public Task MarkInventoryReadyAsync(Guid tripId, CancellationToken cancellationToken) =>
        store.MarkSellableAsync(tripId, true, cancellationToken);

    private async Task<TripDto> MapTripAsync(TripRecord trip, CancellationToken cancellationToken)
    {
        var stops = await store.GetTripStopsAsync(trip.Id, cancellationToken);
        return new TripDto(
            trip.Id,
            trip.OrganizationId,
            trip.OperatorName,
            trip.BusType,
            trip.Amenities,
            trip.DepartureAt,
            trip.ArrivalAt,
            trip.Origin,
            trip.Destination,
            new MoneyDto(trip.BaseFare, trip.Currency),
            trip.Status,
            trip.Sellable,
            trip.SeatCount,
            DateTimeOffset.UtcNow,
            trip.PolicyVersion,
            stops,
            trip.RowVersion);
    }

    private static bool IsAllowedTransition(string from, string to) => (from, to) switch
    {
        (TripStatuses.Scheduled, TripStatuses.Boarding) => true,
        (TripStatuses.Boarding, TripStatuses.Departed) => true,
        (TripStatuses.Departed, TripStatuses.InTransit) => true,
        (TripStatuses.InTransit, TripStatuses.Arrived) => true,
        (TripStatuses.Arrived, TripStatuses.Completed) => true,
        _ => false
    };

    private static bool TryTenant(Actor actor, string[] roles, out Guid organizationId, out AppError error)
    {
        organizationId = actor.OrganizationId ?? Guid.Empty;
        if (actor.OrganizationId is null || !actor.Has(roles))
        {
            error = PlatformErrors.AccessDenied();
            return false;
        }

        error = PlatformErrors.AccessDenied();
        return true;
    }

    private static bool CanReadOrg(Actor actor, Guid organizationId) =>
        actor.IsPlatformAdmin || actor.OrganizationId == organizationId;

    private static string NormalizePlate(string plate) =>
        new string(plate.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    private static OrganizationDto Map(OrganizationRecord org) =>
        new(org.Id, org.Code, org.Name, org.ContactEmail, org.ContactPhone, org.Status, org.AllowPayLater, org.CommissionRate, org.RowVersion);

    private static BusDto Map(BusRecord bus) =>
        new(
            bus.Id,
            bus.PlateNumber,
            bus.Type,
            bus.Amenities,
            bus.RowVersion,
            bus.Status,
            Math.Max(1, (int)bus.RowVersion + 1),
            bus.Seats.Select(seat => new SeatInput(seat.Code, seat.Deck, seat.Row, seat.Column, seat.Type, seat.Active)).ToArray());

    private static DriverProfileDto Map(DriverRecord driver) =>
        new(driver.Id, driver.UserId, driver.LicenseNumber, driver.LicenseExpiresOn, driver.RowVersion, driver.Status);

    private static RouteDto Map(RouteRecord route) =>
        new(
            route.Id,
            route.Name,
            route.OriginName,
            route.DestinationName,
            route.DistanceKm,
            route.DurationMinutes,
            route.RowVersion,
            route.Status,
            route.Stops.Select(stop => new TripStopDto(stop.StopId, stop.StopName, stop.Address, stop.Sequence, stop.OffsetMinutes, stop.PickupAllowed, stop.DropoffAllowed)).ToArray());

    private static TripPageDto Page(IReadOnlyList<TripDto> items, int page, int size, long total)
    {
        size = size <= 0 ? 20 : size;
        var pages = (int)((total + size - 1) / size);
        return new TripPageDto(page, size, total, pages, items);
    }

    private static Result<T> Fail<T>(AppError error) => Result<T>.Failure(error);
}
