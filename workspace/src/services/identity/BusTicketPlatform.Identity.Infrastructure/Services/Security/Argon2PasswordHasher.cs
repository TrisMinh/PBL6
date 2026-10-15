using System.Security.Cryptography;
using System.Text;
using BusTicketPlatform.Identity.Application.Abstractions.Security;
using Konscious.Security.Cryptography;

namespace BusTicketPlatform.Identity.Infrastructure.Services.Security;

public sealed class Argon2PasswordHasher : IPasswordHasher
{
    public async Task<string> HashAsync(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = 1,
            Iterations = 2,
            MemorySize = 19_456
        };
        var hash = await argon2.GetBytesAsync(32);
        return $"$argon2id$v=19$m=19456,t=2,p=1${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
}
