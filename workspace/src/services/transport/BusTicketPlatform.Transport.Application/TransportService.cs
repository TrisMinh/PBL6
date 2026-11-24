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

    public async Task<Result<IReadOnlyList<OrganizationDto>>> ListOrganizationsAsync(Actor actor, CancellationToken cancellationToken)
    {
        if (!actor.IsPlatformAdmin)
        {
            return Fail<IReadOnlyList<OrganizationDto>>(PlatformErrors.AccessDenied());
        }
        var organizations = await store.ListOrganizationsAsync(cancellationToken);
        return Result<IReadOnlyList<OrganizationDto>>.Success(organizations.Select(Map).ToArray());
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
        try
        {
            await store.InsertBusAsync(bus, bus.Seats, cancellationToken);
        }
        catch (InvalidOperationException exception) when (exception.Message == "DUPLICATE_BUS_PLATE")
        {
            return Fail<BusDto>(PlatformErrors.ResourceConflict("The bus plate number is already in use."));
        }

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

    public async Task<Result<BusDto>> SetSeatPermissionAsync(Actor actor, Guid busId, string code, SeatPermissionInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error)) return Fail<BusDto>(error);
        var bus = await store.GetBusAsync(orgId, busId, cancellationToken);
        if (bus is null || !bus.Seats.Any(seat => seat.Code == code)) return Fail<BusDto>(PlatformErrors.NotFound());
        if (!await store.SetSeatPermissionAsync(orgId, busId, code, input.Enabled, input.ExpectedVersion, cancellationToken))
            return Fail<BusDto>(PlatformErrors.VersionConflict());
        var saved = await store.GetBusAsync(orgId, busId, cancellationToken);
        return Result<BusDto>.Success(Map(saved!));
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
            input.LicenseExpiresOn < DateOnly.FromDateTime(DateTime.UtcNow) ? "EXPIRED" : "ACTIVE",
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
            Status = driver.Status == "INACTIVE"
                ? driver.Status
                : input.LicenseExpiresOn < DateOnly.FromDateTime(DateTime.UtcNow) ? "EXPIRED" : "ACTIVE",
            RowVersion = driver.RowVersion + 1
        };
        await store.UpdateDriverAsync(updated, cancellationToken);
        return Result<DriverProfileDto>.Success(Map(updated));
    }

    public async Task<Result<DriverProfileDto>> DeleteDriverAsync(Actor actor, Guid driverId, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
            return Fail<DriverProfileDto>(error);
        var driver = await store.GetDriverAsync(orgId, driverId, cancellationToken);
        if (driver is null) return Fail<DriverProfileDto>(PlatformErrors.NotFound());
        if (!await store.DeleteDriverAsync(orgId, driverId, cancellationToken))
            return Fail<DriverProfileDto>(PlatformErrors.ResourceConflict("Tài xế đang được phân công cho chuyến chưa kết thúc. Hãy đổi tài xế của chuyến trước khi xóa."));
        return Result<DriverProfileDto>.Success(Map(driver));
    }

    public Task<Result<DriverProfileDto>> DeactivateDriverAsync(Actor actor, Guid driverId, CancellationToken cancellationToken) =>
        SetDriverStatusAsync(actor, driverId, active: false, cancellationToken);

    public Task<Result<DriverProfileDto>> ActivateDriverAsync(Actor actor, Guid driverId, CancellationToken cancellationToken) =>
        SetDriverStatusAsync(actor, driverId, active: true, cancellationToken);

    private async Task<Result<DriverProfileDto>> SetDriverStatusAsync(Actor actor, Guid driverId, bool active, CancellationToken cancellationToken)
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

        if (active && driver.LicenseExpiresOn < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return Fail<DriverProfileDto>(PlatformErrors.ResourceConflict("Giấy phép lái xe đã hết hạn. Cập nhật ngày hết hạn trước khi khôi phục."));
        }

        var status = active ? "ACTIVE" : "INACTIVE";
        if (driver.Status == status)
        {
            return Result<DriverProfileDto>.Success(Map(driver));
        }

        var updated = driver with { Status = status, RowVersion = driver.RowVersion + 1 };
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

        if (stops.Count < 2
            || stops.Any(item => string.IsNullOrWhiteSpace(item.Name) || item.Sequence < 0 || item.OffsetMinutes < 0)
            || stops.Select(item => item.Sequence).Distinct().Count() != stops.Count
            || stops.Select(item => item.Name.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != stops.Count)
        {
            return Fail<RouteDto>(PlatformErrors.Validation("Route stops must be unique and contain an origin and destination.", "stops"));
        }

        var ordered = stops.OrderBy(item => item.Sequence).ToArray();
        if (ordered.Select((item, index) => item.Sequence == index).Any(valid => !valid)
            || ordered.Select((item, index) => index == 0 || item.OffsetMinutes >= ordered[index - 1].OffsetMinutes).Any(valid => !valid))
        {
            return Fail<RouteDto>(PlatformErrors.Validation("Route stop sequence and offsets must be contiguous and increasing.", "stops"));
        }
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

    public async Task<Result<TripPageDto>> ListOperatorTripsAsync(Actor actor, int page, int size, Guid[] tripIds, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
        {
            return Fail<TripPageDto>(error);
        }

        if (page < 0 || tripIds.Length > 100)
            return Fail<TripPageDto>(PlatformErrors.Validation("Trip filters exceed their limits."));

        size = size is < 1 or > 100 ? 20 : size;
        var items = await store.ListOperatorTripsAsync(orgId, page, size, tripIds, cancellationToken);
        var total = await store.CountOperatorTripsAsync(orgId, tripIds, cancellationToken);
        var stops = await GetPageStopsAsync(items, cancellationToken);
        var mapped = items.Select(trip => MapTrip(trip, stops[trip.RouteId]) with
            {
                RouteId = trip.RouteId,
                BusId = trip.BusId,
                DriverId = trip.DriverId
            }).ToArray();

        return Result<TripPageDto>.Success(Page(mapped, page, size, total));
    }

    public async Task<Result<TripPageDto>> SearchScheduleAsync(Actor actor, ScheduleFilter filter, int page, int size, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
            return Fail<TripPageDto>(error);
        if (page < 0 || size is < 1 or > 100 || filter.Statuses.Length > 10 || filter.Periods.Length > 3
            || filter.Assignments.Length > 3 || filter.Origin?.Length > 200 || filter.Destination?.Length > 200
            || filter.Scope is not ("active" or "history" or "all"))
            return Fail<TripPageDto>(PlatformErrors.Validation("Schedule filters or page bounds are invalid."));

        var (items, total) = await store.SearchScheduleAsync(orgId, filter, page, size, cancellationToken);
        var stops = await GetPageStopsAsync(items.Select(item => item.Trip).ToArray(), cancellationToken);
        return Result<TripPageDto>.Success(Page(items.Select(item => MapTrip(item.Trip, stops[item.Trip.RouteId]) with
        {
            RouteId = item.Trip.RouteId,
            BusId = item.Trip.BusId,
            DriverId = item.Trip.DriverId,
            ScheduleStatus = item.ScheduleStatus
        }).ToArray(), page, size, total));
    }

    public async Task<Result<IReadOnlyList<ManifestTripDto>>> ListManifestTripsAsync(Actor actor, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, ReadRoles, out var orgId, out var error))
            return Fail<IReadOnlyList<ManifestTripDto>>(error);

        return Result<IReadOnlyList<ManifestTripDto>>.Success(await store.ListManifestTripsAsync(orgId, cancellationToken));
    }

    public async Task<Result<TripDto>> CreateTripDraftAsync(Actor actor, TripInput input, CancellationToken cancellationToken)
    {
        var prepared = await PrepareTripDraftAsync(actor, input, cancellationToken);
        if (!prepared.IsSuccess) return Fail<TripDto>(prepared.Error!);
        var plan = prepared.Value!;
        await store.InsertTripAsync(plan.Trip, plan.Assignment, cancellationToken);
        return Result<TripDto>.Success(await MapTripAsync(plan.Trip, cancellationToken));
    }

    public async Task<Result<TripAvailabilityDto>> GetAssignmentAvailabilityAsync(Actor actor, TripAvailabilityInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error)) return Fail<TripAvailabilityDto>(error);
        var windows = AssignmentWindows(input);
        if (!windows.IsSuccess) return Fail<TripAvailabilityDto>(windows.Error!);
        return Result<TripAvailabilityDto>.Success(await store.ListAvailableResourcesAsync(orgId, windows.Value!, cancellationToken));
    }

    private static Result<IReadOnlyList<TripWindow>> AssignmentWindows(TripAvailabilityInput input)
    {
        if (input.ArrivalAt <= input.DepartureAt || input.DepartureAt.Year is < 2 or > 9998
            || input.ArrivalAt.Year > 9998)
            return Fail<IReadOnlyList<TripWindow>>(PlatformErrors.Validation("Giờ đến phải sau giờ đi."));
        var first = new TripWindow(input.DepartureAt, input.ArrivalAt);
        if (input.EndDate is null)
            return Result<IReadOnlyList<TripWindow>>.Success([first]);

        var start = DateOnly.FromDateTime(input.DepartureAt.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var end = input.EndDate.Value;
        if (end < start || end > start.AddMonths(3) || input.Weekdays is not { Count: > 0 }
            || input.Weekdays.Any(day => day < 0 || day > 6) || input.DepartureAt <= DateTimeOffset.UtcNow)
            return Fail<IReadOnlyList<TripWindow>>(PlatformErrors.Validation("Chọn giờ khởi hành trong tương lai, ngày kết thúc trong vòng 3 tháng và ít nhất một ngày chạy trong tuần."));
        var windows = new List<TripWindow>();
        for (var date = start; date <= end; date = date.AddDays(1))
        {
            if (!input.Weekdays.Contains((int)date.DayOfWeek)) continue;
            var offset = date.DayNumber - start.DayNumber;
            var window = new TripWindow(first.DepartureAt.AddDays(offset), first.ArrivalAt.AddDays(offset));
            if (windows.Count > 0 && window.Start < windows[^1].End)
                return Fail<IReadOnlyList<TripWindow>>(PlatformErrors.Validation("Các ngày chạy bị trùng nhau khi tính khoảng đệm một giờ trước và sau chuyến. Chọn các ngày cách nhau xa hơn."));
            windows.Add(window);
        }
        return windows.Count > 0 ? Result<IReadOnlyList<TripWindow>>.Success(windows)
            : Fail<IReadOnlyList<TripWindow>>(PlatformErrors.Validation("Không có ngày chạy phù hợp trong khoảng đã chọn."));
    }

    public async Task<Result<IReadOnlyList<TripDto>>> CreateRecurringTripsAsync(Actor actor, RecurringTripInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out _, out var error)) return Fail<IReadOnlyList<TripDto>>(error);
        if (input.Template is null || input.Weekdays is null)
            return Fail<IReadOnlyList<TripDto>>(PlatformErrors.Validation("Thiếu thông tin chuyến hoặc ngày chạy trong tuần."));
        var template = input.Template;
        var windows = AssignmentWindows(new TripAvailabilityInput(template.DepartureAt, template.ArrivalAt, input.EndDate, input.Weekdays));
        if (!windows.IsSuccess) return Fail<IReadOnlyList<TripDto>>(windows.Error!);
        TripDraftPlan? source = null;
        if (input.SourceTripId is { } sourceId)
        {
            var existing = await store.GetTripAsync(sourceId, cancellationToken);
            if (existing is null || existing.OrganizationId != actor.OrganizationId)
                return Fail<IReadOnlyList<TripDto>>(PlatformErrors.NotFound());
            if (existing.Status != TripStatuses.Draft)
                return Fail<IReadOnlyList<TripDto>>(PlatformErrors.Validation("Chỉ có thể thiết lập lịch lặp từ bản nháp."));
            if (existing.RowVersion != template.ExpectedVersion)
                return Fail<IReadOnlyList<TripDto>>(PlatformErrors.VersionConflict());
            var preparedSource = await PrepareTripDraftAsync(actor, template, cancellationToken);
            if (!preparedSource.IsSuccess) return Fail<IReadOnlyList<TripDto>>(preparedSource.Error!);
            var plan = preparedSource.Value!;
            source = new TripDraftPlan(plan.Trip with { Id = existing.Id, RowVersion = existing.RowVersion + 1 }, plan.Assignment with { TripId = existing.Id });
        }
        var plans = new List<TripDraftPlan>();
        foreach (var window in windows.Value!)
        {
            var occurrence = template with { DepartureAt = window.DepartureAt, ArrivalAt = window.ArrivalAt };
            TripDraftPlan plan;
            if (plans.Count == 0)
            {
                var prepared = await PrepareTripDraftAsync(actor, occurrence, cancellationToken);
                if (!prepared.IsSuccess) return Fail<IReadOnlyList<TripDto>>(prepared.Error!);
                plan = prepared.Value!;
            }
            else
            {
                var first = plans[0];
                var trip = first.Trip with { Id = ids.NewUuidV7(), RowVersion = 0, DepartureAt = occurrence.DepartureAt, ArrivalAt = occurrence.ArrivalAt };
                var assignment = first.Assignment with { Id = ids.NewUuidV7(), TripId = trip.Id, Start = window.Start, End = window.End };
                plan = new TripDraftPlan(trip, assignment);
            }
            if (window.DepartureAt == template.DepartureAt && source is not null) plan = source;
            plans.Add(plan);
        }
        // The latest arrival determines licence validity for every occurrence.
        if (plans.Count > 1)
        {
            var last = plans[^1].Trip;
            var checkedLast = await PrepareTripDraftAsync(actor, template with { DepartureAt = last.DepartureAt, ArrivalAt = last.ArrivalAt }, cancellationToken);
            if (!checkedLast.IsSuccess) return Fail<IReadOnlyList<TripDto>>(checkedLast.Error!);
        }
        try
        {
            await store.InsertTripsAsync(plans.Where(plan => plan.Trip.Id != input.SourceTripId).ToArray(), cancellationToken, source);
        }
        catch (InvalidOperationException exception) when (exception.Message == "VERSION_CONFLICT")
        {
            return Fail<IReadOnlyList<TripDto>>(PlatformErrors.VersionConflict());
        }
        var firstTrip = await MapTripAsync(plans[0].Trip, cancellationToken);
        var trips = plans.Select(plan => firstTrip with {
            Id = plan.Trip.Id,
            RowVersion = plan.Trip.RowVersion,
            DepartureAt = plan.Trip.DepartureAt,
            ArrivalAt = plan.Trip.ArrivalAt,
            RouteId = plan.Trip.RouteId,
            BusId = plan.Trip.BusId,
            DriverId = plan.Trip.DriverId
        }).ToArray();
        return Result<IReadOnlyList<TripDto>>.Success(trips);
    }

    private async Task<Result<TripDraftPlan>> PrepareTripDraftAsync(Actor actor, TripInput input, CancellationToken cancellationToken)
    {
        if (!TryTenant(actor, FleetRoles, out var orgId, out var error))
        {
            return Fail<TripDraftPlan>(error);
        }

        if (input.Fare.Currency != "VND" || input.PolicyVersion != "cancel-mvp-v1" || input.ArrivalAt <= input.DepartureAt)
        {
            return Fail<TripDraftPlan>(PlatformErrors.Validation("Trip input is invalid."));
        }

        var route = await store.GetRouteAsync(orgId, input.RouteId, cancellationToken);
        var bus = await store.GetBusAsync(orgId, input.BusId, cancellationToken);
        var driver = await store.GetDriverAsync(orgId, input.DriverId, cancellationToken);
        var tripServiceDate = DateOnly.FromDateTime(input.ArrivalAt.UtcDateTime);
        if (route is null
            || bus is null
            || driver is null
            || route.Status != "ACTIVE"
            || bus.Status != "ACTIVE"
            || driver.Status != "ACTIVE"
            || driver.LicenseExpiresOn < tripServiceDate)
        {
            return Fail<TripDraftPlan>(PlatformErrors.Validation("Route, bus or driver is not usable."));
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
        return Result<TripDraftPlan>.Success(new TripDraftPlan(trip, assignment));
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

        if (input.Fare.Currency != "VND" || input.PolicyVersion != "cancel-mvp-v1" || input.ArrivalAt <= input.DepartureAt)
        {
            return Fail<TripDto>(PlatformErrors.Validation("Trip input is invalid."));
        }

        var route = await store.GetRouteAsync(orgId, input.RouteId, cancellationToken);
        var bus = await store.GetBusAsync(orgId, input.BusId, cancellationToken);
        var driver = await store.GetDriverAsync(orgId, input.DriverId, cancellationToken);
        var tripServiceDate = DateOnly.FromDateTime(input.ArrivalAt.UtcDateTime);
        if (route is null
            || bus is null
            || driver is null
            || route.Status != "ACTIVE"
            || bus.Status != "ACTIVE"
            || driver.Status != "ACTIVE"
            || driver.LicenseExpiresOn < tripServiceDate)
        {
            return Fail<TripDto>(PlatformErrors.Validation("Route, bus or driver is not usable."));
        }

        var updated = trip with
        {
            RouteId = input.RouteId,
            BusId = input.BusId,
            DriverId = input.DriverId,
            OriginStopId = route.OriginStopId,
            DestinationStopId = route.DestinationStopId,
            Origin = route.OriginName,
            Destination = route.DestinationName,
            DepartureAt = input.DepartureAt,
            ArrivalAt = input.ArrivalAt,
            BaseFare = input.Fare.Amount,
            PolicyVersion = input.PolicyVersion,
            BusType = bus.Type,
            Amenities = bus.Amenities,
            SeatCount = bus.SeatCount,
            RowVersion = trip.RowVersion + 1
        };
        var assignment = new DriverAssignmentRecord(
            ids.NewUuidV7(),
            tripId,
            driver.Id,
            "PRIMARY",
            input.DepartureAt.AddHours(-1),
            input.ArrivalAt.AddHours(1),
            actor.UserId);
        await store.UpdateTripDraftAsync(updated, assignment, cancellationToken);
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
        var driver = trip.DriverId is { } driverId ? await store.GetDriverAsync(orgId, driverId, cancellationToken) : null;
        if (route is null || route.Status != "ACTIVE" || bus is null || bus.Status != "ACTIVE"
            || !bus.Seats.Any(seat => seat.Active) || driver is null || driver.Status != "ACTIVE"
            || driver.LicenseExpiresOn < DateOnly.FromDateTime(trip.ArrivalAt.UtcDateTime))
            return Fail<OperationAccepted>(PlatformErrors.Validation("Tuyến, xe hoặc tài xế không còn đủ điều kiện phát hành."));
        var published = trip with
        {
            Status = TripStatuses.Scheduled,
            PublishedVersion = 1,
            RouteSnapshot = JsonSerializer.Serialize(new { route.Id, route.Name, route.Stops }),
            BusSnapshot = JsonSerializer.Serialize(new
            {
                bus.Id,
                bus.Type,
                bus.Amenities,
                seats = bus.Seats.Select(seat => new { seat.Id, seat.Code, seat.Deck, row = seat.Row, column = seat.Column, seat.Type, seat.Active })
            }),
            FareSnapshot = JsonSerializer.Serialize(new { baseFare = trip.BaseFare, trip.Currency, policyVersion = trip.PolicyVersion, allowPayLater = (await store.GetOrganizationAsync(orgId, cancellationToken))!.AllowPayLater }),
            RowVersion = trip.RowVersion + 1
        };
        try
        {
            await store.PublishTripAsync(published, cancellationToken);
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

        var driverOnly = actor.Has(Roles.Driver) && !actor.Has(Roles.OperatorAdmin, Roles.OperatorOperations);
        if (driverOnly && !await store.IsDriverAssignedToTripAsync(actor.UserId, tripId, cancellationToken))
        {
            return Fail<TripDto>(PlatformErrors.AccessDenied());
        }

        if (!IsAllowedTransition(trip.Status, request.TargetStatus))
        {
            return Fail<TripDto>(PlatformErrors.InvalidStateTransition());
        }

        var sellable = request.TargetStatus is TripStatuses.Scheduled or TripStatuses.Boarding && trip.Sellable;
        var updated = trip with { Status = request.TargetStatus, Sellable = sellable, RowVersion = trip.RowVersion + 1 };
        await store.UpdateTripAsync(updated, cancellationToken);
        await events.TripStatusChangedAsync(updated, correlationId, cancellationToken);
        return Result<TripDto>.Success(await MapTripAsync(updated, cancellationToken));
    }

    public Task<IReadOnlyList<ExploreRouteDto>> ListExploreRoutesAsync(CancellationToken cancellationToken) =>
        store.ListExploreRoutesAsync(cancellationToken);

    public async Task<Result<TripCardsDto>> SearchTripCardsAsync(TripSearchQuery query, CancellationToken cancellationToken)
    {
        if (query.PassengerCount is < 1 or > 10 || !IsSearchSortAllowed(query.Sort))
            return Fail<TripCardsDto>(PlatformErrors.Validation("Search query is invalid."));

        var items = await store.SearchTripCardsAsync(query, cancellationToken);
        var stops = await store.GetRouteStopsForTripsAsync(items.Select(trip => trip.RouteId).Distinct().ToArray(), cancellationToken);
        return Result<TripCardsDto>.Success(new TripCardsDto(items, stops.ToDictionary(route => route.Key, route => route.ToArray())));
    }

    private static bool IsSearchSortAllowed(string? sort) =>
        string.IsNullOrWhiteSpace(sort) || sort is "PRICE_ASC" or "PRICE_DESC" or "DEPARTURE_ASC" or "DEPARTURE_DESC" or "DURATION_ASC" or "DURATION_DESC";

    public async Task<Result<TripPageDto>> SearchAsync(TripSearchQuery query, CancellationToken cancellationToken)
    {
        if (query.PassengerCount is < 1 or > 10
            || query.Page < 0
            || query.Size > 100)
        {
            return Fail<TripPageDto>(PlatformErrors.Validation("Search query is invalid."));
        }

        if (!IsSearchSortAllowed(query.Sort))
        {
            return Fail<TripPageDto>(PlatformErrors.Validation("Sort is not allowed.", "sort"));
        }

        query = query with { Size = query.Size <= 0 ? 20 : query.Size };
        var (items, total) = await store.SearchSellableAsync(query, cancellationToken);
        var stops = await GetPageStopsAsync(items, cancellationToken);
        var mapped = items.Select(trip => MapTrip(trip, stops[trip.RouteId])).ToArray();

        return Result<TripPageDto>.Success(Page(mapped, query.Page, query.Size, total));
    }

    public async Task<Result<TripDto>> GetPublicTripAsync(Guid tripId, CancellationToken cancellationToken)
    {
        var trip = await store.GetTripAsync(tripId, cancellationToken);
        return trip is null ? Fail<TripDto>(PlatformErrors.NotFound()) : Result<TripDto>.Success(await MapTripAsync(trip, cancellationToken));
    }

    public async Task<IReadOnlyList<TripDto>> GetPublicTripsAsync(Guid[] tripIds, CancellationToken cancellationToken)
    {
        var trips = await store.ListTripsByIdsAsync(tripIds, cancellationToken);
        var stops = await GetPageStopsAsync(trips, cancellationToken);
        return trips.Select(trip => MapTrip(trip, stops[trip.RouteId])).ToArray();
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

    private Task<ILookup<Guid, TripStopDto>> GetPageStopsAsync(IReadOnlyList<TripRecord> trips, CancellationToken cancellationToken) =>
        store.GetRouteStopsForTripsAsync(trips.Select(trip => trip.RouteId).Distinct().ToArray(), cancellationToken);

    private async Task<TripDto> MapTripAsync(TripRecord trip, CancellationToken cancellationToken) =>
        MapTrip(trip, await store.GetTripStopsAsync(trip.Id, cancellationToken));

    private static TripDto MapTrip(TripRecord trip, IEnumerable<TripStopDto> stops)
    {
        var allowPayLater = false;
        if (!string.IsNullOrWhiteSpace(trip.FareSnapshot))
        {
            using var fare = JsonDocument.Parse(trip.FareSnapshot);
            allowPayLater = fare.RootElement.TryGetProperty("allowPayLater", out var allowed)
                && allowed.ValueKind == JsonValueKind.True;
        }
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
            stops.ToArray(),
            trip.RowVersion) { AllowPayLater = allowPayLater };
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
