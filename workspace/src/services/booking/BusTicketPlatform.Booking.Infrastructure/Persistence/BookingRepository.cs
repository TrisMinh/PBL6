using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Ids;
using Npgsql;
using System.Text.Json.Nodes;

namespace BusTicketPlatform.Booking.Infrastructure.Persistence;

public sealed partial class BookingRepository(BookingDatabaseOptions options, IIdGenerator ids) : IBookingRepository
{
    public async Task ImportTripAsync(TripPublishedMessage message, IReadOnlyList<InventorySeat> seats, CancellationToken cancellationToken)
    {
        var normalizedStatus = message.Status == "DRAFT" ? "SCHEDULED" : message.Status;
        var sellable = normalizedStatus is "SCHEDULED" or "BOARDING";
        var fareSnapshot = AddDriverAssignment(message.FarePolicySnapshot, message.DriverUserId);
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var upsert = new NpgsqlCommand("""
            INSERT INTO trip_snapshots (
              trip_id, organization_id_external, route_id_external, bus_id_external, origin_stop_id_external,
              destination_stop_id_external, departure_at, arrival_at, currency, status, sellable, source_trip_version,
              route_snapshot, bus_snapshot, fare_policy_snapshot, created_at, updated_at)
            VALUES (
              @id, @org, @route, @bus, @origin, @dest, @dep, @arr, @currency, @status, @sellable, @version,
              CAST(@routeSnap AS jsonb), CAST(@busSnap AS jsonb), CAST(@fareSnap AS jsonb), NOW(), NOW())
            ON CONFLICT (trip_id) DO UPDATE
              SET status = EXCLUDED.status,
                  sellable = EXCLUDED.sellable,
                  source_trip_version = GREATEST(trip_snapshots.source_trip_version, EXCLUDED.source_trip_version),
                  fare_policy_snapshot = EXCLUDED.fare_policy_snapshot,
                  updated_at = NOW();
            """, connection, tx))
        {
            upsert.Parameters.AddWithValue("id", message.TripId);
            upsert.Parameters.AddWithValue("org", message.OrganizationId);
            upsert.Parameters.AddWithValue("route", message.RouteId);
            upsert.Parameters.AddWithValue("bus", message.BusId);
            upsert.Parameters.AddWithValue("origin", message.OriginStopId);
            upsert.Parameters.AddWithValue("dest", message.DestinationStopId);
            upsert.Parameters.AddWithValue("dep", message.DepartureAt.UtcDateTime);
            upsert.Parameters.AddWithValue("arr", message.ArrivalAt.UtcDateTime);
            upsert.Parameters.AddWithValue("currency", message.Currency);
            upsert.Parameters.AddWithValue("status", normalizedStatus);
            upsert.Parameters.AddWithValue("sellable", sellable);
            upsert.Parameters.AddWithValue("version", message.SourceTripVersion);
            upsert.Parameters.AddWithValue("routeSnap", message.RouteSnapshot ?? "{}");
            upsert.Parameters.AddWithValue("busSnap", message.BusSnapshot ?? "{}");
            upsert.Parameters.AddWithValue("fareSnap", fareSnapshot);
            await upsert.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var seat in seats)
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO trip_seats (
                  id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no, price, status, updated_at)
                VALUES (@id, @trip, @source, @code, @type, @deck, @row, @col, @price, @status, NOW())
                ON CONFLICT (trip_id, source_seat_id_external) DO NOTHING;
                """, connection, tx);
            insert.Parameters.AddWithValue("id", seat.Id);
            insert.Parameters.AddWithValue("trip", seat.TripId);
            insert.Parameters.AddWithValue("source", seat.SourceSeatId);
            insert.Parameters.AddWithValue("code", seat.Code);
            insert.Parameters.AddWithValue("type", seat.Type);
            insert.Parameters.AddWithValue("deck", (short)seat.Deck);
            insert.Parameters.AddWithValue("row", (short)seat.Row);
            insert.Parameters.AddWithValue("col", (short)seat.Column);
            insert.Parameters.AddWithValue("price", seat.Price);
            insert.Parameters.AddWithValue("status", seat.Status);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task ApplyTripStatusAsync(Guid tripId, string status, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var trip = new NpgsqlCommand("""
            UPDATE trip_snapshots
            SET status = @status,
                sellable = @status IN ('SCHEDULED', 'BOARDING'),
                updated_at = NOW()
            WHERE trip_id = @trip;
            """, connection, tx))
        {
            trip.Parameters.AddWithValue("trip", tripId);
            trip.Parameters.AddWithValue("status", status);
            await trip.ExecuteNonQueryAsync(cancellationToken);
        }

        if (status is not ("SCHEDULED" or "BOARDING"))
        {
            await using var release = new NpgsqlCommand("""
                WITH released_holds AS (
                  UPDATE seat_holds
                  SET status = 'RELEASED', released_at = NOW(), row_version = row_version + 1
                  WHERE trip_id = @trip AND status = 'ACTIVE'
                  RETURNING id
                )
                UPDATE trip_seats s
                SET status = 'AVAILABLE', active_hold_id = NULL, updated_at = NOW(), row_version = row_version + 1
                FROM released_holds h
                WHERE s.active_hold_id = h.id;
                """, connection, tx);
            release.Parameters.AddWithValue("trip", tripId);
            await release.ExecuteNonQueryAsync(cancellationToken);
        }

        if (status == "CANCELLED")
        {
            await using (var cancelTickets = new NpgsqlCommand("""
                UPDATE tickets t
                SET status = 'CANCELLED', cancelled_at = NOW(), row_version = t.row_version + 1
                FROM bookings b
                WHERE t.booking_id = b.id
                  AND b.trip_id = @trip
                  AND t.status IN ('ISSUED', 'CHECKED_IN');
                """, connection, tx))
            {
                cancelTickets.Parameters.AddWithValue("trip", tripId);
                await cancelTickets.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var releaseBookedSeats = new NpgsqlCommand("""
                UPDATE trip_seats s
                SET status = 'AVAILABLE', active_booking_item_id = NULL, updated_at = NOW(), row_version = s.row_version + 1
                FROM booking_items i
                JOIN bookings b ON b.id = i.booking_id
                WHERE b.trip_id = @trip
                  AND s.active_booking_item_id = i.id;
                """, connection, tx))
            {
                releaseBookedSeats.Parameters.AddWithValue("trip", tripId);
                await releaseBookedSeats.ExecuteNonQueryAsync(cancellationToken);
            }

            await using var cancelBookings = new NpgsqlCommand("""
                UPDATE bookings
                SET status = CASE
                      WHEN payment_channel = 'PREPAID' AND status = 'PAID' THEN 'REFUND_PENDING'
                      ELSE 'CANCELLED'
                    END,
                    cancelled_at = NOW(),
                    cancellation_fee = 0,
                    refund_amount = CASE WHEN payment_channel = 'PREPAID' AND status = 'PAID' THEN total_amount ELSE 0 END,
                    updated_at = NOW(),
                    row_version = row_version + 1
                WHERE trip_id = @trip
                  AND status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PAID');
                """, connection, tx);
            cancelBookings.Parameters.AddWithValue("trip", tripId);
            await cancelBookings.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task ExpireHoldsAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var bookings = new NpgsqlCommand("""
            WITH expired_bookings AS (
              UPDATE bookings
              SET status = 'EXPIRED', updated_at = NOW(), row_version = row_version + 1
              WHERE status = 'PENDING_PAYMENT' AND expires_at <= NOW()
              RETURNING id
            ), expired_items AS (
              SELECT i.id
              FROM booking_items i
              JOIN expired_bookings b ON b.id = i.booking_id
            )
            UPDATE trip_seats s
            SET status = 'AVAILABLE', active_booking_item_id = NULL, updated_at = NOW(), row_version = row_version + 1
            FROM expired_items i
            WHERE s.active_booking_item_id = i.id;
            """, connection, tx))
        {
            await bookings.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var command = new NpgsqlCommand("""
            WITH expired AS (
              UPDATE seat_holds
              SET status = 'EXPIRED', released_at = NOW(), row_version = row_version + 1
              WHERE status = 'ACTIVE' AND expires_at <= NOW()
              RETURNING id
            )
            UPDATE trip_seats s
            SET status = 'AVAILABLE', active_hold_id = NULL, updated_at = NOW(), row_version = row_version + 1
            FROM expired
            WHERE s.active_hold_id = expired.id;
            """, connection, tx))
        {
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InventorySeat>> ListSeatsAsync(Guid tripId, CancellationToken cancellationToken) =>
        await QuerySeats("SELECT id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no, price, status, row_version FROM trip_seats WHERE trip_id = @trip ORDER BY deck, row_no, column_no", tripId, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> AvailableSeatsAsync(Guid[] tripIds, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT s.trip_id, COUNT(*)::int
            FROM trip_seats s
            LEFT JOIN seat_holds h ON h.id = s.active_hold_id
            LEFT JOIN booking_items i ON i.id = s.active_booking_item_id
            LEFT JOIN bookings b ON b.id = i.booking_id
            WHERE s.trip_id = ANY(@trips) AND (
                s.status = 'AVAILABLE'
                OR (h.status = 'ACTIVE' AND h.expires_at <= NOW())
                OR (b.status = 'PENDING_PAYMENT' AND b.expires_at <= NOW())
            )
            GROUP BY s.trip_id
            """, connection);
        command.Parameters.AddWithValue("trips", tripIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var counts = tripIds.ToDictionary(id => id, _ => 0);
        while (await reader.ReadAsync(cancellationToken))
            counts[reader.GetGuid(0)] = reader.GetInt32(1);
        return counts;
    }

    public async Task<TripSnapshot?> GetTripAsync(Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT trip_id, organization_id_external, origin_stop_id_external, destination_stop_id_external, departure_at,
                   sellable, status, currency,
                   COALESCE(fare_policy_snapshot->>'allowPayLater', 'false') = 'true',
                   COALESCE(fare_policy_snapshot->>'policyVersion', 'cancel-mvp-v1'),
                   NULLIF(fare_policy_snapshot->>'driverUserId', '')::uuid
            FROM trip_snapshots WHERE trip_id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", tripId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new TripSnapshot(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            reader.GetGuid(3),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
            reader.GetBoolean(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetBoolean(8),
            reader.GetString(9),
            reader.IsDBNull(10) ? null : reader.GetGuid(10));
    }

    public async Task<SeatHoldRecord?> CreateHoldAsync(SeatHoldRecord hold, IReadOnlyList<Guid> seatIds, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var lockSeats = new NpgsqlCommand("""
            SELECT id, price FROM trip_seats
            WHERE trip_id = @trip AND id = ANY(@ids) AND status = 'AVAILABLE'
            FOR UPDATE;
            """, connection, tx))
        {
            lockSeats.Parameters.AddWithValue("trip", hold.TripId);
            lockSeats.Parameters.AddWithValue("ids", seatIds.ToArray());
            await using var reader = await lockSeats.ExecuteReaderAsync(cancellationToken);
            var prices = new Dictionary<Guid, long>();
            while (await reader.ReadAsync(cancellationToken))
            {
                prices[reader.GetGuid(0)] = reader.GetInt64(1);
            }

            await reader.CloseAsync();
            if (prices.Count != seatIds.Count)
            {
                await tx.RollbackAsync(cancellationToken);
                return null;
            }

            var total = prices.Values.Sum();
            await using (var insert = new NpgsqlCommand("""
                INSERT INTO seat_holds (
                  id, trip_id, customer_id_external, idempotency_key, hold_token_hash, status, total_amount, currency,
                  created_at, expires_at)
                VALUES (@id, @trip, @customer, @idem, @hash, 'ACTIVE', @total, @currency, NOW(), NOW() + INTERVAL '10 minutes')
                RETURNING created_at, expires_at;
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("id", hold.Id);
                insert.Parameters.AddWithValue("trip", hold.TripId);
                insert.Parameters.AddWithValue("customer", hold.CustomerId);
                insert.Parameters.AddWithValue("idem", hold.IdempotencyKey);
                insert.Parameters.AddWithValue("hash", hold.TokenHash);
                insert.Parameters.AddWithValue("total", total);
                insert.Parameters.AddWithValue("currency", hold.Currency);
                await using var created = await insert.ExecuteReaderAsync(cancellationToken);
                await created.ReadAsync(cancellationToken);
                var createdAt = new DateTimeOffset(DateTime.SpecifyKind(created.GetDateTime(0), DateTimeKind.Utc));
                var expires = new DateTimeOffset(DateTime.SpecifyKind(created.GetDateTime(1), DateTimeKind.Utc));
                await created.CloseAsync();

                foreach (var seatId in seatIds)
                {
                    await using var item = new NpgsqlCommand("""
                        INSERT INTO seat_hold_items (seat_hold_id, trip_seat_id, seat_code, unit_price)
                        SELECT @hold, id, seat_code, price FROM trip_seats WHERE id = @seat;
                        """, connection, tx);
                    item.Parameters.AddWithValue("hold", hold.Id);
                    item.Parameters.AddWithValue("seat", seatId);
                    await item.ExecuteNonQueryAsync(cancellationToken);
                    await using var update = new NpgsqlCommand("""
                        UPDATE trip_seats SET status = 'HELD', active_hold_id = @hold, updated_at = NOW() WHERE id = @seat;
                        """, connection, tx);
                    update.Parameters.AddWithValue("hold", hold.Id);
                    update.Parameters.AddWithValue("seat", seatId);
                    await update.ExecuteNonQueryAsync(cancellationToken);
                }

                await tx.CommitAsync(cancellationToken);
                var seats = await ListSeatsByIds(seatIds, cancellationToken);
                return hold with { TotalAmount = total, CreatedAt = createdAt, ExpiresAt = expires, Seats = seats };
            }
        }
    }

    public async Task<SeatHoldRecord?> ReplaceHoldAsync(SeatHoldRecord hold, IReadOnlyList<Guid> seatIds, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var guard = new NpgsqlCommand("SELECT id FROM seat_holds WHERE id=@hold AND customer_id_external=@owner AND status='ACTIVE' AND expires_at>NOW() FOR UPDATE", connection, tx))
        {
            guard.Parameters.AddWithValue("hold",hold.Id);
            guard.Parameters.AddWithValue("owner",hold.CustomerId);
            if(await guard.ExecuteScalarAsync(cancellationToken) is null) return null;
        }
        var prices = new Dictionary<Guid,long>();
        await using (var locks = new NpgsqlCommand("SELECT id,price,status,active_hold_id FROM trip_seats WHERE trip_id=@trip AND (id=ANY(@ids) OR active_hold_id=@hold) ORDER BY id FOR UPDATE", connection, tx))
        {
            locks.Parameters.AddWithValue("trip",hold.TripId);
            locks.Parameters.AddWithValue("ids",seatIds.ToArray());
            locks.Parameters.AddWithValue("hold",hold.Id);
            await using var reader=await locks.ExecuteReaderAsync(cancellationToken);
            while(await reader.ReadAsync(cancellationToken))
            {
                var id=reader.GetGuid(0);
                if(seatIds.Contains(id) && (reader.GetString(2)=="AVAILABLE" || reader.GetString(2)=="HELD" && !reader.IsDBNull(3) && reader.GetGuid(3)==hold.Id)) prices[id]=reader.GetInt64(1);
            }
        }
        if(prices.Count!=seatIds.Count) return null;
        await using (var update = new NpgsqlCommand("""
            UPDATE trip_seats SET status='AVAILABLE',active_hold_id=NULL,updated_at=NOW(),row_version=row_version+1 WHERE active_hold_id=@hold AND NOT(id=ANY(@ids));
            DELETE FROM seat_hold_items WHERE seat_hold_id=@hold;
            INSERT INTO seat_hold_items(seat_hold_id,trip_seat_id,seat_code,unit_price) SELECT @hold,id,seat_code,price FROM trip_seats WHERE id=ANY(@ids) AND trip_id=@trip;
            UPDATE trip_seats SET status='HELD',active_hold_id=@hold,updated_at=NOW(),row_version=row_version+1 WHERE id=ANY(@ids) AND trip_id=@trip;
            UPDATE seat_holds SET total_amount=@total WHERE id=@hold;
            """,connection,tx))
        {
            update.Parameters.AddWithValue("hold",hold.Id);
            update.Parameters.AddWithValue("trip",hold.TripId);
            update.Parameters.AddWithValue("ids",seatIds.ToArray());
            update.Parameters.AddWithValue("total",prices.Values.Sum());
            await update.ExecuteNonQueryAsync(cancellationToken);
        }
        await tx.CommitAsync(cancellationToken);
        return hold with {TotalAmount=prices.Values.Sum(),Seats=await ListSeatsByIds(seatIds,cancellationToken)};
    }

    public async Task<SeatHoldRecord?> GetHoldByTokenHashAsync(string tokenHash, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, trip_id, customer_id_external, idempotency_key, hold_token_hash, status, total_amount, currency, created_at, expires_at
            FROM seat_holds WHERE hold_token_hash = @hash;
            """, connection);
        command.Parameters.AddWithValue("hash", tokenHash);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var holdId = reader.GetGuid(0);
        var tripId = reader.GetGuid(1);
        var customer = reader.GetGuid(2);
        var idem = reader.GetString(3);
        var hash = reader.GetString(4);
        var status = reader.GetString(5);
        var total = reader.GetInt64(6);
        var currency = reader.GetString(7);
        var created = new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc));
        var expires = new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc));
        await reader.CloseAsync();
        var seats = await QuerySeats("""
            SELECT s.id, s.trip_id, s.source_seat_id_external, s.seat_code, s.seat_type, s.deck, s.row_no, s.column_no, s.price, s.status, s.row_version
            FROM trip_seats s JOIN seat_hold_items i ON i.trip_seat_id = s.id WHERE i.seat_hold_id = @trip
            """, holdId, cancellationToken);
        return new SeatHoldRecord(holdId, tripId, customer, idem, hash, "", status, total, currency, created, expires, seats);
    }

    public async Task ReleaseHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE seat_holds SET status = 'RELEASED', released_at = NOW() WHERE id = @id AND status = 'ACTIVE';
            UPDATE trip_seats SET status = 'AVAILABLE', active_hold_id = NULL, updated_at = NOW() WHERE active_hold_id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", holdId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<BookingRecord?> CreateBookingAsync(BookingRecord booking, IReadOnlyList<BookingItemRecord> items, IReadOnlyList<PassengerRecord> passengers, Guid holdId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
        if (booking.CouponCode is not null)
        {
            // Lock the rule until commit: an admin cannot change its terms mid-booking.
            await using var couponCheck = new NpgsqlCommand("""
                SELECT 1 FROM coupons WHERE code=@coupon AND active AND starts_at<=NOW() AND expires_at>NOW()
                  AND (organization_id IS NULL OR organization_id=@org) AND minimum<=@subtotal
                  AND LEAST(cap, FLOOR(@subtotal::numeric * percent / 100)::bigint)=@discount FOR SHARE;
                """, connection, tx);
            couponCheck.Parameters.AddWithValue("coupon", booking.CouponCode);
            couponCheck.Parameters.AddWithValue("org", booking.OrganizationId);
            couponCheck.Parameters.AddWithValue("subtotal", booking.Subtotal);
            couponCheck.Parameters.AddWithValue("discount", booking.Discount);
            if (await couponCheck.ExecuteScalarAsync(cancellationToken) is null) throw new CouponUnavailableException();
        }
        await using (var deferred = new NpgsqlCommand("SET CONSTRAINTS ALL DEFERRED;", connection, tx))
        {
            await deferred.ExecuteNonQueryAsync(cancellationToken);
        }
        await using (var consume = new NpgsqlCommand("""
            UPDATE seat_holds SET status = 'CONSUMED', consumed_at = NOW() WHERE id = @id AND status = 'ACTIVE';
            """, connection, tx))
        {
            consume.Parameters.AddWithValue("id", holdId);
            if (await consume.ExecuteNonQueryAsync(cancellationToken) != 1)
            {
                await tx.RollbackAsync(cancellationToken);
                return null;
            }
        }

        await using (var insert = new NpgsqlCommand("""
            INSERT INTO bookings (
              id, booking_code, seat_hold_id, trip_id, organization_id_external, customer_id_external, contact_name,
              contact_email, contact_phone, payment_channel, status, subtotal_amount, discount_amount, service_fee_amount,
              total_amount, currency, expires_at, created_at, updated_at, coupon_code)
            VALUES (
              @id, @code, @hold, @trip, @org, @customer, @name, @email, @phone, @channel, @status, @sub, @discount, 0,
              @total, @currency, @expires, NOW(), NOW(), @coupon);
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("id", booking.Id);
            insert.Parameters.AddWithValue("code", booking.Code);
            insert.Parameters.AddWithValue("hold", holdId);
            insert.Parameters.AddWithValue("trip", booking.TripId);
            insert.Parameters.AddWithValue("org", booking.OrganizationId);
            insert.Parameters.AddWithValue("customer", booking.CustomerId);
            insert.Parameters.AddWithValue("name", booking.ContactName);
            insert.Parameters.AddWithValue("email", booking.ContactEmail);
            insert.Parameters.AddWithValue("phone", booking.ContactPhone);
            insert.Parameters.AddWithValue("channel", booking.PaymentChannel);
            insert.Parameters.AddWithValue("status", booking.Status);
            insert.Parameters.AddWithValue("sub", booking.Subtotal);
            insert.Parameters.AddWithValue("discount", booking.Discount);
            insert.Parameters.AddWithValue("coupon", NpgsqlTypes.NpgsqlDbType.Varchar, (object?)booking.CouponCode ?? DBNull.Value);
            insert.Parameters.AddWithValue("total", booking.Total);
            insert.Parameters.AddWithValue("currency", booking.Currency);
            insert.Parameters.AddWithValue("expires", booking.ExpiresAt.UtcDateTime);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var item in items)
        {
            await using var itemCmd = new NpgsqlCommand("""
                INSERT INTO booking_items (id, booking_id, trip_seat_id, source_seat_id_external, seat_code, unit_price, discount_amount, line_total, created_at)
                VALUES (@id, @booking, @seat, @source, @code, @price, @discount, @price - @discount, NOW());
                UPDATE trip_seats SET status = 'BOOKED', active_hold_id = NULL, active_booking_item_id = @id, updated_at = NOW()
                WHERE id = @seat;
                """, connection, tx);
            itemCmd.Parameters.AddWithValue("id", item.Id);
            itemCmd.Parameters.AddWithValue("booking", booking.Id);
            itemCmd.Parameters.AddWithValue("seat", item.TripSeatId);
            itemCmd.Parameters.AddWithValue("source", item.SourceSeatId);
            itemCmd.Parameters.AddWithValue("code", item.SeatCode);
            itemCmd.Parameters.AddWithValue("price", item.UnitPrice);
            itemCmd.Parameters.AddWithValue("discount", item.Discount);
            await itemCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var passenger in passengers)
        {
            await using var pax = new NpgsqlCommand("""
                INSERT INTO passengers (
                  id, booking_item_id, full_name, pickup_stop_id_external, dropoff_stop_id_external, document_type,
                  document_number_ciphertext, document_number_last4, created_at)
                VALUES (@id, @item, @name, @pickup, @dropoff, @docType, @cipher, @last4, NOW());
                """, connection, tx);
            pax.Parameters.AddWithValue("id", passenger.Id);
            pax.Parameters.AddWithValue("item", passenger.BookingItemId);
            pax.Parameters.AddWithValue("name", passenger.FullName);
            pax.Parameters.AddWithValue("pickup", passenger.PickupStopId);
            pax.Parameters.AddWithValue("dropoff", passenger.DropoffStopId);
            pax.Parameters.AddWithValue("docType", (object?)passenger.DocumentType ?? DBNull.Value);
            pax.Parameters.AddWithValue("cipher", (object?)passenger.DocumentCipher ?? DBNull.Value);
            pax.Parameters.AddWithValue("last4", (object?)passenger.Last4 ?? DBNull.Value);
            await pax.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
        return await GetBookingAsync(booking.Id, cancellationToken);
        }
        catch (PostgresException exception) when (exception.SqlState is "23505" or "23514" or "23503")
        {
            await tx.RollbackAsync(cancellationToken);
            return null;
        }
    }

    public async Task<BookingRecord?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(BookingSelect + " WHERE b.id = @id;", connection);
        command.Parameters.AddWithValue("id", bookingId);
        var items = await ReadBookings(command, cancellationToken);
        return items.Count == 0 ? null : items[0];
    }

    public async Task<BookingRecord?> GetBookingByCodeAsync(string code, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(BookingSelect + " WHERE b.booking_code = @code;", connection);
        command.Parameters.AddWithValue("code", code);
        return (await ReadBookings(command, cancellationToken)).SingleOrDefault();
    }

    public Task<IReadOnlyList<BookingRecord>> ListBookingsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken) =>
        QueryBookings(BookingSelect + " WHERE b.customer_id_external = @id ORDER BY b.created_at DESC OFFSET @offset LIMIT @limit", customerId, page, size, cancellationToken);

    public Task<long> CountBookingsForCustomerAsync(Guid customerId, CancellationToken cancellationToken) =>
        CountAsync("SELECT COUNT(*) FROM bookings WHERE customer_id_external = @id", customerId, cancellationToken);

    public async Task<IReadOnlyList<BookingReference>> FindBookingReferencesAsync(
        string? search, Guid[] ids, Guid? organizationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, booking_code, created_at FROM bookings
            WHERE (@org::uuid IS NULL OR organization_id_external = @org)
              AND (cardinality(@ids) = 0 OR id = ANY(@ids))
              AND (@search = '' OR strpos(lower(booking_code), lower(@search)) > 0);
            """, connection);
        command.Parameters.AddWithValue("org", (object?)organizationId ?? DBNull.Value);
        command.Parameters.AddWithValue("ids", ids);
        command.Parameters.AddWithValue("search", search ?? "");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<BookingReference>();
        while (await reader.ReadAsync(cancellationToken))
            items.Add(new BookingReference(reader.GetGuid(0), reader.GetString(1))
            {
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(2)
            });
        return items;
    }

    public async Task<(IReadOnlyList<BookingRecord> Items, long Total)> SearchBookingsAsync(
        BookingListFilter filters, int page, int size, CancellationToken cancellationToken)
    {
        const string where = """
             WHERE (@org::uuid IS NULL OR b.organization_id_external = @org)
               AND (cardinality(@bookingIds) = 0 OR b.id = ANY(@bookingIds))
               AND (@status = '' OR b.status = @status)
               AND (@createdFrom IS NULL OR b.created_at >= @createdFrom)
               AND (@createdBefore IS NULL OR b.created_at < @createdBefore)
               AND (@operatorStatus = '' OR @operatorStatus = CASE
                   WHEN b.status = 'CANCELLED' THEN 'cancelled'
                   WHEN b.status IN ('CONFIRMED', 'PAID', 'COMPLETED', 'CHECKED_IN') THEN 'confirmed'
                   ELSE 'pending' END)
               AND (@operatorPayment = '' OR @operatorPayment = CASE
                   WHEN b.status IN ('PAID', 'COMPLETED', 'CHECKED_IN')
                        OR (b.status = 'CONFIRMED' AND b.payment_channel <> 'PAY_LATER') THEN 'paid'
                   ELSE 'unpaid' END)
               AND (@search = '' OR b.organization_id_external = ANY(@matchingOrgs)
                    OR strpos(lower(concat_ws(' ', b.booking_code, b.contact_name, b.contact_phone, b.id)), lower(@search)) > 0)
            """;
        await using var connection = await OpenAsync(cancellationToken);
        await using var count = new NpgsqlCommand("SELECT COUNT(*) FROM bookings b" + where, connection);
        await using var select = new NpgsqlCommand(BookingSelect + where
            + " ORDER BY b.created_at DESC, b.id DESC OFFSET @offset LIMIT @limit", connection);
        foreach (var query in new[] { count, select })
        {
            query.Parameters.AddWithValue("org", (object?)filters.OrganizationId ?? DBNull.Value);
            query.Parameters.AddWithValue("status", filters.Status ?? "");
            query.Parameters.AddWithValue("search", filters.Search ?? "");
            query.Parameters.AddWithValue("matchingOrgs", filters.MatchingOrganizations);
            query.Parameters.AddWithValue("bookingIds", filters.BookingIds ?? Array.Empty<Guid>());
            query.Parameters.AddWithValue("createdFrom", NpgsqlTypes.NpgsqlDbType.TimestampTz, (object?)filters.CreatedFrom ?? DBNull.Value);
            query.Parameters.AddWithValue("createdBefore", NpgsqlTypes.NpgsqlDbType.TimestampTz, (object?)filters.CreatedBefore ?? DBNull.Value);
            query.Parameters.AddWithValue("operatorStatus", filters.OperatorStatus ?? "");
            query.Parameters.AddWithValue("operatorPayment", filters.OperatorPayment ?? "");
        }
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
        select.Parameters.AddWithValue("offset", (long)page * size);
        select.Parameters.AddWithValue("limit", size);
        return (await ReadBookings(select, cancellationToken), total);
    }

    public async Task<bool> ApplyPaidAsync(Guid bookingId, IReadOnlyList<TicketRecord> tickets, CancellationToken cancellationToken, Guid correlationId = default)
    {
        _ = tickets;
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var update = new NpgsqlCommand("""
            UPDATE bookings
            SET status = CASE WHEN payment_channel = 'PREPAID' THEN 'PAID' ELSE status END,
                paid_at = CASE WHEN payment_channel = 'PREPAID' THEN NOW() ELSE paid_at END,
                updated_at = NOW(), row_version = row_version + 1
            WHERE id = @id AND (
              (payment_channel = 'PREPAID' AND status = 'PENDING_PAYMENT' AND expires_at > NOW())
              OR (payment_channel = 'PAY_LATER' AND status = 'CONFIRMED'
                AND NOT EXISTS (SELECT 1 FROM tickets WHERE booking_id = @id)))
              AND NOT EXISTS (SELECT 1 FROM booking_items i JOIN trip_seats s ON s.id = i.trip_seat_id
                WHERE i.booking_id = @id AND (s.status <> 'BOOKED' OR s.active_booking_item_id IS DISTINCT FROM i.id));
            """, connection, tx))
        {
            update.Parameters.AddWithValue("id", bookingId);
            if (await update.ExecuteNonQueryAsync(cancellationToken) == 0) return false;
        }

        await using (var select = new NpgsqlCommand("""
            SELECT i.id, i.booking_id, i.seat_code, p.full_name, b.trip_id, b.customer_id_external, b.payment_channel
            FROM booking_items i
            JOIN bookings b ON b.id = i.booking_id
            JOIN passengers p ON p.booking_item_id = i.id
            WHERE i.booking_id = @id
              AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.booking_item_id = i.id);
            """, connection, tx))
        {
            select.Parameters.AddWithValue("id", bookingId);
            await using var reader = await select.ExecuteReaderAsync(cancellationToken);
            var rows = new List<(Guid ItemId, Guid BookingId, string Seat, string Name, Guid TripId, Guid Customer, string Channel)>();
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetGuid(4), reader.GetGuid(5), reader.GetString(6)));
            }

            await reader.CloseAsync();
            foreach (var row in rows)
            {
                var token = Convert.ToHexString(ids.NewUuidV7().ToByteArray());
                await using var insert = new NpgsqlCommand("""
                    INSERT INTO tickets (
                      id, booking_id, booking_item_id, public_code, qr_token_hash, payment_channel, status, issued_at)
                    VALUES (@id, @booking, @item, @code, @hash, @channel, 'ISSUED', NOW());
                    """, connection, tx);
                var ticketId = ids.NewUuidV7();
                insert.Parameters.AddWithValue("id", ticketId);
                insert.Parameters.AddWithValue("booking", row.BookingId);
                insert.Parameters.AddWithValue("item", row.ItemId);
                insert.Parameters.AddWithValue("code", "TK" + ticketId.ToString("N")[^12..].ToUpperInvariant());
                insert.Parameters.AddWithValue("hash", token);
                insert.Parameters.AddWithValue("channel", row.Channel);
                await insert.ExecuteNonQueryAsync(cancellationToken);
            }
        }

        foreach (var type in new[] { "BookingPaid", "TicketIssued" })
        {
            await using var outbox = new NpgsqlCommand("""
                INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
                SELECT @event, @type, 1, b.id,
                    jsonb_build_object('eventId', @event, 'eventType', @type, 'version', 1, 'occurredAt', NOW(),
                      'producer', 'booking', 'correlationId', @correlation, 'aggregateId', b.id, 'tenantId', b.organization_id_external,
                      'payload', jsonb_build_object('bookingId', b.id, 'bookingCode', b.booking_code,
                        'organizationId', b.organization_id_external, 'customerId', b.customer_id_external, 'tripId', b.trip_id,
                        'status', b.status, 'paymentChannel', b.payment_channel, 'currency', b.currency,
                        'seatCount', (SELECT COUNT(*) FROM booking_items WHERE booking_id = b.id),
                        'grossAmount', b.total_amount, 'netAmount', b.total_amount, 'cancellationFee', 0, 'refundedAmount', 0,
                        'bookedAt', b.created_at, 'expiresAt', b.expires_at, 'routeName', '',
                        'departureAt', (SELECT departure_at FROM trip_snapshots WHERE trip_id = b.trip_id))), @correlation, NOW(), 0
                FROM bookings b WHERE b.id = @booking AND (@type <> 'BookingPaid' OR b.payment_channel = 'PREPAID');
                """, connection, tx);
            outbox.Parameters.AddWithValue("event", ids.NewUuidV7());
            outbox.Parameters.AddWithValue("type", type);
            outbox.Parameters.AddWithValue("correlation", correlationId);
            outbox.Parameters.AddWithValue("booking", bookingId);
            await outbox.ExecuteNonQueryAsync(cancellationToken);
        }
        await tx.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<CancellationPreviewRecord> InsertPreviewAsync(CancellationPreviewRecord preview, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO cancellation_previews (
              id, booking_id, requested_by_external, booking_item_ids, policy_version, eligible_amount, fee_rate,
              fee_amount, refund_amount, expires_at, created_at)
            VALUES (@id, @booking, @by, @items, @policy, @eligible, @rate, @fee, @refund, @expires, NOW());
            """, connection);
        command.Parameters.AddWithValue("id", preview.Id);
        command.Parameters.AddWithValue("booking", preview.BookingId);
        command.Parameters.AddWithValue("by", preview.RequestedBy);
        command.Parameters.AddWithValue("items", preview.BookingItemIds.ToArray());
        command.Parameters.AddWithValue("policy", preview.PolicyVersion);
        command.Parameters.AddWithValue("eligible", preview.Eligible);
        command.Parameters.AddWithValue("rate", preview.FeeRate);
        command.Parameters.AddWithValue("fee", preview.Fee);
        command.Parameters.AddWithValue("refund", preview.Refund);
        command.Parameters.AddWithValue("expires", preview.ExpiresAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return preview;
    }

    public async Task<CancellationPreviewRecord?> GetPreviewAsync(Guid previewId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, booking_id, requested_by_external, booking_item_ids, policy_version, eligible_amount, fee_rate,
                   fee_amount, refund_amount, expires_at, consumed_at
            FROM cancellation_previews WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", previewId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new CancellationPreviewRecord(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            (Guid[])reader.GetValue(3),
            (Guid[])reader.GetValue(3),
            reader.GetString(4),
            reader.GetInt64(5),
            reader.GetDecimal(6),
            reader.GetInt64(7),
            reader.GetInt64(8),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc)),
            reader.IsDBNull(10) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(10), DateTimeKind.Utc)));
    }

    public async Task CancelAsync(Guid bookingId, IReadOnlyList<Guid> ticketIds, long fee, long refund, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        var tickets = ticketIds.ToArray();
        await using (var ticketsCmd = new NpgsqlCommand("""
            UPDATE tickets SET status = 'CANCELLED', cancelled_at = NOW()
            WHERE status = 'ISSUED' AND (id = ANY(@tickets) OR booking_item_id = ANY(@tickets));
            """, connection, tx))
        {
            ticketsCmd.Parameters.AddWithValue("tickets", tickets);
            await ticketsCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var seats = new NpgsqlCommand("""
            UPDATE trip_seats s
            SET status = 'AVAILABLE', active_booking_item_id = NULL, updated_at = NOW()
            FROM tickets t JOIN booking_items i ON i.id = t.booking_item_id
            WHERE (t.id = ANY(@tickets) OR t.booking_item_id = ANY(@tickets)) AND s.id = i.trip_seat_id;
            """, connection, tx))
        {
            seats.Parameters.AddWithValue("tickets", tickets);
            await seats.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var booking = new NpgsqlCommand("""
            UPDATE bookings
            SET status = CASE WHEN payment_channel = 'PREPAID' THEN 'REFUND_PENDING' ELSE 'CANCELLED' END,
                cancelled_at = NOW(), cancellation_fee = @fee, refund_amount = @refund, updated_at = NOW(),
                row_version = row_version + 1
            WHERE id = @booking;
            """, connection, tx))
        {
            booking.Parameters.AddWithValue("fee", fee);
            booking.Parameters.AddWithValue("refund", refund);
            booking.Parameters.AddWithValue("booking", bookingId);
            await booking.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var preview = new NpgsqlCommand("""
            UPDATE cancellation_previews SET consumed_at = NOW() WHERE booking_id = @booking AND consumed_at IS NULL;
            """, connection, tx))
        {
            preview.Parameters.AddWithValue("booking", bookingId);
            await preview.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public Task<IReadOnlyList<TicketRecord>> ListTicketsForBookingAsync(Guid bookingId, CancellationToken cancellationToken) =>
        QueryTickets(" WHERE b.id = @id ORDER BY i.seat_code", bookingId, 0, 100, cancellationToken);

    public Task<IReadOnlyList<TicketRecord>> ListTicketsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken) =>
        QueryTickets(" WHERE b.customer_id_external = @id ORDER BY t.issued_at DESC OFFSET @offset LIMIT @limit", customerId, page, size, cancellationToken);

    public Task<long> CountTicketsForCustomerAsync(Guid customerId, CancellationToken cancellationToken) =>
        CountAsync("SELECT COUNT(*) FROM tickets t JOIN bookings b ON b.id = t.booking_id WHERE b.customer_id_external = @id", customerId, cancellationToken);

    public async Task<TicketRecord?> GetTicketAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var items = await QueryTickets(" WHERE t.id = @id", ticketId, 0, 1, cancellationToken);
        return items.Count == 0 ? null : items[0];
    }

    public async Task<TicketRecord?> GetTicketByHashAsync(string tokenHash, CancellationToken cancellationToken)
    {
        var items = await QueryTickets(" WHERE t.qr_token_hash = @hash", Guid.Empty, 0, 1, cancellationToken, tokenHash);
        return items.Count == 0 ? null : items[0];
    }

    public async Task<TicketRecord?> GetTicketByPublicCodeAsync(string publicCode, CancellationToken cancellationToken)
    {
        var items = await QueryTickets(" WHERE upper(t.public_code) = upper(@code)", Guid.Empty, 0, 1, cancellationToken, code: publicCode);
        return items.Count == 0 ? null : items[0];
    }

    public async Task CheckInAsync(Guid ticketId, Guid actorId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE tickets
            SET status = 'CHECKED_IN', checked_in_at = NOW(), checked_in_by_external = @actor, row_version = row_version + 1
            WHERE id = @id AND status = 'ISSUED';
            """, connection);
        command.Parameters.AddWithValue("id", ticketId);
        command.Parameters.AddWithValue("actor", actorId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<ManifestDto> GetManifestAsync(Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT t.id, p.full_name, i.seat_code,
              CASE
                WHEN p.pickup_stop_id_external = s.origin_stop_id_external THEN 'Điểm đi'
                WHEN p.pickup_stop_id_external = s.destination_stop_id_external THEN 'Điểm đến'
                ELSE 'Điểm đón'
              END,
              t.status
            FROM tickets t
            JOIN booking_items i ON i.id = t.booking_item_id
            JOIN passengers p ON p.booking_item_id = i.id
            JOIN bookings b ON b.id = t.booking_id
            JOIN trip_snapshots s ON s.trip_id = b.trip_id
            WHERE b.trip_id = @trip
            ORDER BY i.seat_code;
            """, connection);
        command.Parameters.AddWithValue("trip", tripId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var passengers = new List<ManifestPassengerDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            passengers.Add(new ManifestPassengerDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
        }

        return new ManifestDto(tripId, DateTimeOffset.UtcNow, passengers);
    }

    public async Task<IReadOnlyList<ManifestCount>> GetManifestCountsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT b.trip_id, count(*)::int, count(*) FILTER (WHERE t.status = 'CHECKED_IN')::int
            FROM bookings b
            JOIN trip_snapshots s ON s.trip_id = b.trip_id AND s.organization_id_external = @org
            JOIN tickets t ON t.booking_id = b.id
            JOIN passengers p ON p.booking_item_id = t.booking_item_id
            WHERE b.organization_id_external = @org
            GROUP BY b.trip_id;
            """, connection);
        command.Parameters.AddWithValue("org", organizationId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var counts = new List<ManifestCount>();
        while (await reader.ReadAsync(cancellationToken))
            counts.Add(new ManifestCount(reader.GetGuid(0), reader.GetInt32(1), reader.GetInt32(2)));
        return counts;
    }

    public async Task<IReadOnlyList<CancelledSeat>> GetCancelledSeatsAsync(
        Guid organizationId, Guid[] bookings, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT b.id, i.seat_code FROM bookings b
            JOIN tickets t ON t.booking_id = b.id
            JOIN booking_items i ON i.id = t.booking_item_id
            WHERE b.organization_id_external = @org AND b.id = ANY(@bookings)
              AND t.status IN ('CANCELLED', 'REFUNDED')
            ORDER BY b.id, t.issued_at DESC, t.id;
            """, connection);
        command.Parameters.AddWithValue("org", organizationId);
        command.Parameters.AddWithValue("bookings", bookings);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var seats = new List<CancelledSeat>();
        while (await reader.ReadAsync(cancellationToken))
            seats.Add(new CancelledSeat(reader.GetGuid(0), reader.GetString(1)));
        return seats;
    }

    private const string BookingSelect = """
        SELECT b.id, b.booking_code, b.seat_hold_id, b.trip_id, b.organization_id_external, b.customer_id_external,
               b.contact_name, b.contact_email, b.contact_phone, b.payment_channel, b.status, b.subtotal_amount,
               b.discount_amount, b.service_fee_amount, b.total_amount, b.currency, b.expires_at, b.row_version, b.created_at, b.coupon_code
        FROM bookings b
        """;

    private async Task<IReadOnlyList<InventorySeat>> ListSeatsByIds(IReadOnlyList<Guid> ids, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no, price, status, row_version
            FROM trip_seats WHERE id = ANY(@ids);
            """, connection);
        command.Parameters.AddWithValue("ids", ids.ToArray());
        return await ReadSeats(command, cancellationToken);
    }

    private async Task<IReadOnlyList<InventorySeat>> QuerySeats(string sql, Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("trip", tripId);
        return await ReadSeats(command, cancellationToken);
    }

    private static async Task<IReadOnlyList<InventorySeat>> ReadSeats(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var seats = new List<InventorySeat>();
        while (await reader.ReadAsync(cancellationToken))
        {
            seats.Add(new InventorySeat(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetInt16(5),
                reader.GetInt16(6),
                reader.GetInt16(7),
                reader.GetInt64(8),
                reader.GetString(9),
                reader.GetInt64(10)));
        }

        return seats;
    }

    private async Task<IReadOnlyList<BookingRecord>> QueryBookings(string sql, Guid id, int page, int size, CancellationToken cancellationToken, Guid? org = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("offset", page * Math.Max(size, 1));
        command.Parameters.AddWithValue("limit", size <= 0 ? 20 : size);
        command.Parameters.AddWithValue("org", (object?)org ?? DBNull.Value);
        return await ReadBookings(command, cancellationToken);
    }

    private async Task<IReadOnlyList<BookingRecord>> ReadBookings(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var bookings = new List<BookingRecord>();
        while (await reader.ReadAsync(cancellationToken))
        {
            bookings.Add(new BookingRecord(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetGuid(2),
                reader.GetGuid(3),
                reader.GetGuid(4),
                reader.GetGuid(5),
                reader.GetString(6),
                reader.GetString(7),
                reader.GetString(8),
                reader.GetString(9),
                reader.GetString(10),
                reader.GetInt64(11),
                reader.GetInt64(12),
                reader.GetInt64(13),
                reader.GetInt64(14),
                reader.GetString(15),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(16), DateTimeKind.Utc)),
                reader.GetInt64(17),
                [], new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(18), DateTimeKind.Utc)), reader.IsDBNull(19) ? null : reader.GetString(19)));
        }

        await reader.CloseAsync();
        if (bookings.Count == 0) return bookings;
        var passengers = await LoadPassengers(command.Connection!, bookings.Select(booking => booking.Id).ToArray(), cancellationToken);
        for (var i = 0; i < bookings.Count; i++)
        {
            var details = passengers[bookings[i].Id];
            bookings[i] = bookings[i] with
            {
                Items = details.Select(item => item.Passenger).ToArray(),
                SeatCodes = details.Select(item => item.SeatCode).ToArray()
            };
        }

        return bookings;
    }

    private static async Task<ILookup<Guid, (PassengerInput Passenger, string SeatCode)>> LoadPassengers(
        NpgsqlConnection connection, Guid[] bookingIds, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            SELECT i.trip_seat_id, p.full_name, p.document_type, p.pickup_stop_id_external, p.dropoff_stop_id_external, i.booking_id, i.seat_code
            FROM booking_items i JOIN passengers p ON p.booking_item_id = i.id WHERE i.booking_id = ANY(@ids);
            """, connection);
        command.Parameters.AddWithValue("ids", bookingIds);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<(Guid BookingId, (PassengerInput Passenger, string SeatCode) Detail)>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add((reader.GetGuid(5), (new PassengerInput(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                null,
                reader.GetGuid(3),
                reader.GetGuid(4)), reader.GetString(6))));
        }

        return items.ToLookup(item => item.BookingId, item => item.Detail);
    }

    private async Task<IReadOnlyList<TicketRecord>> QueryTickets(string where, Guid id, int page, int size, CancellationToken cancellationToken, string? hash = null, string? code = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT t.id, t.booking_id, t.booking_item_id, b.trip_id, b.customer_id_external, t.public_code, t.qr_token_hash,
                   t.payment_channel, t.status, p.full_name, i.seat_code, i.line_total, t.issued_at, t.checked_in_at, t.row_version,
                   b.booking_code, i.trip_seat_id, p.pickup_stop_id_external, p.dropoff_stop_id_external
            FROM tickets t
            JOIN bookings b ON b.id = t.booking_id
            JOIN booking_items i ON i.id = t.booking_item_id
            JOIN passengers p ON p.booking_item_id = i.id
            """ + where, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("offset", page * Math.Max(size, 1));
        command.Parameters.AddWithValue("limit", size <= 0 ? 20 : size);
        command.Parameters.AddWithValue("hash", (object?)hash ?? DBNull.Value);
        command.Parameters.AddWithValue("code", (object?)code ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<TicketRecord>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new TicketRecord(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetGuid(3),
                reader.GetGuid(4),
                reader.GetString(5),
                reader.GetString(6),
                null,
                reader.GetString(7),
                reader.GetString(8),
                reader.GetString(9),
                reader.GetString(10),
                reader.GetInt64(11),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(12), DateTimeKind.Utc)),
                reader.IsDBNull(13) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(13), DateTimeKind.Utc)),
                reader.GetInt64(14))
            {
                Journey = new TicketJourney(reader.GetString(15), reader.GetGuid(16), reader.GetGuid(17), reader.GetGuid(18))
            });
        }

        return items;
    }

    private async Task<long> CountAsync(string sql, Guid id, CancellationToken cancellationToken, Guid? org = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("org", (object?)org ?? DBNull.Value);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private static string AddDriverAssignment(string? farePolicySnapshot, Guid? driverUserId)
    {
        var root = JsonNode.Parse(string.IsNullOrWhiteSpace(farePolicySnapshot) ? "{}" : farePolicySnapshot) as JsonObject
            ?? new JsonObject();
        if (driverUserId is not null)
        {
            root["driverUserId"] = driverUserId.Value.ToString();
        }

        return root.ToJsonString();
    }
}
