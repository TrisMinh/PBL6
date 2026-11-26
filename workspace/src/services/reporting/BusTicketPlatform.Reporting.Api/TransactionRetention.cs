using System.Text.Json;
using Npgsql;

namespace BusTicketPlatform.Reporting.Api;

internal static class TransactionRetention
{
    private const string ClosedBookings = """
        SELECT b.id FROM bookings b JOIN trip_snapshots t ON t.trip_id=b.trip_id
        WHERE t.status IN ('COMPLETED','CANCELLED') AND NOT t.sellable AND t.arrival_at < @cutoff
          AND b.status IN ('COMPLETED','CANCELLED','REFUNDED','EXPIRED')
          AND GREATEST(b.updated_at, CASE b.status
            WHEN 'COMPLETED' THEN b.completed_at WHEN 'CANCELLED' THEN b.cancelled_at
            WHEN 'REFUNDED' THEN b.refunded_at ELSE b.expires_at END)<@cutoff
          AND NOT EXISTS (SELECT 1 FROM cancellation_previews c
              WHERE c.booking_id=b.id AND c.expires_at >= @cutoff AND c.consumed_at IS NULL)
        """;

    private const string BlockedPaymentBookings = """
        WITH candidates AS MATERIALIZED (
            SELECT id,booking_id_external,status,updated_at,provider FROM payments
            WHERE booking_id_external=ANY(@trips) AND archived_at IS NULL
        )
        SELECT booking_id_external FROM candidates
        WHERE status NOT IN ('SUCCEEDED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED')
           OR updated_at >= @cutoff
           OR (provider = 'SEPAY' AND status IN ('FAILED','CANCELLED'))
        UNION ALL
        SELECT c.booking_id_external FROM candidates c JOIN refunds r ON r.payment_id=c.id
        WHERE r.status <> 'SUCCEEDED' OR r.updated_at >= @cutoff
        UNION ALL
        SELECT c.booking_id_external FROM candidates c JOIN reconciliation_cases r ON r.payment_id=c.id
        WHERE r.status IN ('OPEN','INVESTIGATING')
        UNION ALL
        SELECT c.booking_id_external FROM candidates c JOIN payment_attempts a ON a.payment_id=c.id
        WHERE a.completed_at IS NULL OR a.completed_at >= @cutoff
        UNION ALL
        SELECT c.booking_id_external FROM candidates c JOIN webhook_receipts w ON w.payment_id=c.id
        WHERE w.status IN ('RECEIVED','VERIFIED')
        UNION ALL
        SELECT s.booking_id_external FROM booking_settlements s
        WHERE s.booking_id_external=ANY(@trips) AND s.collection_status='UNCOLLECTED'
          AND NOT EXISTS (SELECT 1 FROM operator_settlement_receipts r WHERE r.settlement_id=s.id)
        """;

    private static readonly (string Name, string Query)[] BookingFiles =
    [
        ("bookings", "SELECT b.* FROM bookings b WHERE b.id=ANY(@trips) ORDER BY b.id"),
        ("booking-items", "SELECT i.* FROM booking_items i WHERE i.booking_id=ANY(@trips) ORDER BY i.id"),
        ("passengers", """
            SELECT p.* FROM passengers p JOIN booking_items i ON i.id=p.booking_item_id
            WHERE i.booking_id=ANY(@trips) ORDER BY p.id
            """),
        ("tickets", """
            SELECT id, booking_id, booking_item_id, public_code, payment_channel, status,
                   issued_at, checked_in_at, checked_in_by_external, used_at, cancelled_at, refunded_at, row_version
            FROM tickets WHERE booking_id=ANY(@trips) ORDER BY id
            """),
        ("cancellation-previews", "SELECT c.* FROM cancellation_previews c WHERE c.booking_id=ANY(@trips) ORDER BY c.id"),
        ("booked-holds", """
            SELECT h.* FROM seat_holds h JOIN bookings b ON b.seat_hold_id=h.id
            WHERE b.id=ANY(@trips) ORDER BY h.id
            """),
        ("booked-hold-seats", """
            SELECT h.seat_hold_id, h.trip_seat_id FROM seat_hold_items h JOIN bookings b ON b.seat_hold_id=h.seat_hold_id
            WHERE b.id=ANY(@trips) ORDER BY h.seat_hold_id,h.trip_seat_id
            """)
    ];

