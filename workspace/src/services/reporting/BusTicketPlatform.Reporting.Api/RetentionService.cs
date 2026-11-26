using System.Text.Json;
using Npgsql;

namespace BusTicketPlatform.Reporting.Api;

internal sealed class RetentionService(IConfiguration config, ILogger<RetentionService> logger) : BackgroundService
{
    private const int BatchSize = 5000;
    private const long LockKey = 3762134809;
    private static readonly string[] ArchiveDatabases = ["booking", "notification", "transport", "payment"];
    private readonly string root = config["Retention:Directory"] ?? throw new InvalidOperationException("Retention directory is required.");
    private readonly string connectionString = config.GetConnectionString("Reporting")
        ?? throw new InvalidOperationException("Reporting connection is required.");
    private readonly object gate = new();
    private RetentionRun? active;

    private NpgsqlConnection Connect(string database) =>
        new(new NpgsqlConnectionStringBuilder(connectionString) { Database = database }.ConnectionString);

    private string SettingsPath => Path.Combine(root, "settings.json");

    public RetentionSettings Settings
    {
        get
        {
            lock (gate) return Read<RetentionSettings>(SettingsPath) ?? new(false, 30, 2);
        }
    }

    public void SaveSettings(RetentionSettings settings)
    {
        lock (gate) Write(SettingsPath, settings);
    }

    public RetentionRun? Active
    {
        get { lock (gate) return active; }
    }

    public RetentionRun[] History()
    {
        if (!Directory.Exists(root)) return [];
        return Directory.EnumerateDirectories(root).Select(path => Read<RetentionRun>(Path.Combine(path, "run.json")))
            .OfType<RetentionRun>().OrderByDescending(run => run.StartedAt).Take(20).ToArray();
    }

    public string? ArchivePath(Guid runId, string file)
    {
        var directory = Path.Combine(root, runId.ToString("N"));
        var manifest = Read<RetentionRun>(Path.Combine(directory, "run.json"));
        if (manifest?.Files.Any(archive => archive.Name == file) != true) return null;
        return Path.Combine(directory, file);
    }

    public RetentionRun? GetRun(Guid runId) => Read<RetentionRun>(Manifest(runId));

    public Guid? Enqueue(bool scheduled = false)
    {
        lock (gate)
        {
            if (active is not null) return null;
            var now = DateTime.UtcNow;
            var settings = Settings;
            var run = new RetentionRun(Guid.NewGuid(), now, now.AddDays(-settings.Days),
                scheduled, "queued", [], [], [], null, null);
            Write(Manifest(run.Id), run);
            active = run;
            return run.Id;
        }
    }

    public async Task<RetentionPreview> PreviewAsync(CancellationToken token)
    {
        var settings = Settings;
        var cutoff = DateTime.UtcNow.AddDays(-settings.Days);
        var trips = await RetentionData.EligibleTripsAsync(Connect, cutoff, token);
        var counts = await Task.WhenAll(RetentionData.Policies.Select(policy => CountAsync(policy, cutoff, trips, token)));
        var bookingIds = await TransactionRetention.EligibleAsync(Connect, cutoff, token);
        var removals = RetentionData.Policies.Zip(counts, (policy, count) =>
            new RetentionRemoval(policy.Database, policy.Table, count.Rows)).ToList();
        removals.AddRange(await TransactionRetention.PreviewRemovalsAsync(Connect, bookingIds, cutoff, token));
        await using (var transport = Connect("transport"))
        {
            await transport.OpenAsync(token);
            var policy = RetentionData.Policies.Single(item => item.Key == "trips");
            var assignments = $"SELECT a.id FROM driver_assignments a JOIN ({policy.Select}) t ON t.id=a.trip_id";
            removals.Add(new("transport", "driver_assignments",
                await TransactionRetention.CountRowsAsync(transport, assignments, cutoff, trips, token)));
        }
        var sizes = await SizesAsync(token);
        var estimated = await Task.WhenAll(sizes.Select(size =>
            EstimateSizeAsync(size, removals.Where(item => item.Database == size.Database), token)));
        return new(cutoff, [new("transactions", bookingIds.Length), .. counts], sizes, estimated, await OutboxAsync(cutoff, token));
    }

