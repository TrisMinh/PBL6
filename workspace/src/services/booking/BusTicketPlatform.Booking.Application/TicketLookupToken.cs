using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace BusTicketPlatform.Booking.Application;

public sealed record TicketLookupAccess(string Token, IReadOnlyList<string> TicketCodes, DateTimeOffset ExpiresAt);
public sealed record TicketLookupDetail(TicketDto Ticket, string BookingCode, Guid SeatId, Guid PickupStopId, Guid DropoffStopId);

internal static class TicketLookupToken
{
    private const int PayloadLength = 24;

    private static byte[] Key(string secret) =>
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), "blue-ticket-lookup-v1"u8);

    public static string Create(Guid bookingId, DateTimeOffset expiry, string secret)
    {
        var data = new byte[PayloadLength + 32];
        bookingId.TryWriteBytes(data);
        BinaryPrimitives.WriteInt64BigEndian(data.AsSpan(16), expiry.ToUnixTimeSeconds());
        HMACSHA256.HashData(Key(secret), data.AsSpan(0, PayloadLength), data.AsSpan(PayloadLength));
        return Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static bool TryRead(string token, string secret, out Guid bookingId)
    {
        bookingId = default;
        if (token.Length != 75) return false;
        Span<byte> data = stackalloc byte[PayloadLength + 32];
        if (!Convert.TryFromBase64String(token.Replace('-', '+').Replace('_', '/') + "=", data, out var written)
            || written != data.Length)
            return false;
        var expected = HMACSHA256.HashData(Key(secret), data[..PayloadLength]);
        if (!CryptographicOperations.FixedTimeEquals(expected, data[PayloadLength..])
            || BinaryPrimitives.ReadInt64BigEndian(data[16..]) <= DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            return false;
        bookingId = new Guid(data[..16]);
        return true;
    }
}