    private static readonly (string Name, string Query)[] PaymentFiles =
    [
        ("payments", """
            SELECT id, booking_id_external, customer_id_external, organization_id_external, provider, logical_reference,
                   amount, currency, status, provider_order_reference, expires_at, succeeded_at, failed_at, cancelled_at,
                   refunded_at, failure_code, created_at, updated_at, checkout_method
            FROM payments WHERE id=ANY(@trips) ORDER BY id
            """),
        ("refunds", "SELECT r.* FROM refunds r WHERE r.payment_id=ANY(@trips) ORDER BY r.id"),
        ("payment-attempts", """
            SELECT id, payment_id, attempt_no, provider, provider_transaction_id,
                   status, response_code, response_metadata, created_at, completed_at
            FROM payment_attempts WHERE payment_id=ANY(@trips) ORDER BY id
            """),
        ("settlements", "SELECT s.* FROM booking_settlements s WHERE s.payment_id=ANY(@trips) ORDER BY s.id"),
        ("ledger", "SELECT l.* FROM ledger_entries l WHERE l.payment_id=ANY(@trips) ORDER BY l.id")
    ];

    public static async Task<Guid[]> EligibleAsync(Func<string, NpgsqlConnection> connect,
        DateTime cutoff, CancellationToken token)
    {
        await using var booking = connect("booking");
        await booking.OpenAsync(token);
        var candidates = await ReadIdsAsync(booking, null, ClosedBookings + " ORDER BY b.id", cutoff, [], token);
        await using var payment = connect("payment");
        await payment.OpenAsync(token);
        var result = new List<Guid>(candidates.Length);
        foreach (var batch in candidates.Chunk(2000))
        {
            var blocked = (await ReadIdsAsync(payment, null, BlockedPaymentBookings, cutoff, batch, token)).ToHashSet();
            result.AddRange(batch.Where(id => !blocked.Contains(id)));
        }
        return result.ToArray();
    }

    public static async Task<RetentionRemoval[]> PreviewRemovalsAsync(Func<string, NpgsqlConnection> connect,
        Guid[] bookingIds, DateTime cutoff, CancellationToken token)
    {
        if (bookingIds.Length == 0) return [];

        async Task<RetentionRemoval[]> BookingAsync()
        {
            await using var db = connect("booking");
            await db.OpenAsync(token);
            var result = new List<RetentionRemoval>();
            foreach (var (name, query) in BookingFiles)
            {
                var table = name switch
                {
                    "booked-holds" => "seat_holds",
                    "booked-hold-seats" => "seat_hold_items",
                    _ => name.Replace('-', '_')
                };
                result.Add(new("booking", table, await CountRowsAsync(db, query, cutoff, bookingIds, token)));
            }
            return result.ToArray();
        }

        async Task<RetentionRemoval[]> PaymentAsync()
        {
            await using var db = connect("payment");
            await db.OpenAsync(token);
            var result = new List<RetentionRemoval>();
            // Payment headers, settlements and ledger rows remain in PostgreSQL.
            foreach (var table in new[] { "refunds", "payment_attempts" })
            {
                var query = $"""
                    SELECT d.id FROM {table} d JOIN payments p ON p.id=d.payment_id
                    WHERE p.booking_id_external=ANY(@trips) AND p.archived_at IS NULL
                    """;
                result.Add(new("payment", table, await CountRowsAsync(db, query, cutoff, bookingIds, token)));
            }
            return result.ToArray();
        }

        return (await Task.WhenAll(BookingAsync(), PaymentAsync())).SelectMany(group => group).ToArray();
    }

    internal static async Task<long> CountRowsAsync(NpgsqlConnection db, string query,
        DateTime cutoff, Guid[] ids, CancellationToken token)
    {
        await using var command = RetentionData.Command(db, $"SELECT count(*) FROM ({query}) candidates", cutoff, ids);
        return (long)(await command.ExecuteScalarAsync(token))!;
    }

