namespace BusTicketPlatform.Identity.Application;

public sealed record RegisterCommand(string FullName, string Email, string Phone, string Password);

public sealed record VerifyCommand(Guid ChallengeId, string Code);

public sealed record EmailCommand(string Email);

public sealed record LoginCommand(string Identifier, string Password);

public sealed record RefreshCommand(string RefreshToken);

public sealed record ResetPasswordCommand(Guid ChallengeId, string Code, string NewPassword);

public sealed record UpdateProfileCommand(
    Guid UserId,
    string? FullName,
    string? Email,
    string? Phone,
    long ExpectedVersion);

public sealed record ChangeStatusCommand(Guid ActorId, Guid UserId, string Status, string Reason, long ExpectedVersion);

public sealed record ReplaceRolesCommand(Guid ActorId, Guid UserId, IReadOnlyList<string> RoleCodes, string Reason, long ExpectedVersion);

public sealed record MembershipCommand(
    Guid ActorId,
    Guid OrganizationId,
    Guid UserId,
    IReadOnlyList<string> RoleCodes,
    string Status,
    string Reason,
    long ExpectedVersion,
    Guid? MembershipId = null);

public sealed record AcceptedResponse(Guid OperationId, string Status);

public sealed record SessionResponse(
    string AccessToken,
    string RefreshToken,
    string TokenType,
    int ExpiresIn,
    Guid SessionId,
    UserProfileDto User);

public sealed record UserProfileDto(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string Status,
    IReadOnlyList<string> Roles,
    IReadOnlyList<MembershipDto> OrganizationMemberships,
    long RowVersion,
    DateTimeOffset? CreatedAt = null);

public sealed record MembershipDto(
    Guid Id,
    Guid UserId,
    Guid OrganizationId,
    string Status,
    IReadOnlyList<string> RoleCodes,
    long RowVersion);

public sealed record UserPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<UserProfileDto> Items);

public sealed record UserRecord(
    Guid Id,
    string FullName,
    string Email,
    string NormalizedEmail,
    string Phone,
    string NormalizedPhone,
    string PasswordHash,
    string Status,
    DateTimeOffset? EmailVerifiedAt,
    int FailedLoginCount,
    DateTimeOffset? LockoutUntil,
    long AuthorizationVersion,
    long RowVersion,
    DateTimeOffset CreatedAt);

public sealed record ChallengeRecord(
    Guid Id,
    Guid? UserId,
    string TargetNormalized,
    string ChallengeType,
    string TokenHash,
    string Status,
    int FailedAttempts,
    DateTimeOffset ExpiresAt);

public sealed record SessionRecord(
    Guid Id,
    Guid UserId,
    Guid FamilyId,
    string TokenHash,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? RevokedAt,
    Guid? ReplacedBySessionId);

public sealed record MembershipRecord(
    Guid Id,
    Guid UserId,
    Guid OrganizationId,
    string Status,
    long RowVersion,
    IReadOnlyList<string> RoleCodes);
