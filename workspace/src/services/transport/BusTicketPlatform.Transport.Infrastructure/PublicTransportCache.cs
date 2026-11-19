using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace BusTicketPlatform.Transport.Infrastructure;

public sealed class PublicTransportCache : IAsyncDisposable
{
    private const string Prefix = "blue:transport:public:v1:";
    private const string GenerationKey = Prefix + "generation";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan Budget = TimeSpan.FromMilliseconds(200);
    private readonly Lazy<Task<ConnectionMultiplexer>>? connection;
    private readonly ILogger<PublicTransportCache> logger;

    public PublicTransportCache(IConfiguration configuration, ILogger<PublicTransportCache> logger)
    {
        this.logger = logger;
        var setting = configuration.GetConnectionString("Redis");
        if (string.IsNullOrWhiteSpace(setting)) return;

        var options = ConfigurationOptions.Parse(setting);
        options.AbortOnConnectFail = false;
        options.ConnectRetry = 0;
        options.BacklogPolicy = BacklogPolicy.FailFast;
        options.AsyncTimeout = (int)Budget.TotalMilliseconds;
        connection = new(() => ConnectionMultiplexer.ConnectAsync(options));
    }

    public Task<string?> ResolveKeyAsync(string suffix, CancellationToken ct) =>
        UseAsync<string?>(null, async db =>
        {
            var generation = await db.StringGetAsync(GenerationKey);
            return Prefix + (generation.IsNull ? "initial" : generation.ToString()) + ":" + suffix;
        }, ct);

    public Task<T?> ReadAsync<T>(string? key, CancellationToken ct) where T : class =>
        key is null ? Task.FromResult<T?>(null) : UseAsync<T?>(null, async db =>
        {
            var value = await db.StringGetAsync(key);
            if (value.IsNull) return null;
            try { return JsonSerializer.Deserialize<T>((byte[])value!, Json); }
            catch (JsonException) { return null; }
        }, ct);

    public Task WriteAsync<T>(string? key, T value, TimeSpan ttl, CancellationToken ct)
    {
        if (key is null || ttl <= TimeSpan.Zero) return Task.CompletedTask;
        var payload = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        if (payload.Length > 512 * 1024) return Task.CompletedTask;
        return UseAsync(false, db => db.StringSetAsync(key, payload, ttl), ct);
    }

    // Advance the generation so a read that started before a write cannot refill the current namespace.
    public Task InvalidateAsync(CancellationToken ct) =>
        UseAsync(false, db => db.StringSetAsync(GenerationKey, Guid.NewGuid().ToString("N")), ct);

    private async Task<T> UseAsync<T>(T fallback, Func<IDatabase, Task<T>> action, CancellationToken ct)
    {
        if (connection is null) return fallback;
        try
        {
            var client = await connection.Value.WaitAsync(Budget, ct);
            if (!client.IsConnected) return fallback;
            return await action(client.GetDatabase()).WaitAsync(Budget, ct);
        }
        catch (Exception exception) when (exception is RedisException or TimeoutException)
        {
            logger.LogDebug("Public transport cache unavailable ({ErrorType})", exception.GetType().Name);
            return fallback;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (connection?.IsValueCreated != true) return;
        try { await (await connection.Value).DisposeAsync(); }
        catch (RedisException) { }
    }
}
