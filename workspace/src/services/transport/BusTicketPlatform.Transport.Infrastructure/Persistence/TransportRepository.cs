using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.Transport.Application;
using Npgsql;

namespace BusTicketPlatform.Transport.Infrastructure.Persistence;

public sealed class TransportRepository(TransportDatabaseOptions options, IIdGenerator ids) : ITransportRepository
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    // Public catalogue contains only published, sellable route endpoints, never customer records.
    public async Task<IReadOnlyList<ExploreRouteDto>> ListExploreRoutesAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT source.name, destination.name, COUNT(*)::integer, COUNT(DISTINCT t.organization_id)::integer
            FROM trips t
            JOIN stops source ON source.id = t.origin_stop_id
            JOIN stops destination ON destination.id = t.destination_stop_id
            WHERE t.sellable = TRUE AND t.status IN ('SCHEDULED', 'BOARDING') AND t.departure_at >= NOW()
            GROUP BY source.name, destination.name
            ORDER BY source.name, destination.name
            LIMIT 500;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<ExploreRouteDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new ExploreRouteDto(reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3)));
        }
        return results;
    }

    public Task<OrganizationRecord?> GetOrganizationAsync(Guid id, CancellationToken cancellationToken) =>
        QuerySingleAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, code, name, support_email, support_phone, status, allow_pay_later, commission_rate, row_version
                FROM organizations WHERE id = @id;
                """;
            cmd.Parameters.AddWithValue("id", id);
        }, ReadOrg, cancellationToken);

    public Task<IReadOnlyList<OrganizationRecord>> ListOrganizationsAsync(CancellationToken cancellationToken) =>
        QueryListAsync(cmd =>
        {
            cmd.CommandText = """
                SELECT id, code, name, support_email, support_phone, status, allow_pay_later, commission_rate, row_version
                FROM organizations ORDER BY name;
                """;
            return Task.CompletedTask;
        }, ReadOrg, cancellationToken);

    public async Task InsertOrganizationAsync(OrganizationRecord org, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO organizations (
              id, code, name, support_email, support_phone, status, allow_pay_later, commission_rate, created_at, updated_at)
            VALUES (@id, @code, @name, @email, @phone, @status, @payLater, @rate, NOW(), NOW());
            """, connection);
        command.Parameters.AddWithValue("id", org.Id);
        command.Parameters.AddWithValue("code", org.Code);
        command.Parameters.AddWithValue("name", org.Name);
        command.Parameters.AddWithValue("email", (object?)org.ContactEmail ?? DBNull.Value);
        command.Parameters.AddWithValue("phone", (object?)org.ContactPhone ?? DBNull.Value);
        command.Parameters.AddWithValue("status", org.Status);
        command.Parameters.AddWithValue("payLater", org.AllowPayLater);
        command.Parameters.AddWithValue("rate", org.CommissionRate);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateOrganizationAsync(OrganizationRecord org, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE organizations
            SET name = @name, support_email = @email, support_phone = @phone, allow_pay_later = @payLater,
                row_version = @version, updated_at = NOW()
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", org.Id);
        command.Parameters.AddWithValue("name", org.Name);
        command.Parameters.AddWithValue("email", (object?)org.ContactEmail ?? DBNull.Value);
        command.Parameters.AddWithValue("phone", (object?)org.ContactPhone ?? DBNull.Value);
        command.Parameters.AddWithValue("payLater", org.AllowPayLater);
        command.Parameters.AddWithValue("version", org.RowVersion);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<BusRecord>> ListBusesAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var buses = await QueryListAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, organization_id, plate_number, normalized_plate_number, display_name, bus_type, amenities::text,
                       seat_count, status, row_version
                FROM buses WHERE organization_id = @org AND deleted_at IS NULL
                ORDER BY display_name;
                """;
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadBus, cancellationToken);
        var result = new List<BusRecord>();
        foreach (var bus in buses)
        {
            result.Add(bus with { Seats = await ListSeatsAsync(bus.Id, cancellationToken) });
        }

        return result;
    }

    public async Task<BusRecord?> GetBusAsync(Guid organizationId, Guid busId, CancellationToken cancellationToken)
    {
        var bus = await QuerySingleAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, organization_id, plate_number, normalized_plate_number, display_name, bus_type, amenities::text,
                       seat_count, status, row_version
                FROM buses WHERE id = @id AND organization_id = @org AND deleted_at IS NULL;
                """;
            cmd.Parameters.AddWithValue("id", busId);
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadBus, cancellationToken);
        return bus is null ? null : bus with { Seats = await ListSeatsAsync(bus.Id, cancellationToken) };
    }

    public async Task InsertBusAsync(BusRecord bus, IReadOnlyList<SeatRecord> seats, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var command = new NpgsqlCommand("""
            INSERT INTO buses (
              id, organization_id, plate_number, normalized_plate_number, display_name, bus_type, amenities, seat_count,
              status, created_at, updated_at)
            VALUES (@id, @org, @plate, @norm, @name, @type, CAST(@amenities AS jsonb), @seats, @status, NOW(), NOW());
            """, connection, tx))
        {
            BindBus(command, bus);
            try
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            catch (PostgresException exception) when (exception.SqlState == "23505")
            {
                throw new InvalidOperationException("DUPLICATE_BUS_PLATE", exception);
            }
        }

        foreach (var seat in seats)
        {
            await InsertSeatAsync(connection, tx, seat, cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task UpdateBusAsync(BusRecord bus, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE buses
            SET plate_number = @plate, normalized_plate_number = @norm, display_name = @name, bus_type = @type,
                amenities = CAST(@amenities AS jsonb), status = @status, row_version = @version, updated_at = NOW(),
                deleted_at = CASE WHEN @status = 'INACTIVE' THEN NOW() ELSE deleted_at END
            WHERE id = @id;
            """, connection);
        BindBus(command, bus);
        command.Parameters.AddWithValue("version", bus.RowVersion);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> SetSeatPermissionAsync(Guid organizationId, Guid busId, string code, bool enabled, long expectedVersion, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using var version = new NpgsqlCommand("UPDATE buses SET row_version = row_version + 1, updated_at = NOW() WHERE id = @id AND organization_id = @org AND row_version = @version AND deleted_at IS NULL", connection, tx);
        version.Parameters.AddWithValue("id", busId);
        version.Parameters.AddWithValue("org", organizationId);
        version.Parameters.AddWithValue("version", expectedVersion);
        if (await version.ExecuteNonQueryAsync(cancellationToken) != 1) return false;
        await using var seat = new NpgsqlCommand("UPDATE seats SET active = @enabled, updated_at = NOW(), row_version = row_version + 1 WHERE bus_id = @id AND code = @code", connection, tx);
        seat.Parameters.AddWithValue("id", busId);
        seat.Parameters.AddWithValue("code", code);
        seat.Parameters.AddWithValue("enabled", enabled);
        if (await seat.ExecuteNonQueryAsync(cancellationToken) != 1) return false;
        await tx.CommitAsync(cancellationToken);
        return true;
    }

    public async Task ReplaceSeatsAsync(Guid busId, IReadOnlyList<SeatRecord> seats, int seatCount, long rowVersion, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var delete = new NpgsqlCommand("DELETE FROM seats WHERE bus_id = @id;", connection, tx))
        {
            delete.Parameters.AddWithValue("id", busId);
            await delete.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var seat in seats)
        {
            await InsertSeatAsync(connection, tx, seat, cancellationToken);
        }

        await using (var update = new NpgsqlCommand("""
            UPDATE buses SET seat_count = @count, row_version = @version, updated_at = NOW() WHERE id = @id;
            """, connection, tx))
        {
            update.Parameters.AddWithValue("count", seatCount);
            update.Parameters.AddWithValue("version", rowVersion);
            update.Parameters.AddWithValue("id", busId);
            await update.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task<bool> BusHasActiveTripsAsync(Guid busId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT 1 FROM trips
            WHERE bus_id = @id AND status NOT IN ('DRAFT','CANCELLED','COMPLETED')
            LIMIT 1;
            """, connection);
        command.Parameters.AddWithValue("id", busId);
        return await command.ExecuteScalarAsync(cancellationToken) is not null;
    }

    public Task<IReadOnlyList<DriverRecord>> ListDriversAsync(Guid organizationId, CancellationToken cancellationToken) =>
        QueryListAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, organization_id, user_id_external, employee_code, license_number, license_expires_on, status, row_version
                FROM driver_profiles WHERE organization_id = @org AND (deleted_at IS NULL OR status = 'INACTIVE')
                ORDER BY employee_code;
                """;
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadDriver, cancellationToken);

    public Task<DriverRecord?> GetDriverAsync(Guid organizationId, Guid driverId, CancellationToken cancellationToken) =>
        QuerySingleAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, organization_id, user_id_external, employee_code, license_number, license_expires_on, status, row_version
                FROM driver_profiles WHERE id = @id AND organization_id = @org AND (deleted_at IS NULL OR status = 'INACTIVE');
                """;
            cmd.Parameters.AddWithValue("id", driverId);
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadDriver, cancellationToken);

    public async Task<bool> DeleteDriverAsync(Guid organizationId, Guid driverId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE driver_profiles d SET status = 'SUSPENDED', deleted_at = NOW(), updated_at = NOW(), row_version = row_version + 1
            WHERE d.id = @id AND d.organization_id = @org
              AND (d.deleted_at IS NULL OR d.status = 'INACTIVE')
              AND NOT EXISTS (
                SELECT 1 FROM driver_assignments a JOIN trips t ON t.id = a.trip_id
                WHERE a.driver_profile_id = d.id
                  AND t.status NOT IN ('COMPLETED', 'CANCELLED')
              );
            """, connection, transaction);
        command.Parameters.AddWithValue("id", driverId);
        command.Parameters.AddWithValue("org", organizationId);
        var changed = await command.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return changed == 1;
    }

    public async Task InsertDriverAsync(DriverRecord driver, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO driver_profiles (
              id, organization_id, user_id_external, employee_code, license_number, license_expires_on, status,
              created_at, updated_at)
            VALUES (@id, @org, @user, @emp, @license, @expires, @status, NOW(), NOW());
            """, connection);
        BindDriver(command, driver);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateDriverAsync(DriverRecord driver, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE driver_profiles
            SET user_id_external = @user, license_number = @license, license_expires_on = @expires, status = @status,
                row_version = @version, updated_at = NOW(),
                deleted_at = NULL
            WHERE id = @id;
            """, connection);
        BindDriver(command, driver);
        command.Parameters.AddWithValue("version", driver.RowVersion);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RouteRecord>> ListRoutesAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var routes = await QueryListAsync(async cmd =>
        {
            cmd.CommandText = RouteSelect + " WHERE r.organization_id = @org ORDER BY r.name;";
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadRoute, cancellationToken);
        var result = new List<RouteRecord>();
        foreach (var route in routes)
        {
            result.Add(route with { Stops = await ListRouteStopsAsync(route.Id, cancellationToken) });
        }

        return result;
    }

    public async Task<RouteRecord?> GetRouteAsync(Guid organizationId, Guid routeId, CancellationToken cancellationToken)
    {
        var route = await QuerySingleAsync(async cmd =>
        {
            cmd.CommandText = RouteSelect + " WHERE r.id = @id AND r.organization_id = @org;";
            cmd.Parameters.AddWithValue("id", routeId);
            cmd.Parameters.AddWithValue("org", organizationId);
        }, ReadRoute, cancellationToken);
        return route is null ? null : route with { Stops = await ListRouteStopsAsync(route.Id, cancellationToken) };
    }

    public async Task InsertRouteAsync(RouteRecord route, IReadOnlyList<RouteStopRecord> stops, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = await OpenAsync(cancellationToken);
            await using var tx = await connection.BeginTransactionAsync(cancellationToken);
            await using (var command = new NpgsqlCommand("""
                INSERT INTO routes (
                  id, organization_id, code, name, origin_stop_id, destination_stop_id, default_duration_minutes, distance_km,
                  status, created_at, updated_at)
                VALUES (@id, @org, @code, @name, @origin, @dest, @duration, @distance, @status, NOW(), NOW());
                """, connection, tx))
            {
                BindRoute(command, route);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            foreach (var stop in stops)
            {
                await InsertRouteStopAsync(connection, tx, stop, cancellationToken);
            }

            await tx.CommitAsync(cancellationToken);
        }
        catch (PostgresException exception)
        {
            throw new InvalidOperationException($"InsertRoute failed ({exception.SqlState}): {exception.MessageText}", exception);
        }
    }

    public async Task UpdateRouteAsync(RouteRecord route, IReadOnlyList<RouteStopRecord>? stops, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var command = new NpgsqlCommand("""
            UPDATE routes
            SET name = @name, origin_stop_id = @origin, destination_stop_id = @dest, default_duration_minutes = @duration,
                distance_km = @distance, status = @status, row_version = @version, updated_at = NOW()
            WHERE id = @id;
            """, connection, tx))
        {
            BindRoute(command, route);
            command.Parameters.AddWithValue("version", route.RowVersion);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        if (stops is not null)
        {
            await using var delete = new NpgsqlCommand("DELETE FROM route_stops WHERE route_id = @id;", connection, tx);
            delete.Parameters.AddWithValue("id", route.Id);
            await delete.ExecuteNonQueryAsync(cancellationToken);
            foreach (var stop in stops)
            {
                await InsertRouteStopAsync(connection, tx, stop, cancellationToken);
            }
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task<StopRecord> UpsertStopAsync(Guid organizationId, string name, string? address, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using (var existing = new NpgsqlCommand("""
            SELECT id, organization_id, name, address, province_code
            FROM stops WHERE organization_id = @org AND lower(name) = lower(@name)
            LIMIT 1;
            """, connection))
        {
            existing.Parameters.AddWithValue("org", organizationId);
            existing.Parameters.AddWithValue("name", name);
            await using var reader = await existing.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                return new StopRecord(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetString(4));
            }
        }

        var stop = new StopRecord(ids.NewUuidV7(), organizationId, name.Trim(), address ?? name.Trim(), "NA");
        await using var insert = new NpgsqlCommand("""
            INSERT INTO stops (id, organization_id, code, name, address, province_code, status, created_at, updated_at)
            VALUES (@id, @org, @code, @name, @address, @province, 'ACTIVE', NOW(), NOW());
            """, connection);
        insert.Parameters.AddWithValue("id", stop.Id);
        insert.Parameters.AddWithValue("org", organizationId);
        insert.Parameters.AddWithValue("code", "ST-" + stop.Id.ToString("N")[^12..].ToUpperInvariant());
        insert.Parameters.AddWithValue("name", stop.Name);
        insert.Parameters.AddWithValue("address", stop.Address);
        insert.Parameters.AddWithValue("province", stop.ProvinceCode);
        await insert.ExecuteNonQueryAsync(cancellationToken);
        return stop;
    }

    public Task InsertTripAsync(TripRecord trip, DriverAssignmentRecord assignment, CancellationToken cancellationToken) =>
        InsertTripsAsync([new TripDraftPlan(trip, assignment)], cancellationToken);

    public async Task InsertTripsAsync(IReadOnlyList<TripDraftPlan> plans, CancellationToken cancellationToken, TripDraftPlan? source = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        if (source is not null)
        {
            var trip = source.Trip;
            var assignment = source.Assignment;
            await using (var command = new NpgsqlCommand("""
                UPDATE trips
                SET route_id = @route, bus_id = @bus, origin_stop_id = @origin, destination_stop_id = @dest,
                    departure_at = @dep, arrival_at = @arr, operating_window = tstzrange(@winStart, @winEnd, '[)'),
                    base_fare = @fare, status = @status, sellable = @sellable, row_version = @version, updated_at = NOW()
                WHERE id = @id AND status = 'DRAFT' AND row_version = @expected;
                """, connection, tx))
            {
                BindTripCore(command, trip);
                command.Parameters.AddWithValue("version", trip.RowVersion);
                command.Parameters.AddWithValue("expected", trip.RowVersion - 1);
                if (await command.ExecuteNonQueryAsync(cancellationToken) != 1) throw new InvalidOperationException("VERSION_CONFLICT");
            }

            await using (var updateAssignment = new NpgsqlCommand("""
                UPDATE driver_assignments
                SET driver_profile_id = @driver,
                    assignment_window = tstzrange(@start, @end, '[)'),
                    assigned_by_external = @by,
                    row_version = row_version + 1
                WHERE trip_id = @trip AND assignment_role = 'PRIMARY' AND active = false;
                """, connection, tx))
            {
                updateAssignment.Parameters.AddWithValue("driver", assignment.DriverProfileId);
                updateAssignment.Parameters.AddWithValue("start", assignment.Start.UtcDateTime);
                updateAssignment.Parameters.AddWithValue("end", assignment.End.UtcDateTime);
                updateAssignment.Parameters.AddWithValue("by", assignment.AssignedBy);
                updateAssignment.Parameters.AddWithValue("trip", trip.Id);
                await updateAssignment.ExecuteNonQueryAsync(cancellationToken);
            }

        }
        foreach (var plan in plans)
        {
            var trip = plan.Trip;
            var assignment = plan.Assignment;
            await using (var command = new NpgsqlCommand("""
                INSERT INTO trips (
                  id, organization_id, route_id, bus_id, origin_stop_id, destination_stop_id, departure_at, arrival_at,
                  operating_window, base_fare, currency, status, sellable, created_at, updated_at)
                VALUES (
                  @id, @org, @route, @bus, @origin, @dest, @dep, @arr,
                  tstzrange(@winStart, @winEnd, '[)'), @fare, @currency, @status, @sellable, NOW(), NOW());
                """, connection, tx))
            {
                BindTripCore(command, trip);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var assign = new NpgsqlCommand("""
                INSERT INTO driver_assignments (
                  id, trip_id, driver_profile_id, assignment_role, assignment_window, active, assigned_by_external, created_at)
                VALUES (@id, @trip, @driver, @role, tstzrange(@start, @end, '[)'), false, @by, NOW());
                """, connection, tx))
            {
                assign.Parameters.AddWithValue("id", assignment.Id);
                assign.Parameters.AddWithValue("trip", assignment.TripId);
                assign.Parameters.AddWithValue("driver", assignment.DriverProfileId);
                assign.Parameters.AddWithValue("role", assignment.Role);
                assign.Parameters.AddWithValue("start", assignment.Start.UtcDateTime);
                assign.Parameters.AddWithValue("end", assignment.End.UtcDateTime);
                assign.Parameters.AddWithValue("by", assignment.AssignedBy);
                await assign.ExecuteNonQueryAsync(cancellationToken);
            }

        }
        await tx.CommitAsync(cancellationToken);
    }

    public async Task UpdateTripDraftAsync(
        TripRecord trip,
        DriverAssignmentRecord assignment,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var command = new NpgsqlCommand("""
            UPDATE trips
            SET route_id = @route, bus_id = @bus, origin_stop_id = @origin, destination_stop_id = @dest,
                departure_at = @dep, arrival_at = @arr, operating_window = tstzrange(@winStart, @winEnd, '[)'),
                base_fare = @fare, status = @status, sellable = @sellable, row_version = @version, updated_at = NOW()
            WHERE id = @id AND status = 'DRAFT';
            """, connection, tx))
        {
            BindTripCore(command, trip);
            command.Parameters.AddWithValue("version", trip.RowVersion);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var updateAssignment = new NpgsqlCommand("""
            UPDATE driver_assignments
            SET driver_profile_id = @driver,
                assignment_window = tstzrange(@start, @end, '[)'),
                assigned_by_external = @by,
                row_version = row_version + 1
            WHERE trip_id = @trip AND assignment_role = 'PRIMARY' AND active = false;
            """, connection, tx))
        {
            updateAssignment.Parameters.AddWithValue("driver", assignment.DriverProfileId);
            updateAssignment.Parameters.AddWithValue("start", assignment.Start.UtcDateTime);
            updateAssignment.Parameters.AddWithValue("end", assignment.End.UtcDateTime);
            updateAssignment.Parameters.AddWithValue("by", assignment.AssignedBy);
            updateAssignment.Parameters.AddWithValue("trip", trip.Id);
            await updateAssignment.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task PublishTripAsync(TripRecord trip, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = await OpenAsync(cancellationToken);
            await using var tx = await connection.BeginTransactionAsync(cancellationToken);
            await using (var command = new NpgsqlCommand("""
                UPDATE trips
                SET route_id = @route, bus_id = @bus, origin_stop_id = @origin, destination_stop_id = @dest,
                    departure_at = @dep, arrival_at = @arr, operating_window = tstzrange(@winStart, @winEnd, '[)'),
                    base_fare = @fare, status = @status, sellable = @sellable, published_version = @published,
                    route_snapshot = CAST(@routeSnap AS jsonb), bus_snapshot = CAST(@busSnap AS jsonb),
                    fare_policy_snapshot = CAST(@fareSnap AS jsonb), row_version = @version, updated_at = NOW()
                WHERE id = @id;
                """, connection, tx))
            {
                BindTripCore(command, trip);
                command.Parameters.Add(new NpgsqlParameter("published", NpgsqlTypes.NpgsqlDbType.Bigint) { Value = (object?)trip.PublishedVersion ?? DBNull.Value });
                command.Parameters.AddWithValue("routeSnap", (object?)trip.RouteSnapshot ?? DBNull.Value);
                command.Parameters.AddWithValue("busSnap", (object?)trip.BusSnapshot ?? DBNull.Value);
                command.Parameters.AddWithValue("fareSnap", (object?)trip.FareSnapshot ?? DBNull.Value);
                command.Parameters.AddWithValue("version", trip.RowVersion);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var assignment = new NpgsqlCommand("""
                UPDATE driver_assignments
                SET active = true, row_version = row_version + 1
                WHERE trip_id = @trip AND assignment_role = 'PRIMARY';
                """, connection, tx))
            {
                assignment.Parameters.AddWithValue("trip", trip.Id);
                await assignment.ExecuteNonQueryAsync(cancellationToken);
            }

            await tx.CommitAsync(cancellationToken);
        }
        catch (PostgresException exception) when (exception.SqlState is "23P01" or "23505")
        {
            throw new InvalidOperationException("SCHEDULE_CONFLICT", exception);
        }
    }

    public async Task<bool> UpdateTripAsync(TripRecord trip, long expectedVersion, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = await OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("""
                UPDATE trips
                SET route_id = @route, bus_id = @bus, origin_stop_id = @origin, destination_stop_id = @dest,
                    departure_at = @dep, arrival_at = @arr, operating_window = tstzrange(@winStart, @winEnd, '[)'),
                    base_fare = @fare, status = @status, sellable = @sellable, published_version = @published,
                    route_snapshot = CAST(@routeSnap AS jsonb), bus_snapshot = CAST(@busSnap AS jsonb),
                    fare_policy_snapshot = CAST(@fareSnap AS jsonb), row_version = @version, updated_at = NOW()
                WHERE id = @id AND row_version = @expectedVersion;
                """, connection);
            BindTripCore(command, trip);
            command.Parameters.Add(new NpgsqlParameter("published", NpgsqlTypes.NpgsqlDbType.Bigint) { Value = (object?)trip.PublishedVersion ?? DBNull.Value });
            command.Parameters.AddWithValue("routeSnap", (object?)trip.RouteSnapshot ?? DBNull.Value);
            command.Parameters.AddWithValue("busSnap", (object?)trip.BusSnapshot ?? DBNull.Value);
            command.Parameters.AddWithValue("fareSnap", (object?)trip.FareSnapshot ?? DBNull.Value);
            command.Parameters.AddWithValue("version", trip.RowVersion);
            command.Parameters.AddWithValue("expectedVersion", expectedVersion);
            return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
        }
        catch (PostgresException exception) when (exception.SqlState is "23P01" or "23505")
        {
            throw new InvalidOperationException("SCHEDULE_CONFLICT", exception);
        }
        catch (PostgresException exception)
        {
            throw new InvalidOperationException($"UpdateTrip failed ({exception.SqlState}): {exception.MessageText}", exception);
        }
    }

    public Task<TripRecord?> GetTripAsync(Guid tripId, CancellationToken cancellationToken) =>
        QuerySingleAsync(async cmd =>
        {
            cmd.CommandText = TripSelect + " WHERE t.id = @id;";
            cmd.Parameters.AddWithValue("id", tripId);
        }, ReadTrip, cancellationToken);

    public Task<IReadOnlyList<TripRecord>> ListTripsByIdsAsync(Guid[] tripIds, CancellationToken cancellationToken) =>
        QueryListAsync(async cmd =>
        {
            cmd.CommandText = TripProjection + ", NULL::uuid " + TripBaseSource + " WHERE t.id = ANY(@ids);";
            cmd.Parameters.AddWithValue("ids", tripIds);
        }, ReadTrip, cancellationToken);

    public Task<IReadOnlyList<TripRecord>> ListOperatorTripsAsync(Guid organizationId, int page, int size, Guid[] tripIds, CancellationToken cancellationToken) =>
        QueryListAsync(async cmd =>
        {
            cmd.CommandText = TripSelect + " WHERE t.organization_id = @org AND (cardinality(@ids) = 0 OR t.id = ANY(@ids)) ORDER BY t.departure_at DESC, t.id DESC OFFSET @offset LIMIT @limit;";
            cmd.Parameters.AddWithValue("org", organizationId);
            cmd.Parameters.AddWithValue("ids", tripIds);
            cmd.Parameters.AddWithValue("offset", (long)page * size);
            cmd.Parameters.AddWithValue("limit", size);
        }, ReadTrip, cancellationToken);

    public Task<IReadOnlyList<ManifestTripDto>> ListManifestTripsAsync(Guid organizationId, CancellationToken cancellationToken) =>
        QueryListAsync(async cmd =>
        {
            cmd.CommandText = $"""
                SELECT t.id, t.bus_id, os.name, ds.name, b.bus_type, t.departure_at, t.arrival_at, t.status, b.seat_count
                {TripBaseSource}
                WHERE t.organization_id = @org AND t.status NOT IN ('DRAFT', 'CANCELLED')
                ORDER BY t.departure_at DESC, t.id DESC
                """;
            cmd.Parameters.AddWithValue("org", organizationId);
        }, reader => new ManifestTripDto(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.GetString(4), reader.GetFieldValue<DateTimeOffset>(5), reader.GetFieldValue<DateTimeOffset>(6),
            reader.GetString(7), reader.GetInt32(8)), cancellationToken);

    public async Task<long> CountOperatorTripsAsync(Guid organizationId, Guid[] tripIds, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            "SELECT COUNT(*) FROM trips WHERE organization_id = @org AND (cardinality(@ids) = 0 OR id = ANY(@ids));", connection);
        command.Parameters.AddWithValue("org", organizationId);
        command.Parameters.AddWithValue("ids", tripIds);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(value);
    }

    public async Task<TripAvailabilityDto> ListAvailableResourcesAsync(
        Guid organizationId, IReadOnlyList<TripWindow> windows, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH windows AS (
                SELECT tstzrange(start_at, end_at, '[)') AS slot
                FROM unnest(@starts::timestamptz[], @ends::timestamptz[]) AS period(start_at, end_at)
            )
            SELECT 'bus', b.id
            FROM buses b
            WHERE b.organization_id = @org AND b.status = 'ACTIVE' AND b.deleted_at IS NULL
              AND EXISTS (SELECT 1 FROM seats s WHERE s.bus_id = b.id AND s.active)
              AND NOT EXISTS (
                  SELECT 1 FROM windows w JOIN trips t ON t.operating_window && w.slot
                  WHERE t.bus_id = b.id AND t.status IN ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT','ARRIVED')
              )
            UNION ALL
            SELECT 'driver', d.id
            FROM driver_profiles d
            WHERE d.organization_id = @org AND d.status = 'ACTIVE' AND d.deleted_at IS NULL
              AND d.license_expires_on >= @arrivalDate
              AND NOT EXISTS (
                  SELECT 1 FROM windows w JOIN driver_assignments a ON a.assignment_window && w.slot
                  WHERE a.driver_profile_id = d.id AND a.active
              );
            """, connection);
        command.Parameters.AddWithValue("org", organizationId);
        command.Parameters.AddWithValue("starts", windows.Select(window => window.Start.UtcDateTime).ToArray());
        command.Parameters.AddWithValue("ends", windows.Select(window => window.End.UtcDateTime).ToArray());
        command.Parameters.AddWithValue("arrivalDate", DateOnly.FromDateTime(windows[^1].ArrivalAt.UtcDateTime));
        var buses = new List<Guid>();
        var drivers = new List<Guid>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            (reader.GetString(0) == "bus" ? buses : drivers).Add(reader.GetGuid(1));
        return new TripAvailabilityDto(buses, drivers);
    }

    public async Task<(IReadOnlyList<(TripRecord Trip, string ScheduleStatus)> Items, long Total)> SearchScheduleAsync(
        Guid organizationId, ScheduleFilter filter, int page, int size, CancellationToken cancellationToken)
    {
        const string localTime = "(t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time";
        const string classification = """
            CROSS JOIN LATERAL (
                SELECT
                    (t.status IN ('COMPLETED','CANCELLED') OR t.arrival_at <= @asOf) AS history,
                    CASE
                        WHEN t.arrival_at <= @asOf
                            AND t.status IN ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT') THEN 'NEEDS_UPDATE'
                        WHEN t.status = 'SCHEDULED' AND t.departure_at <= @asOf THEN 'AWAITING_DEPARTURE'
                        WHEN t.status = 'BOARDING' AND t.departure_at > @asOf + INTERVAL '1 hour' THEN 'SCHEDULED'
                        ELSE t.status
                    END AS display_status
            ) schedule
            """;
        var where = $"""
            WHERE t.organization_id = @org
                AND (@origin = '' OR os.name = @origin)
                AND (@destination = '' OR ds.name = @destination)
                AND (@date IS NULL OR t.departure_at >= (@date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
                     AND t.departure_at < ((@date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
                AND (@scope = 'all' OR schedule.history = (@scope = 'history'))
                AND (cardinality(@statuses) = 0 OR schedule.display_status = ANY(@statuses))
                AND (cardinality(@assignments) = 0 OR
                     (CASE WHEN da.driver_profile_id IS NULL THEN 'missing' ELSE 'complete' END) = ANY(@assignments))
                AND (cardinality(@periods) = 0 OR
                     (CASE WHEN {localTime} >= TIME '18:00' THEN 'evening'
                           WHEN {localTime} >= TIME '12:00' THEN 'afternoon'
                           WHEN {localTime} >= TIME '06:00' THEN 'morning' ELSE '' END) = ANY(@periods))
            """;
        var ordering = filter.Sort switch
        {
            "earliest" => $"{localTime} ASC, ",
            "latest" => $"{localTime} DESC, ",
            _ => ""
        };
        var dateOrder = filter.Scope == "active" && string.IsNullOrEmpty(ordering) ? "ASC" : "DESC";
        await using var connection = await OpenAsync(cancellationToken);
        await using var count = new NpgsqlCommand($"SELECT count(*) {TripSource} {classification} {where}", connection);
        await using var select = new NpgsqlCommand(
            $"{TripProjection}, da.driver_profile_id, schedule.display_status {TripSource} {classification} {where} ORDER BY {ordering}t.departure_at {dateOrder}, t.id DESC OFFSET @offset LIMIT @limit", connection);
        var asOf = DateTimeOffset.UtcNow;
        foreach (var command in new[] { count, select })
        {
            command.Parameters.AddWithValue("org", organizationId);
            command.Parameters.AddWithValue("scope", filter.Scope);
            command.Parameters.AddWithValue("asOf", asOf);
            command.Parameters.AddWithValue("origin", filter.Origin ?? "");
            command.Parameters.AddWithValue("destination", filter.Destination ?? "");
            command.Parameters.AddWithValue("date", NpgsqlTypes.NpgsqlDbType.Date, (object?)filter.ServiceDate ?? DBNull.Value);
            command.Parameters.AddWithValue("statuses", filter.Statuses.Select(status => status.ToUpperInvariant()).ToArray());
            command.Parameters.AddWithValue("assignments", filter.Assignments);
            command.Parameters.AddWithValue("periods", filter.Periods);
        }
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
        select.Parameters.AddWithValue("offset", (long)page * size);
        select.Parameters.AddWithValue("limit", size);
        return (await ReadAllAsync(select, reader => (ReadTrip(reader), reader.GetString(25)), cancellationToken), total);
    }

    private const string TripSearchFilters = """
        t.sellable = true AND t.status IN ('SCHEDULED','BOARDING')
          AND o.name IS NOT NULL
          AND lower(os.name) LIKE lower(@origin)
          AND lower(ds.name) LIKE lower(@dest)
          AND t.departure_at > NOW()
          AND (@date IS NULL OR t.departure_at >= (@date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
                            AND t.departure_at < ((@date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
          AND t.base_fare >= COALESCE(@minPrice, 0)
          AND t.base_fare <= COALESCE(@maxPrice, 9223372036854775807)
          AND (@org IS NULL OR t.organization_id = @org)
          AND (@busType IS NULL OR b.bus_type = @busType)
          AND (@timeFrom IS NULL OR (t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= @timeFrom)
          AND (@timeTo IS NULL OR (t.departure_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time <= @timeTo)
          AND (@pickup IS NULL OR EXISTS (
                SELECT 1 FROM route_stops rs
                WHERE rs.route_id = t.route_id AND rs.stop_id = @pickup AND rs.pickup_allowed))
          AND (@dropoff IS NULL OR EXISTS (
                SELECT 1 FROM route_stops rs
                WHERE rs.route_id = t.route_id AND rs.stop_id = @dropoff AND rs.dropoff_allowed))
          AND (@amenitiesJson::jsonb IS NULL OR b.amenities @> @amenitiesJson::jsonb)
          AND b.seat_count >= @passengers
        """;

    private static string TripSearchOrder(string? sort) => sort switch
    {
        "PRICE_ASC" => "t.base_fare ASC",
        "PRICE_DESC" => "t.base_fare DESC",
        "DEPARTURE_DESC" => "t.departure_at DESC",
        "DURATION_ASC" => "(t.arrival_at - t.departure_at) ASC",
        "DURATION_DESC" => "(t.arrival_at - t.departure_at) DESC",
        _ => "t.departure_at ASC"
    };

    public async Task<(IReadOnlyList<TripRecord> Items, long Total)> SearchSellableAsync(TripSearchQuery query, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using (var count = new NpgsqlCommand(
                         $"""
                          SELECT COUNT(*)
                          {TripBaseSource}
                          WHERE {TripSearchFilters}
                          """,
                         connection))
        {
            try
            {
                BindSearch(count, query);
                var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
                await using var select = new NpgsqlCommand(
                    $"""
                     {TripProjection}, NULL::uuid {TripBaseSource}
                     WHERE {TripSearchFilters}
                     ORDER BY {TripSearchOrder(query.Sort)}, t.id
                     OFFSET @offset LIMIT @limit
                     """,
                    connection);
                BindSearch(select, query);
                select.Parameters.AddWithValue("offset", (long)query.Page * Math.Max(query.Size, 1));
                select.Parameters.AddWithValue("limit", query.Size <= 0 ? 20 : query.Size);
                var items = await ReadAllAsync(select, ReadTrip, cancellationToken);
                return (items, total);
            }
            catch (PostgresException exception)
            {
                throw new InvalidOperationException($"SearchSellable failed ({exception.SqlState} p{exception.Position}): {exception.MessageText}", exception);
            }
        }
    }

    public async Task<IReadOnlyList<TripCardDto>> SearchTripCardsAsync(TripSearchQuery query, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand($"""
            SELECT t.id, t.route_id, t.organization_id, o.name, b.bus_type, b.amenities::text,
                   t.departure_at, t.arrival_at, os.name, ds.name, t.base_fare, t.currency, t.status, b.seat_count
            {TripBaseSource}
            WHERE {TripSearchFilters}
            ORDER BY {TripSearchOrder(query.Sort)}, t.id
            """, connection);
        BindSearch(command, query);
        return await ReadAllAsync(command, reader => new TripCardDto(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4),
            JsonSerializer.Deserialize<List<string>>(reader.GetString(5), Json) ?? [],
            reader.GetFieldValue<DateTimeOffset>(6), reader.GetFieldValue<DateTimeOffset>(7),
            reader.GetString(8), reader.GetString(9), new MoneyDto(reader.GetInt64(10), reader.GetString(11)),
            reader.GetString(12), reader.GetInt32(13)), cancellationToken);
    }

    public async Task<IReadOnlyList<TripStopDto>> GetTripStopsAsync(Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT s.id, s.name, s.address, rs.sequence_no, COALESCE(rs.departure_offset_minutes, rs.arrival_offset_minutes, 0),
                   rs.pickup_allowed, rs.dropoff_allowed
            FROM trips t
            JOIN route_stops rs ON rs.route_id = t.route_id
            JOIN stops s ON s.id = rs.stop_id
            WHERE t.id = @id
            ORDER BY rs.sequence_no;
            """, connection);
        command.Parameters.AddWithValue("id", tripId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<TripStopDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(ReadTripStop(reader));
        }

        return items;
    }

    public async Task<ILookup<Guid, TripStopDto>> GetRouteStopsForTripsAsync(Guid[] routeIds, CancellationToken cancellationToken)
    {
        var items = new List<(Guid RouteId, TripStopDto Stop)>();
        if (routeIds.Length == 0)
            return items.ToLookup(item => item.RouteId, item => item.Stop);
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT s.id, s.name, s.address, rs.sequence_no, COALESCE(rs.departure_offset_minutes, rs.arrival_offset_minutes, 0),
                   rs.pickup_allowed, rs.dropoff_allowed, rs.route_id
            FROM route_stops rs
            JOIN stops s ON s.id = rs.stop_id
            WHERE rs.route_id = ANY(@ids)
            ORDER BY rs.route_id, rs.sequence_no;
            """, connection);
        command.Parameters.AddWithValue("ids", routeIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            items.Add((reader.GetGuid(7), ReadTripStop(reader)));
        return items.ToLookup(item => item.RouteId, item => item.Stop);
    }

    private static TripStopDto ReadTripStop(NpgsqlDataReader reader) =>
        new(reader.GetGuid(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2),
            reader.GetInt32(3), reader.GetInt32(4), reader.GetBoolean(5), reader.GetBoolean(6));

    public async Task<IReadOnlyList<DriverAssignmentDto>> ListAssignmentsForDriverAsync(Guid driverUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT a.trip_id, a.driver_profile_id, lower(a.assignment_window), upper(a.assignment_window), a.active
            FROM driver_assignments a
            JOIN driver_profiles d ON d.id = a.driver_profile_id
            WHERE d.user_id_external = @user AND a.active;
            """, connection);
        command.Parameters.AddWithValue("user", driverUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<DriverAssignmentDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new DriverAssignmentDto(
                reader.GetGuid(0),
                reader.GetGuid(1),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(2), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(3), DateTimeKind.Utc)),
                reader.GetBoolean(4)));
        }

        return items;
    }

    public async Task<bool> IsDriverAssignedToTripAsync(Guid driverUserId, Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT 1
            FROM driver_assignments a
            JOIN driver_profiles d ON d.id = a.driver_profile_id
            WHERE a.trip_id = @trip AND d.user_id_external = @user AND a.active
            LIMIT 1;
            """, connection);
        command.Parameters.AddWithValue("trip", tripId);
        command.Parameters.AddWithValue("user", driverUserId);
        return await command.ExecuteScalarAsync(cancellationToken) is not null;
    }

    public async Task<IReadOnlyList<DriverTripWorkDto>> ListDriverTripWorkAsync(
        Guid organizationId, Guid? driverUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH assignments AS (
                SELECT DISTINCT d.id AS driver_id, t.id AS trip_id, t.bus_id, b.plate_number,
                    os.name AS origin, ds.name AS destination, t.departure_at, t.arrival_at, t.status, t.row_version,
                    CASE
                        WHEN t.status IN ('COMPLETED','CANCELLED') THEN 'HISTORY'
                        WHEN t.status IN ('DEPARTED','IN_TRANSIT','ARRIVED')
                            OR (t.status = 'BOARDING' AND t.departure_at <= @asOf + INTERVAL '1 hour') THEN 'OPERATING'
                        WHEN t.departure_at <= @asOf THEN 'PENDING'
                        ELSE 'UPCOMING'
                    END AS phase,
                    t.arrival_at <= @asOf AND t.status IN ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT') AS needs_update
                FROM driver_assignments a
                JOIN driver_profiles d ON d.id = a.driver_profile_id AND d.organization_id = @org
                JOIN trips t ON t.id = a.trip_id AND t.organization_id = @org
                JOIN buses b ON b.id = t.bus_id AND b.organization_id = @org
                JOIN stops os ON os.id = t.origin_stop_id
                JOIN stops ds ON ds.id = t.destination_stop_id
                WHERE a.active AND t.status <> 'DRAFT'
                    AND (@user IS NULL OR d.user_id_external = @user)
                    AND (t.status NOT IN ('COMPLETED','CANCELLED') OR t.departure_at >= @asOf - INTERVAL '7 days')
            ), ranked AS (
                SELECT *, row_number() OVER (
                    PARTITION BY driver_id
                    ORDER BY needs_update, (phase = 'OPERATING') DESC, departure_at DESC, trip_id
                ) AS position
                FROM assignments
                WHERE @user IS NOT NULL OR phase = 'OPERATING'
                    OR (phase = 'PENDING' AND arrival_at > @asOf)
            )
            SELECT driver_id, trip_id, bus_id, plate_number, origin, destination, departure_at, arrival_at,
                   status, row_version, phase, needs_update
            FROM ranked
            WHERE @user IS NOT NULL OR position = 1
            ORDER BY CASE phase WHEN 'OPERATING' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'UPCOMING' THEN 2 ELSE 3 END,
                CASE WHEN phase = 'UPCOMING' THEN departure_at END ASC,
                departure_at DESC, trip_id
            LIMIT CASE WHEN @user IS NOT NULL THEN 100 END;
            """, connection);
        command.Parameters.AddWithValue("org", organizationId);
        command.Parameters.AddWithValue("user", NpgsqlTypes.NpgsqlDbType.Uuid, (object?)driverUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("asOf", DateTimeOffset.UtcNow);
        return await ReadAllAsync(command, reader => new DriverTripWorkDto(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4),
            reader.GetString(5), reader.GetFieldValue<DateTimeOffset>(6), reader.GetFieldValue<DateTimeOffset>(7),
            reader.GetString(8), reader.GetInt64(9), reader.GetString(10), reader.GetBoolean(11)), cancellationToken);
    }

    public async Task MarkSellableAsync(Guid tripId, bool sellable, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE trips SET sellable = @sellable, updated_at = NOW()
            WHERE id = @id AND status IN ('SCHEDULED','BOARDING');
            """, connection);
        command.Parameters.AddWithValue("id", tripId);
        command.Parameters.AddWithValue("sellable", sellable);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private const string RouteSelect = """
        SELECT r.id, r.organization_id, r.code, r.name, r.origin_stop_id, r.destination_stop_id,
               o.name, d.name, r.default_duration_minutes, r.distance_km, r.status, r.row_version
        FROM routes r
        JOIN stops o ON o.id = r.origin_stop_id
        JOIN stops d ON d.id = r.destination_stop_id
        """;

    private const string TripProjection = """
        SELECT t.id, t.organization_id, o.name, t.route_id, t.bus_id, t.origin_stop_id, t.destination_stop_id,
               t.departure_at, t.arrival_at, t.base_fare, t.currency, t.status, t.sellable, t.published_version,
               COALESCE(t.fare_policy_snapshot->>'policyVersion', 'cancel-mvp-v1'), b.bus_type, b.amenities::text,
               os.name, ds.name, b.seat_count, t.route_snapshot::text, t.bus_snapshot::text, t.fare_policy_snapshot::text,
               t.row_version
        """;
    private const string TripSelect = TripProjection + ", da.driver_profile_id " + TripSource;

    private const string TripBaseSource = """
        FROM trips t
        JOIN organizations o ON o.id = t.organization_id
        JOIN buses b ON b.id = t.bus_id
        JOIN stops os ON os.id = t.origin_stop_id
        JOIN stops ds ON ds.id = t.destination_stop_id
        """;
    private const string TripSource = TripBaseSource + " " + """
        LEFT JOIN LATERAL (
            SELECT a.driver_profile_id FROM driver_assignments a
            WHERE a.trip_id = t.id AND a.assignment_role = 'PRIMARY' AND (a.active OR t.status = 'DRAFT')
            ORDER BY a.active DESC, a.created_at DESC, a.id DESC LIMIT 1
        ) da ON TRUE
        """;

    private static void BindSearch(NpgsqlCommand command, TripSearchQuery query)
    {
        command.Parameters.AddWithValue("origin", "%" + (query.Origin ?? "").Trim() + "%");
        command.Parameters.AddWithValue("dest", "%" + (query.Destination ?? "").Trim() + "%");
        command.Parameters.Add(new NpgsqlParameter("date", NpgsqlTypes.NpgsqlDbType.Date) { Value = (object?)query.DepartureDate ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("minPrice", NpgsqlTypes.NpgsqlDbType.Bigint) { Value = (object?)query.MinPrice ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("maxPrice", NpgsqlTypes.NpgsqlDbType.Bigint) { Value = (object?)query.MaxPrice ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("org", NpgsqlTypes.NpgsqlDbType.Uuid) { Value = (object?)query.OrganizationId ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("busType", NpgsqlTypes.NpgsqlDbType.Text) { Value = (object?)query.BusType ?? DBNull.Value });
        command.Parameters.AddWithValue("passengers", query.PassengerCount);
        command.Parameters.Add(new NpgsqlParameter("timeFrom", NpgsqlTypes.NpgsqlDbType.Time) { Value = (object?)query.DepartureTimeFrom ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("timeTo", NpgsqlTypes.NpgsqlDbType.Time) { Value = (object?)query.DepartureTimeTo ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("pickup", NpgsqlTypes.NpgsqlDbType.Uuid) { Value = (object?)query.PickupStopId ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter("dropoff", NpgsqlTypes.NpgsqlDbType.Uuid) { Value = (object?)query.DropoffStopId ?? DBNull.Value });
        var amenitiesJson = query.Amenities is { Count: > 0 } ? JsonSerializer.Serialize(query.Amenities, Json) : null;
        command.Parameters.Add(new NpgsqlParameter("amenitiesJson", NpgsqlTypes.NpgsqlDbType.Jsonb) { Value = (object?)amenitiesJson ?? DBNull.Value });
    }

    private static void BindBus(NpgsqlCommand command, BusRecord bus)
    {
        command.Parameters.AddWithValue("id", bus.Id);
        command.Parameters.AddWithValue("org", bus.OrganizationId);
        command.Parameters.AddWithValue("plate", bus.PlateNumber);
        command.Parameters.AddWithValue("norm", bus.NormalizedPlate);
        command.Parameters.AddWithValue("name", bus.DisplayName);
        command.Parameters.AddWithValue("type", bus.Type);
        command.Parameters.AddWithValue("amenities", JsonSerializer.Serialize(bus.Amenities, Json));
        command.Parameters.AddWithValue("seats", bus.SeatCount);
        command.Parameters.AddWithValue("status", bus.Status);
    }

    private static void BindDriver(NpgsqlCommand command, DriverRecord driver)
    {
        command.Parameters.AddWithValue("id", driver.Id);
        command.Parameters.AddWithValue("org", driver.OrganizationId);
        command.Parameters.AddWithValue("user", driver.UserId);
        command.Parameters.AddWithValue("emp", driver.EmployeeCode);
        command.Parameters.AddWithValue("license", driver.LicenseNumber);
        command.Parameters.AddWithValue("expires", driver.LicenseExpiresOn);
        command.Parameters.AddWithValue("status", driver.Status);
    }

    private static void BindRoute(NpgsqlCommand command, RouteRecord route)
    {
        command.Parameters.AddWithValue("id", route.Id);
        command.Parameters.AddWithValue("org", route.OrganizationId);
        command.Parameters.AddWithValue("code", route.Code);
        command.Parameters.AddWithValue("name", route.Name);
        command.Parameters.AddWithValue("origin", route.OriginStopId);
        command.Parameters.AddWithValue("dest", route.DestinationStopId);
        command.Parameters.AddWithValue("duration", route.DurationMinutes);
        command.Parameters.Add(new NpgsqlParameter("distance", NpgsqlTypes.NpgsqlDbType.Numeric)
        {
            Value = (object?)route.DistanceKm ?? DBNull.Value
        });
        command.Parameters.AddWithValue("status", route.Status);
    }

    private static void BindTripCore(NpgsqlCommand command, TripRecord trip)
    {
        command.Parameters.AddWithValue("id", trip.Id);
        command.Parameters.AddWithValue("org", trip.OrganizationId);
        command.Parameters.AddWithValue("route", trip.RouteId);
        command.Parameters.AddWithValue("bus", trip.BusId);
        command.Parameters.AddWithValue("origin", trip.OriginStopId);
        command.Parameters.AddWithValue("dest", trip.DestinationStopId);
        command.Parameters.AddWithValue("dep", trip.DepartureAt.UtcDateTime);
        command.Parameters.AddWithValue("arr", trip.ArrivalAt.UtcDateTime);
        command.Parameters.AddWithValue("winStart", trip.DepartureAt.UtcDateTime.AddHours(-1));
        command.Parameters.AddWithValue("winEnd", trip.ArrivalAt.UtcDateTime.AddHours(1));
        command.Parameters.AddWithValue("fare", trip.BaseFare);
        command.Parameters.AddWithValue("currency", trip.Currency);
        command.Parameters.AddWithValue("status", trip.Status);
        command.Parameters.AddWithValue("sellable", trip.Sellable);
    }

    private static async Task InsertSeatAsync(NpgsqlConnection connection, NpgsqlTransaction tx, SeatRecord seat, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO seats (id, bus_id, code, deck, row_no, column_no, seat_type, active, created_at, updated_at)
            VALUES (@id, @bus, @code, @deck, @row, @col, @type, @active, NOW(), NOW());
            """, connection, tx);
        command.Parameters.AddWithValue("id", seat.Id);
        command.Parameters.AddWithValue("bus", seat.BusId);
        command.Parameters.AddWithValue("code", seat.Code);
        command.Parameters.AddWithValue("deck", seat.Deck);
        command.Parameters.AddWithValue("row", seat.Row);
        command.Parameters.AddWithValue("col", seat.Column);
        command.Parameters.AddWithValue("type", seat.Type);
        command.Parameters.AddWithValue("active", seat.Active);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertRouteStopAsync(NpgsqlConnection connection, NpgsqlTransaction tx, RouteStopRecord stop, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            INSERT INTO route_stops (
              id, route_id, stop_id, sequence_no, stop_role, arrival_offset_minutes, departure_offset_minutes,
              pickup_allowed, dropoff_allowed)
            VALUES (@id, @route, @stop, @seq, @role, @offset, @offset, @pickup, @dropoff);
            """, connection, tx);
        command.Parameters.AddWithValue("id", stop.Id);
        command.Parameters.AddWithValue("route", stop.RouteId);
        command.Parameters.AddWithValue("stop", stop.StopId);
        command.Parameters.AddWithValue("seq", stop.Sequence);
        command.Parameters.AddWithValue("role", stop.Role);
        command.Parameters.AddWithValue("offset", stop.OffsetMinutes);
        command.Parameters.AddWithValue("pickup", stop.PickupAllowed);
        command.Parameters.AddWithValue("dropoff", stop.DropoffAllowed);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<SeatRecord>> ListSeatsAsync(Guid busId, CancellationToken cancellationToken) =>
        await QueryListAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT id, bus_id, code, deck, row_no, column_no, seat_type, active
                FROM seats WHERE bus_id = @id ORDER BY deck, row_no, column_no;
                """;
            cmd.Parameters.AddWithValue("id", busId);
        }, reader => new SeatRecord(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetInt16(3),
            reader.GetInt16(4),
            reader.GetInt16(5),
            reader.GetString(6),
            reader.GetBoolean(7)), cancellationToken);

    private async Task<IReadOnlyList<RouteStopRecord>> ListRouteStopsAsync(Guid routeId, CancellationToken cancellationToken) =>
        await QueryListAsync(async cmd =>
        {
            cmd.CommandText = """
                SELECT rs.id, rs.route_id, rs.stop_id, rs.sequence_no, rs.stop_role,
                       COALESCE(rs.departure_offset_minutes, rs.arrival_offset_minutes, 0),
                       rs.pickup_allowed, rs.dropoff_allowed, s.name, s.address
                FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
                WHERE rs.route_id = @id ORDER BY rs.sequence_no;
                """;
            cmd.Parameters.AddWithValue("id", routeId);
        }, reader => new RouteStopRecord(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            reader.GetInt32(3),
            reader.GetString(4),
            reader.GetInt32(5),
            reader.GetBoolean(6),
            reader.GetBoolean(7),
            reader.GetString(8),
            reader.IsDBNull(9) ? null : reader.GetString(9)), cancellationToken);

    private static OrganizationRecord ReadOrg(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.GetString(5),
            reader.GetBoolean(6),
            reader.GetDecimal(7),
            reader.GetInt64(8));

    private static BusRecord ReadBus(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            JsonSerializer.Deserialize<List<string>>(reader.IsDBNull(6) ? "[]" : reader.GetString(6), Json) ?? [],
            reader.GetInt32(7),
            reader.GetString(8),
            reader.GetInt64(9),
            []);

    private static DriverRecord ReadDriver(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            reader.GetString(3),
            reader.GetString(4),
            DateOnly.FromDateTime(reader.GetDateTime(5)),
            reader.GetString(6),
            reader.GetInt64(7));

    private static RouteRecord ReadRoute(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetGuid(4),
            reader.GetGuid(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetInt32(8),
            reader.IsDBNull(9) ? null : reader.GetDecimal(9),
            reader.GetString(10),
            reader.GetInt64(11),
            []);

    private static TripRecord ReadTrip(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetGuid(3),
            reader.GetGuid(4),
            reader.GetGuid(5),
            reader.GetGuid(6),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)),
            reader.GetInt64(9),
            reader.GetString(10),
            reader.GetString(11),
            reader.GetBoolean(12),
            reader.IsDBNull(13) ? null : reader.GetInt64(13),
            reader.IsDBNull(14) ? null : reader.GetString(14),
            reader.GetString(15),
            JsonSerializer.Deserialize<List<string>>(reader.IsDBNull(16) ? "[]" : reader.GetString(16), Json) ?? [],
            reader.GetString(17),
            reader.GetString(18),
            reader.GetInt32(19),
            reader.IsDBNull(20) ? null : reader.GetString(20),
            reader.IsDBNull(21) ? null : reader.GetString(21),
            reader.IsDBNull(22) ? null : reader.GetString(22),
            reader.GetInt64(23),
            reader.IsDBNull(24) ? null : reader.GetGuid(24));

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private async Task<T?> QuerySingleAsync<T>(Func<NpgsqlCommand, Task> configure, Func<NpgsqlDataReader, T> map, CancellationToken cancellationToken)
        where T : class
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand { Connection = connection };
        await configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? map(reader) : null;
    }

    private async Task<IReadOnlyList<T>> QueryListAsync<T>(Func<NpgsqlCommand, Task> configure, Func<NpgsqlDataReader, T> map, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand { Connection = connection };
        await configure(command);
        return await ReadAllAsync(command, map, cancellationToken);
    }

    private static async Task<IReadOnlyList<T>> ReadAllAsync<T>(NpgsqlCommand command, Func<NpgsqlDataReader, T> map, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<T>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(map(reader));
        }

        return items;
    }
}
