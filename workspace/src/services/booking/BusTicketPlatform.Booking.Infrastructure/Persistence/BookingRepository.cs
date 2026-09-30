using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Ids;
using Npgsql;

namespace BusTicketPlatform.Booking.Infrastructure.Persistence;

public sealed class BookingRepository(BookingDatabaseOptions options, IIdGenerator ids) : IBookingRepository
{
    public async Task ImportTripAsync(TripPublishedMessage message, IReadOnlyList<InventorySeat> seats, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var upsert = new NpgsqlCommand("""
            INSERT INTO trip_snapshots (
              trip_id, organization_id_external, route_id_external, bus_id_external, origin_stop_id_external,
              destination_stop_id_external, departure_at, arrival_at, currency, status, sellable, source_trip_version,
              route_snapshot, bus_snapshot, fare_policy_snapshot, created_at, updated_at)
            VALUES (
              @id, @org, @route, @bus, @origin, @dest, @dep, @arr, @currency, @status, true, @version,
              CAST(@routeSnap AS jsonb), CAST(@busSnap AS jsonb), CAST(@fareSnap AS jsonb), NOW(), NOW())
            ON CONFLICT (trip_id) DO UPDATE
              SET status = EXCLUDED.status, sellable = true, updated_at = NOW();
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
            upsert.Parameters.AddWithValue("status", message.Status == "DRAFT" ? "SCHEDULED" : message.Status);
            upsert.Parameters.AddWithValue("version", message.SourceTripVersion);
            upsert.Parameters.AddWithValue("routeSnap", message.RouteSnapshot ?? "{}");
            upsert.Parameters.AddWithValue("busSnap", message.BusSnapshot ?? "{}");
            upsert.Parameters.AddWithValue("fareSnap", message.FarePolicySnapshot ?? "{}");
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

    public async Task ExpireHoldsAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            WITH expired AS (
              UPDATE seat_holds
              SET status = 'EXPIRED', released_at = NOW()
              WHERE status = 'ACTIVE' AND expires_at <= NOW()
              RETURNING id
            )
            UPDATE trip_seats s
            SET status = 'AVAILABLE', active_hold_id = NULL, updated_at = NOW()
            FROM expired
            WHERE s.active_hold_id = expired.id;
            """, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InventorySeat>> ListSeatsAsync(Guid tripId, CancellationToken cancellationToken) =>
        await QuerySeats("SELECT id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no, price, status, row_version FROM trip_seats WHERE trip_id = @trip ORDER BY deck, row_no, column_no", tripId, cancellationToken);

    public async Task<TripSnapshot?> GetTripAsync(Guid tripId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT trip_id, organization_id_external, origin_stop_id_external, destination_stop_id_external, departure_at,
                   sellable, status, currency,
                   COALESCE(fare_policy_snapshot->>'allowPayLater', 'false') = 'true',
                   COALESCE(fare_policy_snapshot->>'policyVersion', 'cancel-mvp-v1')
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
            reader.GetString(9));
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
              total_amount, currency, expires_at, created_at, updated_at)
            VALUES (
              @id, @code, @hold, @trip, @org, @customer, @name, @email, @phone, @channel, @status, @sub, 0, 0,
              @total, @currency, @expires, NOW(), NOW());
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
            insert.Parameters.AddWithValue("total", booking.Total);
            insert.Parameters.AddWithValue("currency", booking.Currency);
            insert.Parameters.AddWithValue("expires", booking.ExpiresAt.UtcDateTime);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var item in items)
        {
            await using var itemCmd = new NpgsqlCommand("""
                INSERT INTO booking_items (id, booking_id, trip_seat_id, source_seat_id_external, seat_code, unit_price, line_total, created_at)
                VALUES (@id, @booking, @seat, @source, @code, @price, @price, NOW());
                UPDATE trip_seats SET status = 'BOOKED', active_hold_id = NULL, active_booking_item_id = @id, updated_at = NOW()
                WHERE id = @seat;
                """, connection, tx);
            itemCmd.Parameters.AddWithValue("id", item.Id);
            itemCmd.Parameters.AddWithValue("booking", booking.Id);
            itemCmd.Parameters.AddWithValue("seat", item.TripSeatId);
            itemCmd.Parameters.AddWithValue("source", item.SourceSeatId);
            itemCmd.Parameters.AddWithValue("code", item.SeatCode);
            itemCmd.Parameters.AddWithValue("price", item.UnitPrice);
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

    public Task<IReadOnlyList<BookingRecord>> ListBookingsForCustomerAsync(Guid customerId, int page, int size, CancellationToken cancellationToken) =>
        QueryBookings(BookingSelect + " WHERE b.customer_id_external = @id ORDER BY b.created_at DESC OFFSET @offset LIMIT @limit", customerId, page, size, cancellationToken);

    public Task<long> CountBookingsForCustomerAsync(Guid customerId, CancellationToken cancellationToken) =>
        CountAsync("SELECT COUNT(*) FROM bookings WHERE customer_id_external = @id", customerId, cancellationToken);

    public Task<IReadOnlyList<BookingRecord>> SearchBookingsAsync(Guid? organizationId, int page, int size, CancellationToken cancellationToken) =>
        QueryBookings(
            BookingSelect + " WHERE (@org::uuid IS NULL OR b.organization_id_external = @org) ORDER BY b.created_at DESC OFFSET @offset LIMIT @limit",
            organizationId ?? Guid.Empty,
            page,
            size,
            cancellationToken,
            organizationId);

    public Task<long> CountBookingsAsync(Guid? organizationId, CancellationToken cancellationToken) =>
        CountAsync("SELECT COUNT(*) FROM bookings WHERE (@org::uuid IS NULL OR organization_id_external = @org)", organizationId ?? Guid.Empty, cancellationToken, organizationId);

    public async Task ApplyPaidAsync(Guid bookingId, IReadOnlyList<TicketRecord> tickets, CancellationToken cancellationToken)
    {
        _ = tickets;
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var update = new NpgsqlCommand("""
            UPDATE bookings
            SET status = CASE WHEN payment_channel = 'PREPAID' THEN 'PAID' ELSE status END,
                paid_at = CASE WHEN payment_channel = 'PREPAID' THEN NOW() ELSE paid_at END,
                updated_at = NOW(), row_version = row_version + 1
            WHERE id = @id;
            """, connection, tx))
        {
            update.Parameters.AddWithValue("id", bookingId);
            await update.ExecuteNonQueryAsync(cancellationToken);
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

        await tx.CommitAsync(cancellationToken);
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
                   fee_amount, refund_amount, expires_at
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
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc)));
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

    private const string BookingSelect = """
        SELECT b.id, b.booking_code, b.seat_hold_id, b.trip_id, b.organization_id_external, b.customer_id_external,
               b.contact_name, b.contact_email, b.contact_phone, b.payment_channel, b.status, b.subtotal_amount,
               b.discount_amount, b.service_fee_amount, b.total_amount, b.currency, b.expires_at, b.row_version
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
        var ids = new List<Guid>();
        while (await reader.ReadAsync(cancellationToken))
        {
            ids.Add(reader.GetGuid(0));
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
                []));
        }

        await reader.CloseAsync();
        for (var i = 0; i < bookings.Count; i++)
        {
            bookings[i] = bookings[i] with { Items = await LoadPassengers(bookings[i].Id, cancellationToken) };
        }

        return bookings;
    }

    private async Task<IReadOnlyList<PassengerInput>> LoadPassengers(Guid bookingId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT i.trip_seat_id, p.full_name, p.document_type, p.pickup_stop_id_external, p.dropoff_stop_id_external
            FROM booking_items i JOIN passengers p ON p.booking_item_id = i.id WHERE i.booking_id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", bookingId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<PassengerInput>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new PassengerInput(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                null,
                reader.GetGuid(3),
                reader.GetGuid(4)));
        }

        return items;
    }

    private async Task<IReadOnlyList<TicketRecord>> QueryTickets(string where, Guid id, int page, int size, CancellationToken cancellationToken, string? hash = null, string? code = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT t.id, t.booking_id, t.booking_item_id, b.trip_id, b.customer_id_external, t.public_code, t.qr_token_hash,
                   t.payment_channel, t.status, p.full_name, i.seat_code, t.issued_at, t.checked_in_at, t.row_version
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
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(11), DateTimeKind.Utc)),
                reader.IsDBNull(12) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(12), DateTimeKind.Utc)),
                reader.GetInt64(13)));
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
}
