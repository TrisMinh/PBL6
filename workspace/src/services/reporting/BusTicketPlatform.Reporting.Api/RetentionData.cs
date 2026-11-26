using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace BusTicketPlatform.Reporting.Api;

internal static class RetentionData
{
    public static readonly string[] Databases = ["identity", "transport", "booking", "payment", "notification", "reporting"];
    public static readonly RetentionPolicy[] Policies =
    [
        new("holds", "booking", "seat_holds", """
            SELECT h.id, h.trip_id, h.status, h.created_at, h.expires_at
            FROM seat_holds h
            WHERE h.status IN ('EXPIRED','RELEASED') AND h.expires_at < @cutoff
              AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.seat_hold_id=h.id)
              AND NOT EXISTS (SELECT 1 FROM trip_seats s WHERE s.active_hold_id=h.id)
            """, "h"),
        new("seats", "booking", "trip_seats", """
            SELECT s.id, s.trip_id, s.seat_code, s.seat_type, s.deck, s.row_no, s.column_no, s.price, s.status
            FROM trip_seats s
            WHERE s.trip_id=ANY(@trips) AND s.active_hold_id IS NULL AND s.active_booking_item_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM booking_items b WHERE b.trip_seat_id=s.id)
              AND NOT EXISTS (SELECT 1 FROM seat_hold_items h WHERE h.trip_seat_id=s.id)
            """, "s"),
        new("delivery", "notification", "delivery_attempts", """
            SELECT d.id, d.channel, d.attempt_no, d.status, d.created_at, d.completed_at
            FROM delivery_attempts d
            WHERE d.status IN ('DELIVERED','FAILED') AND d.completed_at < @cutoff
              AND NOT EXISTS (SELECT 1 FROM delivery_attempts w
                  WHERE w.notification_id=d.notification_id AND w.status IN ('PENDING','SENDING','RETRYING'))
            """, "d"),
        new("trips", "transport", "trips", """
            SELECT t.id, t.organization_id, t.route_id, t.bus_id, t.origin_stop_id, t.destination_stop_id,
                   t.departure_at, t.arrival_at, t.base_fare, t.currency, t.status
            FROM trips t
            WHERE t.id=ANY(@trips) AND t.arrival_at < @cutoff
              AND NOT t.sellable AND t.status IN ('COMPLETED','CANCELLED')
            """, "t")
    ];

    public static NpgsqlCommand Command(NpgsqlConnection connection, string sql,
        DateTime cutoff, Guid[]? trips = null, NpgsqlTransaction? transaction = null)
    {
        var cmd = new NpgsqlCommand(sql, connection, transaction) { CommandTimeout = 300 };
        cmd.Parameters.AddWithValue("cutoff", cutoff);
        cmd.Parameters.AddWithValue("trips", trips ?? Array.Empty<Guid>());
        return cmd;
    }

