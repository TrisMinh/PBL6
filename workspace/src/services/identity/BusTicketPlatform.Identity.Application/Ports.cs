namespace BusTicketPlatform.Identity.Application;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface ITokenService
{
    (string AccessToken, string RefreshTokenPlain, string RefreshTokenHash, int ExpiresIn) Issue(
        UserRecord user,
        IReadOnlyList<string> roles,
        Guid sessionId,
        Guid? organizationId = null);
}

public interface IChallengeNotifier
{
    Task NotifyAsync(string email, string challengeType, Guid challengeId, string code, CancellationToken cancellationToken);
}

public interface IChallengeMailbox
{
    ChallengeNotice? LastFor(string email);
    ChallengeNotice? ByChallenge(Guid challengeId);
}

public sealed record ChallengeNotice(string Email, string ChallengeType, Guid ChallengeId, string Code);

public interface IRegistrationEvents
{
    Task UserRegisteredAsync(Guid userId, DateTimeOffset registeredAt, Guid correlationId, CancellationToken cancellationToken);
}

public interface IIdempotencyStore
{
    Task<IdempotencyOutcome> BeginAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        string requestHash,
        CancellationToken cancellationToken);

    Task CompleteAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        int status,
        string responseSnapshot,
        CancellationToken cancellationToken);
}

public abstract record IdempotencyOutcome
{
    public sealed record Started : IdempotencyOutcome;
    public sealed record Completed(int Status, string Snapshot) : IdempotencyOutcome;
    public sealed record InProgress : IdempotencyOutcome;
    public sealed record Conflict : IdempotencyOutcome;
}

public interface IIdentityRepository
{
    Task<UserRecord?> FindByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<UserRecord?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<UserRecord?> FindByNormalizedPhoneAsync(string normalizedPhone, CancellationToken cancellationToken);
    Task<UserRecord?> FindByIdentifierAsync(string identifier, CancellationToken cancellationToken);
    Task InsertUserAsync(UserRecord user, CancellationToken cancellationToken);
    Task UpdateUserAsync(UserRecord user, CancellationToken cancellationToken);
    Task AssignRoleAsync(Guid userId, string roleCode, Guid? organizationId, CancellationToken cancellationToken);
    Task ReplaceUserRolesAsync(Guid userId, IReadOnlyList<string> roleCodes, Guid? organizationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetRoleCodesAsync(Guid userId, CancellationToken cancellationToken);
    Task<int> CountPlatformAdminsAsync(CancellationToken cancellationToken);
    Task InsertChallengeAsync(ChallengeRecord challenge, CancellationToken cancellationToken);
    Task<ChallengeRecord?> GetChallengeAsync(Guid id, CancellationToken cancellationToken);
    Task UpdateChallengeAsync(ChallengeRecord challenge, CancellationToken cancellationToken);
    Task RevokeActiveChallengesAsync(Guid userId, string challengeType, CancellationToken cancellationToken);
    Task InsertSessionAsync(SessionRecord session, DateTimeOffset issuedAt, CancellationToken cancellationToken);
    Task<SessionRecord?> FindSessionByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task UpdateSessionAsync(SessionRecord session, CancellationToken cancellationToken);
    Task RevokeFamilyAsync(Guid familyId, string reason, DateTimeOffset revokedAt, CancellationToken cancellationToken);
    Task RevokeUserSessionsAsync(Guid userId, string reason, DateTimeOffset revokedAt, CancellationToken cancellationToken);
    Task InsertAuditAsync(
        Guid? actorId,
        Guid? targetUserId,
        string action,
        string result,
        string? reasonCode,
        Guid correlationId,
        CancellationToken cancellationToken);
    Task<(IReadOnlyList<UserRecord> Items, long Total)> ListUsersAsync(int page, int size, CancellationToken cancellationToken);
    Task<IReadOnlyList<MembershipRecord>> GetMembershipsForUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<MembershipRecord>> ListMembershipsAsync(Guid organizationId, CancellationToken cancellationToken);
    Task<MembershipRecord?> GetMembershipAsync(Guid organizationId, Guid membershipId, CancellationToken cancellationToken);
    Task InsertMembershipAsync(MembershipRecord membership, CancellationToken cancellationToken);
    Task UpdateMembershipAsync(MembershipRecord membership, CancellationToken cancellationToken);
}
