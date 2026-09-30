namespace BusTicketPlatform.BuildingBlocks.Logging;

public static class LogRedaction
{
    private static readonly HashSet<string> SensitiveKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "password",
        "passwordHash",
        "token",
        "accessToken",
        "refreshToken",
        "authorization",
        "email",
        "phone",
        "secret",
        "connectionString",
        "jwt"
    };

    public const string MaskValue = "***";

    public static bool IsSensitive(string key)
    {
        if (SensitiveKeys.Contains(key))
        {
            return true;
        }

        return key.Contains("password", StringComparison.OrdinalIgnoreCase)
            || key.Contains("secret", StringComparison.OrdinalIgnoreCase)
            || key.Contains("token", StringComparison.OrdinalIgnoreCase);
    }

    public static object? Mask(object? value) => value is null ? null : MaskValue;

    public static Dictionary<string, object?> Redact(IEnumerable<KeyValuePair<string, object?>> properties)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in properties)
        {
            result[pair.Key] = IsSensitive(pair.Key) ? Mask(pair.Value) : pair.Value;
        }

        return result;
    }
}