    public static async Task<Guid[]> EligibleTripsAsync(Func<string, NpgsqlConnection> connect,
        DateTime cutoff, CancellationToken token)
    {
        // Booking snapshots, referenced seats and all business records remain accessible.
        await using var booking = connect("booking");
        await booking.OpenAsync(token);
        await using var cmd = Command(booking, """
            SELECT t.trip_id, b.id
            FROM trip_snapshots t
            LEFT JOIN bookings b ON b.trip_id=t.trip_id
            WHERE t.arrival_at < @cutoff AND t.status IN ('COMPLETED','CANCELLED') AND NOT t.sellable
              AND NOT EXISTS (SELECT 1 FROM bookings w WHERE w.trip_id=t.trip_id
                  AND w.status NOT IN ('COMPLETED','CANCELLED','EXPIRED','REFUNDED'))
              AND NOT EXISTS (SELECT 1 FROM seat_holds h WHERE h.trip_id=t.trip_id AND h.status='ACTIVE')
            """, cutoff);
        var candidates = new HashSet<Guid>();
        var bookingTrips = new Dictionary<Guid, Guid>();
        await using (var rows = await cmd.ExecuteReaderAsync(token))
        {
            while (await rows.ReadAsync(token))
            {
                var trip = rows.GetGuid(0);
                candidates.Add(trip);
                if (!rows.IsDBNull(1)) bookingTrips.Add(rows.GetGuid(1), trip);
            }
        }

        await using var payment = connect("payment");
        await payment.OpenAsync(token);
        foreach (var ids in bookingTrips.Keys.Chunk(10_000))
        {
            await using var open = Command(payment, """
                SELECT p.booking_id_external
                FROM payments p
                WHERE p.booking_id_external=ANY(@trips) AND (
                   p.status IN ('PENDING','PROCESSING','REFUND_PENDING')
                   OR EXISTS (SELECT 1 FROM reconciliation_cases r WHERE r.payment_id=p.id AND r.status IN ('OPEN','INVESTIGATING'))
                   OR EXISTS (SELECT 1 FROM refunds r WHERE r.payment_id=p.id AND r.status IN ('REQUESTED','PROCESSING'))
                )
                UNION
                SELECT s.booking_id_external FROM booking_settlements s
                WHERE s.booking_id_external=ANY(@trips) AND s.collection_status='UNCOLLECTED'
                """, cutoff, ids);
            await using var rows = await open.ExecuteReaderAsync(token);
            while (await rows.ReadAsync(token)) candidates.Remove(bookingTrips[rows.GetGuid(0)]);
        }

        await using var transport = connect("transport");
        await transport.OpenAsync(token);
        await using var terminal = Command(transport, """
            SELECT id FROM trips WHERE id=ANY(@trips) AND arrival_at < @cutoff
              AND status IN ('COMPLETED','CANCELLED') AND NOT sellable
            """, cutoff, candidates.ToArray());
        var verified = new List<Guid>();
        await using var trips = await terminal.ExecuteReaderAsync(token);
        while (await trips.ReadAsync(token)) verified.Add(trips.GetGuid(0));
        return verified.ToArray();
    }

    public static async Task<RetentionFile> WriteCsvAsync(NpgsqlCommand query, string target, CancellationToken token)
    {
        var temporary = target + ".tmp";
        var ids = new List<Guid>();
        await using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await using (var gzip = new GZipStream(file, CompressionLevel.Fastest, leaveOpen: true))
            await using (var csv = new StreamWriter(gzip, new UTF8Encoding(false)))
            await using (var rows = await query.ExecuteReaderAsync(token))
            {
                await csv.WriteLineAsync(string.Join(',', Enumerable.Range(0, rows.FieldCount).Select(rows.GetName)));
                while (await rows.ReadAsync(token))
                {
                    ids.Add(rows.GetGuid(0));
                    await csv.WriteLineAsync(string.Join(',', Enumerable.Range(0, rows.FieldCount).Select(i =>
                        CsvValue(rows.GetValue(i)))));
                }
            }
            file.Flush(flushToDisk: true);
        }

        await using (var file = File.OpenRead(temporary))
        await using (var gzip = new GZipStream(file, CompressionMode.Decompress))
        using (var csv = new Microsoft.VisualBasic.FileIO.TextFieldParser(gzip, Encoding.UTF8))
        {
            csv.SetDelimiters(",");
            var lines = 0;
            while (!csv.EndOfData)
            {
                token.ThrowIfCancellationRequested();
                csv.ReadFields();
                lines++;
            }
            if (lines != ids.Count + 1) throw new IOException("Archive row count did not match the selection.");
        }

        string checksum;
        await using (var file = File.OpenRead(temporary))
            checksum = Convert.ToHexString(await SHA256.HashDataAsync(file, token)).ToLowerInvariant();
        File.Move(temporary, target);
        return new RetentionFile(Path.GetFileName(target), ids.Count, new FileInfo(target).Length, checksum, ids.ToArray());
    }

    private static string CsvValue(object value)
    {
        var text = value switch
        {
            DBNull => "",
            byte[] bytes => Convert.ToBase64String(bytes),
            DateTime date => date.ToString("O", CultureInfo.InvariantCulture),
            Array array => System.Text.Json.JsonSerializer.Serialize(array),
            IFormattable item => item.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString() ?? ""
        };
        if (text.Length > 0 && "=+-@\t".Contains(text[0])) text = "'" + text;
        return '"' + text.Replace("\"", "\"\"") + '"';
    }
}

internal sealed record RetentionPolicy(string Key, string Database, string Table, string Select, string Alias);
internal sealed record RetentionFile(string Name, int Rows, long Bytes, string Sha256,
    [property: System.Text.Json.Serialization.JsonIgnore] Guid[] Ids);
