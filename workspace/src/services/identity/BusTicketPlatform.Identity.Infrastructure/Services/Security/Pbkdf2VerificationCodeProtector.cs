using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using BusTicketPlatform.Identity.Application.Abstractions.Security;
using Microsoft.Extensions.Options;

namespace BusTicketPlatform.Identity.Infrastructure.Services.Security;

public sealed class Pbkdf2VerificationCodeProtector(IOptions<RegistrationOptions> options)
    : IVerificationCodeProtector
{
    private const int Iterations = 100_000;
    private readonly string _secret = options.Value.VerificationSecret;

    public string GenerateCode() =>
        RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    public ProtectedVerificationCode Protect(Guid challengeId, string code)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        return new ProtectedVerificationCode(Hash(challengeId, code, salt), Convert.ToBase64String(salt));
    }

    public bool Verify(Guid challengeId, string code, string expectedHash, string salt)
    {
        var actualHash = Hash(challengeId, code, Convert.FromBase64String(salt));
        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(expectedHash),
            Convert.FromHexString(actualHash));
    }

    private string Hash(Guid challengeId, string code, byte[] salt)
    {
        var value = Encoding.UTF8.GetBytes($"{challengeId:N}:{code}:{_secret}");
        var hash = Rfc2898DeriveBytes.Pbkdf2(value, salt, Iterations, HashAlgorithmName.SHA512, 32);
        CryptographicOperations.ZeroMemory(value);
        return Convert.ToHexStringLower(hash);
    }
}
