namespace BusTicketPlatform.Identity.Application.Abstractions.Security;

public sealed record ProtectedVerificationCode(string Hash, string Salt);

public interface IVerificationCodeProtector
{
    string GenerateCode();
    ProtectedVerificationCode Protect(Guid challengeId, string code);
    bool Verify(Guid challengeId, string code, string expectedHash, string salt);
}