    private async Task<RetentionSize> EstimateSizeAsync(RetentionSize current,
        IEnumerable<RetentionRemoval> removals, CancellationToken token)
    {
        var rowsByTable = removals.GroupBy(item => item.Table)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Rows));
        if (rowsByTable.Values.All(rows => rows == 0)) return current;

        await using var db = Connect(current.Database);
        await db.OpenAsync(token);
        await using var cmd = new NpgsqlCommand("""
            SELECT c.relname::text, pg_total_relation_size(c.oid), GREATEST(c.reltuples::bigint, s.n_live_tup, 0)
            FROM pg_class c JOIN pg_stat_user_tables s ON s.relid=c.oid
            WHERE s.schemaname='public' AND c.relname::text=ANY(@tables)
            """, db);
        cmd.Parameters.AddWithValue("tables", rowsByTable.Keys.ToArray());
        await using var reader = await cmd.ExecuteReaderAsync(token);
        long recovered = 0;
        while (await reader.ReadAsync(token))
        {
            var totalRows = reader.GetInt64(2);
            if (totalRows == 0) continue;
            var fraction = Math.Min(1m, (decimal)rowsByTable[reader.GetString(0)] / totalRows);
            recovered += (long)Math.Round(reader.GetInt64(1) * fraction);
        }
        return current with { Bytes = Math.Max(0, current.Bytes - recovered) };
    }

    private async Task<long> OutboxAsync(DateTime cutoff, CancellationToken token)
    {
        var counts = await Task.WhenAll(RetentionData.Databases.Select(async db =>
        {
            await using var connection = Connect(db);
            await connection.OpenAsync(token);
            await using var cmd = RetentionData.Command(connection,
                "SELECT count(*) FROM outbox_messages WHERE published_at < @cutoff", cutoff);
            return (long)(await cmd.ExecuteScalarAsync(token))!;
        }));
        return counts.Sum();
    }

    private async Task<RetentionCount> CountAsync(RetentionPolicy policy, DateTime cutoff,
        Guid[] trips, CancellationToken token)
    {
        await using var connection = Connect(policy.Database);
        await connection.OpenAsync(token);
        return new(policy.Key, await TransactionRetention.CountRowsAsync(connection, policy.Select, cutoff, trips, token));
    }

    private async Task<RetentionSize[]> SizesAsync(CancellationToken token) => await Task.WhenAll(
        RetentionData.Databases.Select(async db =>
        {
            await using var connection = Connect(db);
            await connection.OpenAsync(token);
            await using var cmd = new NpgsqlCommand("SELECT pg_database_size(current_database())", connection);
            return new RetentionSize(db, (long)(await cmd.ExecuteScalarAsync(token))!);
        }));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(root);
        foreach (var database in ArchiveDatabases)
        {
            await using var connection = Connect(database);
            await connection.OpenAsync(stoppingToken);
            await using var schema = new NpgsqlCommand("""
                CREATE SCHEMA IF NOT EXISTS pbl6_retention;
                CREATE TABLE IF NOT EXISTS pbl6_retention.batches (
                    run_id uuid NOT NULL,
                    batch text NOT NULL,
                    files jsonb NOT NULL,
                    PRIMARY KEY (run_id, batch)
                );
                """, connection);
            await schema.ExecuteNonQueryAsync(stoppingToken);
        }
        foreach (var pending in History().Where(run => run.Status is "queued" or "running" or "interrupted"))
            Write(Manifest(pending.Id), pending with
            {
                Status = "interrupted", FinishedAt = DateTime.UtcNow,
                Files = await ReadCommittedFilesAsync(pending.Id, stoppingToken)
            });

        using var tick = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (await tick.WaitForNextTickAsync(stoppingToken))
        {
            var settings = Settings;
            var local = DateTime.UtcNow.AddHours(7);
            if (settings.Enabled && local.Hour >= settings.Hour &&
                !History().Any(run => run.Scheduled && run.StartedAt.AddHours(7).Date == local.Date))
                Enqueue(scheduled: true);
            if (Active is { } run) await ExecuteRunAsync(run, stoppingToken);
        }
    }

    private async Task ExecuteRunAsync(RetentionRun run, CancellationToken token)
    {
        var state = run with { Status = "running" };
        try
        {
            await using var lockConnection = new NpgsqlConnection(
                new NpgsqlConnectionStringBuilder(connectionString) { Pooling = false }.ConnectionString);
            await lockConnection.OpenAsync(token);
            await using var acquire = new NpgsqlCommand($"SELECT pg_try_advisory_lock({LockKey})", lockConnection);
            if (await acquire.ExecuteScalarAsync(token) is not true)
                throw new InvalidOperationException("An archive job is already running.");

            state = state with { Before = await SizesAsync(token) };
            Publish(state);
            await using (var booking = Connect("booking"))
            {
                await booking.OpenAsync(token);
                await using var createIndex = new NpgsqlCommand("""
                    CREATE INDEX IF NOT EXISTS ix_retention_trip_seats_booking_item
                        ON trip_seats(active_booking_item_id) WHERE active_booking_item_id IS NOT NULL;
                    CREATE INDEX IF NOT EXISTS ix_retention_trip_seats_hold
                        ON trip_seats(active_hold_id) WHERE active_hold_id IS NOT NULL;
                    CREATE INDEX IF NOT EXISTS ix_retention_booking_items_trip_seat
                        ON booking_items(trip_seat_id);
                    """, booking) { CommandTimeout = 300 };
                await createIndex.ExecuteNonQueryAsync(token);
            }
            var ids = await TransactionRetention.EligibleAsync(Connect, run.Cutoff, token);
            var transactionBatch = 0;
            var directory = Path.Combine(root, run.Id.ToString("N"));
            foreach (var batch in ids.Chunk(2000))
            {
                var files = await TransactionRetention.ProcessAsync(Connect, run, directory, ++transactionBatch, batch, token);
                state = state with { Files = [.. state.Files, .. files] };
                Publish(state);
            }
            var trips = await RetentionData.EligibleTripsAsync(Connect, run.Cutoff, token);
            foreach (var policy in RetentionData.Policies)
            {
                var batch = 0;
                while (true)
                {
                    var files = await ProcessBatchAsync(state, policy, trips, ++batch, token);
                    if (files.Length == 0) break;
                    var rows = files[0].Rows;
                    state = state with { Files = [.. state.Files, .. files] };
                    Publish(state);
                    if (rows < BatchSize) break;
                }
            }
            state = state with { Status = "completed", After = await SizesAsync(token) };
        }
        catch (Exception error)
        {
            logger.LogError(error, "Local retention run {RunId} stopped", run.Id);
            state = state with { Status = token.IsCancellationRequested ? "interrupted" : "failed",
                Error = "Lần chạy đã dừng. Các lô đã hoàn tất được ghi trong lịch sử." };
            if (!token.IsCancellationRequested)
            {
                try { state = state with { Files = await ReadCommittedFilesAsync(run.Id, token) }; }
                catch (NpgsqlException recoveryError)
                {
                    logger.LogError(recoveryError, "Could not read retained batches for {RunId}", run.Id);
                }
            }
        }
        finally
        {
            try
            {
                Publish(state with { FinishedAt = DateTime.UtcNow });
            }
            finally
            {
                lock (gate) active = null;
            }
        }
    }

    private async Task<RetentionFile[]> ProcessBatchAsync(RetentionRun run, RetentionPolicy policy,
        Guid[] trips, int batch, CancellationToken token)
    {
        var directory = Path.Combine(root, run.Id.ToString("N"));
        var stem = $"{policy.Key}-{batch:D4}";
        await using var db = Connect(policy.Database);
        await db.OpenAsync(token);
        await using var transaction = await db.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, token);
        await using var select = RetentionData.Command(db,
            $"{policy.Select} ORDER BY {policy.Alias}.id LIMIT {BatchSize} FOR UPDATE OF {policy.Alias} SKIP LOCKED",
            run.Cutoff, trips, transaction);
        var mainPath = Path.Combine(directory, stem + ".csv.gz");
        var file = await RetentionData.WriteCsvAsync(select, mainPath, token);
        if (file.Rows == 0)
        {
            File.Delete(mainPath);
            return [];
        }

        var files = new List<RetentionFile> { file };
        if (policy.Key == "trips")
        {
            await using var assignments = RetentionData.Command(db, """
                SELECT a.id, a.trip_id, a.assignment_role, lower(a.assignment_window) AS starts_at,
                       upper(a.assignment_window) AS ends_at, a.ended_at
                FROM driver_assignments a WHERE a.trip_id=ANY(@trips) ORDER BY a.id FOR UPDATE
                """, run.Cutoff, file.Ids, transaction);
            var child = await RetentionData.WriteCsvAsync(assignments,
                Path.Combine(directory, "assignments-" + batch.ToString("D4") + ".csv.gz"), token);
            files.Add(child);
            await DeleteAsync(db, transaction, "driver_assignments", child, run.Cutoff, token);
        }
        if (policy.Key == "holds")
        {
            await using var items = RetentionData.Command(db, """
                SELECT h.seat_hold_id, h.trip_seat_id FROM seat_hold_items h
                WHERE h.seat_hold_id=ANY(@trips) ORDER BY h.seat_hold_id, h.trip_seat_id FOR UPDATE
                """, run.Cutoff, file.Ids, transaction);
            files.Add(await RetentionData.WriteCsvAsync(items,
                Path.Combine(directory, "hold-seats-" + batch.ToString("D4") + ".csv.gz"), token));
        }

        await DeleteAsync(db, transaction, policy.Table, file, run.Cutoff, token);
        await TransactionRetention.RecordAsync(db, transaction, run.Id, stem, files.ToArray(), token);
        await transaction.CommitAsync(token);
        return files.Select(archive => archive with { Ids = [] }).ToArray();
    }

    private async Task<RetentionFile[]> ReadCommittedFilesAsync(Guid runId, CancellationToken token)
    {
        var files = new List<RetentionFile>();
        foreach (var database in ArchiveDatabases)
        {
            await using var connection = Connect(database);
            await connection.OpenAsync(token);
            await using var query = new NpgsqlCommand(
                "SELECT files::text FROM pbl6_retention.batches WHERE run_id=@run ORDER BY batch", connection);
            query.Parameters.AddWithValue("run", runId);
            await using var reader = await query.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token))
                files.AddRange(JsonSerializer.Deserialize<RetentionFile[]>(reader.GetString(0)) ?? []);
        }
        return files.ToArray();
    }

    private static async Task DeleteAsync(NpgsqlConnection db, NpgsqlTransaction transaction, string table,
        RetentionFile file, DateTime cutoff, CancellationToken token)
    {
        await using var delete = RetentionData.Command(db, $"DELETE FROM {table} WHERE id=ANY(@trips)",
            cutoff, file.Ids, transaction);
        if (await delete.ExecuteNonQueryAsync(token) != file.Rows)
            throw new InvalidOperationException("Deleted row count differed from the archive.");
    }

    private void Publish(RetentionRun state)
    {
        lock (gate)
        {
            Write(Manifest(state.Id), state);
            active = state;
        }
    }

    private string Manifest(Guid id) => Path.Combine(root, id.ToString("N"), "run.json");

    private static T? Read<T>(string path) => File.Exists(path)
        ? JsonSerializer.Deserialize<T>(File.ReadAllText(path)) : default;

    private static void Write<T>(string path, T value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(value));
        File.Move(temporary, path, overwrite: true);
    }
}

internal sealed record RetentionSettings(bool Enabled, int Days, int Hour);
internal sealed record RetentionCount(string Key, long Rows);
internal sealed record RetentionSize(string Database, long Bytes);
internal sealed record RetentionRemoval(string Database, string Table, long Rows);
internal sealed record RetentionPreview(DateTime Cutoff, RetentionCount[] Candidates, RetentionSize[] Databases,
    RetentionSize[] EstimatedAfter, long PublishedOutboxOlderThanCutoff);
internal sealed record RetentionRun(Guid Id, DateTime StartedAt, DateTime Cutoff, bool Scheduled,
    string Status, RetentionSize[] Before, RetentionSize[] After, RetentionFile[] Files,
    DateTime? FinishedAt, string? Error);
