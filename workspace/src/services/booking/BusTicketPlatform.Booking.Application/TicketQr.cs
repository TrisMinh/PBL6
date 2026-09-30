using System.Security.Cryptography;
using System.Text;

namespace BusTicketPlatform.Booking.Application;

public sealed class TicketQrOptions
{
    public string SigningKey { get; init; } = "local-dev-only-change-me-32bytes-min";
}

public static class TicketQr
{
    public const string Prefix = "BT1";

    public static string Create(Guid ticketId, string signingKey)
    {
        var id = ticketId.ToString("N");
        return $"{Prefix}.{id}.{Mac(id, signingKey)}";
    }

    public static bool TryVerify(string payload, string signingKey, out Guid ticketId)
    {
        ticketId = default;
        var parts = payload.Split('.', 3, StringSplitOptions.TrimEntries);
        if (parts.Length != 3
            || !parts[0].Equals(Prefix, StringComparison.Ordinal)
            || !Guid.TryParseExact(parts[1], "N", out ticketId))
        {
            return false;
        }

        var expected = Mac(parts[1], signingKey);
        var actual = parts[2].ToUpperInvariant();
        if (actual.Length != expected.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(actual));
    }

    private static string Mac(string ticketIdN, string signingKey) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(ticketIdN)));
}