    public static async Task<RetentionFile[]> ProcessAsync(Func<string, NpgsqlConnection> connect, RetentionRun run,
        string directory, int batch, Guid[] requested, CancellationToken token)
    {
        await using var booking = connect("booking");
        await booking.OpenAsync(token);
        await using var bookings = await booking.BeginTransactionAsync(token);
        await SetTimeoutAsync(booking, bookings, token);
        var selected = await ReadIdsAsync(booking, bookings,
            ClosedBookings + " AND b.id=ANY(@trips) ORDER BY b.id FOR UPDATE OF b SKIP LOCKED", run.Cutoff, requested, token);
        if (selected.Length == 0) return [];

        await using var payment = connect("payment");
        await payment.OpenAsync(token);
        await using var payments = await payment.BeginTransactionAsync(token);
        await SetTimeoutAsync(payment, payments, token);

        // Take the same parent lock as the refund writer, then inspect child statuses again.
        await ReadIdsAsync(payment, payments,
            "SELECT id FROM payments WHERE booking_id_external=ANY(@trips) ORDER BY id FOR UPDATE",
            run.Cutoff, selected, token);
        var blocked = (await ReadIdsAsync(payment, payments, BlockedPaymentBookings, run.Cutoff, selected, token)).ToHashSet();
        var eligible = selected.Where(id => !blocked.Contains(id)).ToArray();
        if (eligible.Length == 0) return [];

        var paymentIds = await ReadIdsAsync(payment, payments,
            "SELECT id FROM payments WHERE booking_id_external=ANY(@trips) AND archived_at IS NULL ORDER BY id",
            run.Cutoff, eligible, token);
        var holdIds = await ReadIdsAsync(booking, bookings,
            "SELECT h.id FROM seat_holds h JOIN bookings b ON b.seat_hold_id=h.id WHERE b.id=ANY(@trips) ORDER BY h.id FOR UPDATE OF h",
            run.Cutoff, eligible, token);

        var bookingFiles = await ExportAsync(booking, bookings, BookingFiles, directory, batch, run.Cutoff, eligible, token);
        var financialFiles = paymentIds.Length == 0 ? [] : await ExportAsync(
            payment, payments, PaymentFiles, directory, batch, run.Cutoff, paymentIds, token);

        // Both sides have verified archives before either transaction commits.
        if (paymentIds.Length > 0)
        {
            await DeleteAsync(payment, payments, "DELETE FROM refunds WHERE payment_id=ANY(@trips)",
                run.Cutoff, paymentIds, Rows(financialFiles, "refunds"), token);
            await DeleteAsync(payment, payments, "DELETE FROM payment_attempts WHERE payment_id=ANY(@trips)",
                run.Cutoff, paymentIds, Rows(financialFiles, "payment-attempts"), token);
            await DeleteAsync(payment, payments, "UPDATE payments SET archived_at=now() WHERE id=ANY(@trips) AND archived_at IS NULL",
                run.Cutoff, paymentIds, paymentIds.Length, token);
            await RecordAsync(payment, payments, run.Id, $"financial-{batch:D4}", financialFiles, token);
        }

        await ExecuteAsync(booking, bookings, """
            UPDATE trip_seats s SET status='DISABLED', active_booking_item_id=NULL, updated_at=now(), row_version=row_version+1
            FROM booking_items i WHERE s.active_booking_item_id=i.id AND i.booking_id=ANY(@trips)
            """, run.Cutoff, eligible, token);
        await ExecuteAsync(booking, bookings, """
            UPDATE trip_seats SET status='DISABLED', active_hold_id=NULL, updated_at=now(), row_version=row_version+1
            WHERE active_hold_id=ANY(@trips)
            """, run.Cutoff, holdIds, token);
        await DeleteAsync(booking, bookings, "DELETE FROM cancellation_previews WHERE booking_id=ANY(@trips)",
            run.Cutoff, eligible, Rows(bookingFiles, "cancellation-previews"), token);
        await DeleteAsync(booking, bookings, "DELETE FROM tickets WHERE booking_id=ANY(@trips)",
            run.Cutoff, eligible, Rows(bookingFiles, "tickets"), token);
        await DeleteAsync(booking, bookings, "DELETE FROM bookings WHERE id=ANY(@trips)",
            run.Cutoff, eligible, eligible.Length, token);
        await DeleteAsync(booking, bookings, "DELETE FROM seat_holds WHERE id=ANY(@trips)",
            run.Cutoff, holdIds, holdIds.Length, token);
        await RecordAsync(booking, bookings, run.Id, $"orders-{batch:D4}", bookingFiles, token);

        // An interrupted second commit can be retried: marked payments are skipped and the booking is selected again.
        await payments.CommitAsync(token);
        await bookings.CommitAsync(token);
        return [.. financialFiles, .. bookingFiles];
    }

