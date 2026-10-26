namespace BusTicketPlatform.Identity.Application.Abstractions.Verification;

public sealed record VerificationChallenge(Guid UserId, string CodeHash, string CodeSalt);
public sealed record VerificationCodeStoreResult(Guid ChallengeId, bool Created);

public interface IVerificationCodeStore
{
    Task<bool> HasActiveChallengeAsync(Guid userId);

    Task<VerificationCodeStoreResult> StoreAsync(
        Guid userId,
        Guid challengeId,
        string codeHash,
        string codeSalt,
        TimeSpan lifetime,
        TimeSpan resendCooldown);

    Task<VerificationChallenge?> FindAsync(Guid challengeId);
    Task<bool> TryConsumeAsync(
        Guid challengeId,
        VerificationChallenge challenge,
        bool valid,
        int maxAttempts);
}
