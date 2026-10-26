using BusTicketPlatform.Identity.Application.Abstractions.Verification;
using StackExchange.Redis;

namespace BusTicketPlatform.Identity.Infrastructure.Services.Caching;

public sealed class RedisVerificationCodeStore(IConnectionMultiplexer connection) : IVerificationCodeStore
{
    private const string ChallengePrefix = "identity:email-verification:";
    private const string StoreScript = """
        local current = redis.call('GET', KEYS[1])
        if redis.call('EXISTS', KEYS[3]) == 1 and current then
            if redis.call('EXISTS', ARGV[6] .. current) == 1 then
                return { 0, current }
            end
        end
        if current then
            redis.call('DEL', ARGV[6] .. current)
        end
        redis.call('HSET', KEYS[2],
            'userId', ARGV[1],
            'codeHash', ARGV[2],
            'codeSalt', ARGV[3],
            'attempts', 0)
        redis.call('PEXPIRE', KEYS[2], ARGV[4])
        redis.call('SET', KEYS[1], ARGV[5], 'PX', ARGV[4])
        redis.call('SET', KEYS[3], 1, 'PX', ARGV[7])
        return { 1, ARGV[5] }
        """;

    private const string ConsumeScript = """
        local storedUser = redis.call('HGET', KEYS[1], 'userId')
        local storedHash = redis.call('HGET', KEYS[1], 'codeHash')
        if not storedUser or storedUser ~= ARGV[2] or storedHash ~= ARGV[3] then
            return 0
        end
        local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
        if attempts >= tonumber(ARGV[5]) then
            return 0
        end
        if ARGV[4] == '1' then
            redis.call('DEL', KEYS[1])
            if redis.call('GET', KEYS[2]) == ARGV[1] then
                redis.call('DEL', KEYS[2])
            end
            redis.call('DEL', KEYS[3])
            return 1
        end
        redis.call('HINCRBY', KEYS[1], 'attempts', 1)
        return 0
        """;

    private readonly IDatabase _database = connection.GetDatabase();

    public async Task<bool> HasActiveChallengeAsync(Guid userId)
    {
        const string script = """
            local current = redis.call('GET', KEYS[1])
            return current and redis.call('EXISTS', ARGV[1] .. current) or 0
            """;
        var result = await _database.ScriptEvaluateAsync(
            script,
            [UserChallengeKey(userId)],
            [ChallengePrefix]);
        return (long)result == 1;
    }

    public async Task<VerificationCodeStoreResult> StoreAsync(
        Guid userId,
        Guid challengeId,
        string codeHash,
        string codeSalt,
        TimeSpan lifetime,
        TimeSpan resendCooldown)
    {
        var challengeValue = challengeId.ToString("N");
        var result = (RedisResult[]?)await _database.ScriptEvaluateAsync(
            StoreScript,
            [UserChallengeKey(userId), ChallengeKey(challengeId), CooldownKey(userId)],
            [
                userId.ToString("N"),
                codeHash,
                codeSalt,
                Milliseconds(lifetime),
                challengeValue,
                ChallengePrefix,
                Milliseconds(resendCooldown)
            ]);
        var storedChallengeId = Guid.ParseExact(result![1].ToString(), "N");
        return new VerificationCodeStoreResult(storedChallengeId, (long)result[0] == 1);
    }

    public async Task<VerificationChallenge?> FindAsync(Guid challengeId)
    {
        var values = await _database.HashGetAsync(
            ChallengeKey(challengeId),
            ["userId", "codeHash", "codeSalt"]);
        return values[0].IsNull || values[1].IsNull || values[2].IsNull ||
               !Guid.TryParseExact(values[0].ToString(), "N", out var userId)
            ? null
            : new VerificationChallenge(userId, values[1].ToString(), values[2].ToString());
    }

    public async Task<bool> TryConsumeAsync(
        Guid challengeId,
        VerificationChallenge challenge,
        bool valid,
        int maxAttempts)
    {
        var result = await _database.ScriptEvaluateAsync(
            ConsumeScript,
            [ChallengeKey(challengeId), UserChallengeKey(challenge.UserId), CooldownKey(challenge.UserId)],
            [
                challengeId.ToString("N"),
                challenge.UserId.ToString("N"),
                challenge.CodeHash,
                valid ? "1" : "0",
                maxAttempts
            ]);
        return (long)result == 1;
    }

    private static long Milliseconds(TimeSpan value) => Math.Max(1, (long)value.TotalMilliseconds);
    private static RedisKey ChallengeKey(Guid challengeId) => $"{ChallengePrefix}{challengeId:N}";
    private static RedisKey UserChallengeKey(Guid userId) => $"{ChallengePrefix}user:{userId:N}";
    private static RedisKey CooldownKey(Guid userId) => $"{ChallengePrefix}cooldown:{userId:N}";
}