    private static int Rows(IEnumerable<RetentionFile> files, string prefix) =>
        files.FirstOrDefault(file => file.Name.StartsWith(prefix + "-", StringComparison.Ordinal))?.Rows ?? 0;

    private static async Task<RetentionFile[]> ExportAsync(NpgsqlConnection db, NpgsqlTransaction transaction,
        IEnumerable<(string Name, string Query)> tables, string directory, int batch, DateTime cutoff,
        Guid[] ids, CancellationToken token)
    {
        var result = new List<RetentionFile>();
        foreach (var (name, query) in tables)
        {
            await using var command = RetentionData.Command(db, query, cutoff, ids, transaction);
            var path = Path.Combine(directory, $"{name}-{batch:D4}.csv.gz");
            var archive = await RetentionData.WriteCsvAsync(command, path, token);
            if (archive.Rows == 0) File.Delete(path);
            else result.Add(archive with { Ids = [] });
        }
        return result.ToArray();
    }

    private static async Task<Guid[]> ReadIdsAsync(NpgsqlConnection db, NpgsqlTransaction? transaction,
        string sql, DateTime cutoff, Guid[] ids, CancellationToken token)
    {
        await using var query = RetentionData.Command(db, sql, cutoff, ids, transaction);
        await using var rows = await query.ExecuteReaderAsync(token);
        var result = new List<Guid>();
        while (await rows.ReadAsync(token)) result.Add(rows.GetGuid(0));
        return result.ToArray();
    }

    private static async Task SetTimeoutAsync(NpgsqlConnection db, NpgsqlTransaction transaction, CancellationToken token)
    {
        await using var command = new NpgsqlCommand("SET LOCAL lock_timeout = '8s'", db, transaction);
        await command.ExecuteNonQueryAsync(token);
    }

    private static async Task<int> ExecuteAsync(NpgsqlConnection db, NpgsqlTransaction transaction, string sql,
        DateTime cutoff, Guid[] ids, CancellationToken token)
    {
        await using var command = RetentionData.Command(db, sql, cutoff, ids, transaction);
        return await command.ExecuteNonQueryAsync(token);
    }

    private static async Task DeleteAsync(NpgsqlConnection db, NpgsqlTransaction transaction, string sql,
        DateTime cutoff, Guid[] ids, int rows, CancellationToken token)
    {
        if (await ExecuteAsync(db, transaction, sql, cutoff, ids, token) != rows)
            throw new InvalidOperationException("Transaction archive and database row counts differed.");
    }

    internal static async Task RecordAsync(NpgsqlConnection db, NpgsqlTransaction transaction, Guid runId,
        string batch, RetentionFile[] files, CancellationToken token)
    {
        await using var record = new NpgsqlCommand("""
            INSERT INTO pbl6_retention.batches (run_id,batch,files) VALUES (@run,@batch,@files::jsonb)
            """, db, transaction);
        record.Parameters.AddWithValue("run", runId);
        record.Parameters.AddWithValue("batch", batch);
        record.Parameters.AddWithValue("files", JsonSerializer.Serialize(files));
        await record.ExecuteNonQueryAsync(token);
    }
}
