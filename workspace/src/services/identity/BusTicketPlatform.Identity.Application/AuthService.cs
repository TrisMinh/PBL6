using System.Security.Cryptography;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.BuildingBlocks.Time;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Application;

public sealed class AuthService(
    IIdentityRepository users,
    IPasswordHasher passwords,
    ITokenService tokens,
    IChallengeNotifier notifier,
    IRegistrationEvents events,
    IClock clock,
    IIdGenerator ids)
{
    public const int LockoutThreshold = 5;
    public const int LockoutMinutes = 15;
    public const int ChallengeMinutes = 30;
    public const int RefreshDays = 14;
    public const int ChallengeAttemptLimit = 5;

    public async Task<Result<AcceptedResponse>> RegisterAsync(RegisterCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!IdentityNormalizer.IsFullName(command.FullName))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.Validation("Full name is invalid.", "fullName"));
        }

        if (!IdentityNormalizer.IsEmail(command.Email))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.Validation("Email is invalid.", "email"));
        }

        if (!IdentityNormalizer.IsPhone(command.Phone))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.Validation("Phone is invalid.", "phone"));
        }

        if (!PasswordPolicy.IsSatisfied(command.Password))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.PasswordPolicy());
        }

        var email = IdentityNormalizer.NormalizeEmail(command.Email);
        var phone = IdentityNormalizer.NormalizePhone(command.Phone);
        var existingEmail = await users.FindByNormalizedEmailAsync(email, cancellationToken);
        var existingPhone = await users.FindByNormalizedPhoneAsync(phone, cancellationToken);
        if (existingEmail is not null || existingPhone is not null)
        {
            if (existingEmail is { Status: UserStatuses.PendingVerification } pending
                && pending.NormalizedEmail == email
                && pending.NormalizedPhone == phone)
            {
                return await IssueChallengeAsync(pending, ChallengeTypes.EmailVerification, command.Email.Trim(), correlationId, cancellationToken);
            }

            await users.InsertAuditAsync(null, existingEmail?.Id ?? existingPhone?.Id, "REGISTER_REJECTED", "IGNORED", "IDENTITY_IN_USE", correlationId, cancellationToken);
            return Result<AcceptedResponse>.Success(new AcceptedResponse(ids.NewUuidV7(), "ACCEPTED"));
        }

        var now = clock.UtcNow;
        var user = new UserRecord(
            ids.NewUuidV7(),
            command.FullName.Trim(),
            command.Email.Trim(),
            email,
            phone,
            phone,
            passwords.Hash(command.Password),
            UserStatuses.PendingVerification,
            null,
            0,
            null,
            0,
            0,
            now);
        await users.InsertUserAsync(user, cancellationToken);
        await users.AssignRoleAsync(user.Id, RoleCodes.Customer, null, cancellationToken);
        await events.UserRegisteredAsync(user.Id, now, correlationId, cancellationToken);
        return await IssueChallengeAsync(user, ChallengeTypes.EmailVerification, command.Email.Trim(), correlationId, cancellationToken);
    }

    public async Task<Result<SessionResponse>> VerifyAsync(VerifyCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        var challenge = await users.GetChallengeAsync(command.ChallengeId, cancellationToken);
        var consumed = await ConsumeChallengeAsync(challenge, command.Code, ChallengeTypes.EmailVerification, cancellationToken);
        if (!consumed.IsSuccess)
        {
            return Result<SessionResponse>.Failure(consumed.Error!);
        }

        var user = await users.FindByIdAsync(challenge!.UserId!.Value, cancellationToken);
        if (user is null)
        {
            return Result<SessionResponse>.Failure(IdentityErrors.VerificationInvalid());
        }

        var email = user.Status == UserStatuses.Active
            ? challenge.TargetNormalized.ToLowerInvariant()
            : user.Email;
        var activated = user with
        {
            Status = UserStatuses.Active,
            Email = email,
            NormalizedEmail = IdentityNormalizer.NormalizeEmail(email),
            EmailVerifiedAt = clock.UtcNow,
            FailedLoginCount = 0,
            LockoutUntil = null,
            RowVersion = user.RowVersion + 1
        };
        await users.UpdateUserAsync(activated, cancellationToken);
        await users.InsertAuditAsync(activated.Id, activated.Id, "REGISTER_VERIFIED", "SUCCEEDED", null, correlationId, cancellationToken);
        return await IssueSessionAsync(activated, correlationId, cancellationToken);
    }

    public async Task<Result<AcceptedResponse>> ResendVerificationAsync(EmailCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!IdentityNormalizer.IsEmail(command.Email))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.Validation("Email is invalid.", "email"));
        }

        var user = await users.FindByNormalizedEmailAsync(IdentityNormalizer.NormalizeEmail(command.Email), cancellationToken);
        if (user is { Status: UserStatuses.PendingVerification })
        {
            return await IssueChallengeAsync(user, ChallengeTypes.EmailVerification, command.Email.Trim(), correlationId, cancellationToken);
        }

        return Result<AcceptedResponse>.Success(new AcceptedResponse(ids.NewUuidV7(), "ACCEPTED"));
    }

    public Task<Result<AcceptedResponse>> IssueEmailChangeAsync(
        UserRecord user,
        string newEmail,
        Guid correlationId,
        CancellationToken cancellationToken) =>
        IssueChallengeAsync(user, ChallengeTypes.EmailVerification, newEmail, correlationId, cancellationToken);

    public async Task<Result<SessionResponse>> LoginAsync(LoginCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdentifierAsync(command.Identifier.Trim(), cancellationToken);
        if (user is null)
        {
            return Result<SessionResponse>.Failure(IdentityErrors.InvalidCredentials());
        }

        if (user.Status == UserStatuses.Locked && (user.LockoutUntil is null || user.LockoutUntil > clock.UtcNow))
        {
            return Result<SessionResponse>.Failure(IdentityErrors.AccountLocked());
        }

        if (user.LockoutUntil is { } expired && expired <= clock.UtcNow && user.Status == UserStatuses.Locked)
        {
            user = user with { Status = UserStatuses.Active, FailedLoginCount = 0, LockoutUntil = null };
        }

        if (user.Status is UserStatuses.Locked or UserStatuses.Disabled
            || user.Status == UserStatuses.PendingVerification
            || !passwords.Verify(command.Password, user.PasswordHash))
        {
            var failures = user.FailedLoginCount + 1;
            var lockout = failures >= LockoutThreshold ? clock.UtcNow.AddMinutes(LockoutMinutes) : (DateTimeOffset?)null;
            await users.UpdateUserAsync(
                user with { FailedLoginCount = failures, LockoutUntil = lockout, Status = lockout is null ? user.Status : UserStatuses.Locked },
                cancellationToken);
            await users.InsertAuditAsync(null, user.Id, "LOGIN_FAILED", "DENIED", lockout is null ? "INVALID_CREDENTIALS" : "ACCOUNT_LOCKED", correlationId, cancellationToken);
            return Result<SessionResponse>.Failure(lockout is null ? IdentityErrors.InvalidCredentials() : IdentityErrors.AccountLocked());
        }

        var unlocked = user with { FailedLoginCount = 0, LockoutUntil = null };
        await users.UpdateUserAsync(unlocked, cancellationToken);
        await users.InsertAuditAsync(user.Id, user.Id, "LOGIN", "SUCCEEDED", null, correlationId, cancellationToken);
        return await IssueSessionAsync(unlocked, correlationId, cancellationToken);
    }

    public async Task<Result<SessionResponse>> RefreshAsync(string? refreshToken, Guid correlationId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Result<SessionResponse>.Failure(IdentityErrors.SessionInvalid());
        }

        var hash = HashSecret(refreshToken);
        var session = await users.FindSessionByTokenHashAsync(hash, cancellationToken);
        if (session is null)
        {
            return Result<SessionResponse>.Failure(IdentityErrors.SessionInvalid());
        }

        if (session.RevokedAt is not null)
        {
            await users.RevokeFamilyAsync(session.FamilyId, "REUSE", clock.UtcNow, cancellationToken);
            await users.InsertAuditAsync(session.UserId, session.UserId, "REFRESH_REUSE", "DENIED", "SESSION_REUSE_DETECTED", correlationId, cancellationToken);
            return Result<SessionResponse>.Failure(IdentityErrors.SessionReuse());
        }

        if (session.ExpiresAt <= clock.UtcNow)
        {
            return Result<SessionResponse>.Failure(IdentityErrors.SessionInvalid());
        }

        var user = await users.FindByIdAsync(session.UserId, cancellationToken);
        if (user is null || user.Status is not UserStatuses.Active)
        {
            await users.RevokeUserSessionsAsync(session.UserId, "USER_INACTIVE", clock.UtcNow, cancellationToken);
            return Result<SessionResponse>.Failure(IdentityErrors.SessionInvalid());
        }

        var now = clock.UtcNow;
        var issued = tokens.Issue(user, await TokenRolesAsync(user.Id, cancellationToken), ids.NewUuidV7(), await TokenOrgAsync(user.Id, cancellationToken));
        var replacement = new SessionRecord(
            ids.NewUuidV7(),
            user.Id,
            session.FamilyId,
            issued.RefreshTokenHash,
            now.AddDays(RefreshDays),
            null,
            null);
        await users.InsertSessionAsync(replacement, now, cancellationToken);
        await users.UpdateSessionAsync(
            session with { RevokedAt = now, ReplacedBySessionId = replacement.Id },
            cancellationToken);
        return Result<SessionResponse>.Success(await ToSession(user, issued.AccessToken, issued.RefreshTokenPlain, issued.ExpiresIn, replacement.Id, cancellationToken));
    }

    public async Task<Result> LogoutAsync(Guid sessionId, Guid userId, Guid correlationId, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await users.RevokeUserSessionsAsync(userId, "LOGOUT", now, cancellationToken);
        await users.InsertAuditAsync(userId, userId, "LOGOUT", "SUCCEEDED", sessionId.ToString(), correlationId, cancellationToken);
        return Result.Success();
    }

    public async Task<Result<AcceptedResponse>> ForgotPasswordAsync(EmailCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!IdentityNormalizer.IsEmail(command.Email))
        {
            return Result<AcceptedResponse>.Failure(IdentityErrors.Validation("Email is invalid.", "email"));
        }

        var user = await users.FindByNormalizedEmailAsync(IdentityNormalizer.NormalizeEmail(command.Email), cancellationToken);
        if (user is { Status: UserStatuses.Active or UserStatuses.Locked })
        {
            return await IssueChallengeAsync(user, ChallengeTypes.PasswordReset, command.Email.Trim(), correlationId, cancellationToken);
        }

        return Result<AcceptedResponse>.Success(new AcceptedResponse(ids.NewUuidV7(), "ACCEPTED"));
    }

    public async Task<Result> ResetPasswordAsync(ResetPasswordCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!PasswordPolicy.IsSatisfied(command.NewPassword))
        {
            return Result.Failure(IdentityErrors.PasswordPolicy());
        }

        var challenge = await users.GetChallengeAsync(command.ChallengeId, cancellationToken);
        var consumed = await ConsumeChallengeAsync(challenge, command.Code, ChallengeTypes.PasswordReset, cancellationToken);
        if (!consumed.IsSuccess)
        {
            return consumed;
        }

        var user = await users.FindByIdAsync(challenge!.UserId!.Value, cancellationToken);
        if (user is null)
        {
            return Result.Failure(IdentityErrors.VerificationInvalid());
        }

        var updated = user with
        {
            PasswordHash = passwords.Hash(command.NewPassword),
            FailedLoginCount = 0,
            LockoutUntil = null,
            Status = user.Status == UserStatuses.Locked ? UserStatuses.Active : user.Status,
            AuthorizationVersion = user.AuthorizationVersion + 1,
            RowVersion = user.RowVersion + 1
        };
        await users.UpdateUserAsync(updated, cancellationToken);
        await users.RevokeUserSessionsAsync(user.Id, "PASSWORD_RESET", clock.UtcNow, cancellationToken);
        await users.InsertAuditAsync(user.Id, user.Id, "PASSWORD_RESET", "SUCCEEDED", null, correlationId, cancellationToken);
        return Result.Success();
    }

    private async Task<Result<AcceptedResponse>> IssueChallengeAsync(
        UserRecord user,
        string type,
        string email,
        Guid correlationId,
        CancellationToken cancellationToken)
    {
        await users.RevokeActiveChallengesAsync(user.Id, type, cancellationToken);
        var now = clock.UtcNow;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var challengeId = ids.NewUuidV7();
        var challenge = new ChallengeRecord(
            challengeId,
            user.Id,
            IdentityNormalizer.NormalizeEmail(email),
            type,
            HashSecret($"{challengeId:N}:{code}"),
            ChallengeStatuses.Active,
            0,
            now.AddMinutes(ChallengeMinutes));
        await users.InsertChallengeAsync(challenge, cancellationToken);
        await notifier.NotifyAsync(email, type, challengeId, code, cancellationToken);
        await users.InsertAuditAsync(user.Id, user.Id, type, "SUCCEEDED", "CHALLENGE_ISSUED", correlationId, cancellationToken);
        return Result<AcceptedResponse>.Success(new AcceptedResponse(challengeId, "ACCEPTED"));
    }

    private async Task<Result> ConsumeChallengeAsync(
        ChallengeRecord? challenge,
        string code,
        string expectedType,
        CancellationToken cancellationToken)
    {
        if (challenge is null || challenge.ChallengeType != expectedType)
        {
            return Result.Failure(IdentityErrors.VerificationInvalid());
        }

        if (challenge.Status != ChallengeStatuses.Active)
        {
            return Result.Failure(challenge.ExpiresAt <= clock.UtcNow
                ? IdentityErrors.VerificationExpired()
                : IdentityErrors.VerificationInvalid());
        }

        if (challenge.ExpiresAt <= clock.UtcNow)
        {
            await users.UpdateChallengeAsync(challenge with { Status = ChallengeStatuses.Expired }, cancellationToken);
            return Result.Failure(IdentityErrors.VerificationExpired());
        }

        if (!FixedEquals(challenge.TokenHash, HashSecret($"{challenge.Id:N}:{code}")))
        {
            var attempts = challenge.FailedAttempts + 1;
            var status = attempts >= ChallengeAttemptLimit ? ChallengeStatuses.Revoked : challenge.Status;
            await users.UpdateChallengeAsync(challenge with { FailedAttempts = attempts, Status = status }, cancellationToken);
            return Result.Failure(IdentityErrors.VerificationInvalid());
        }

        await users.UpdateChallengeAsync(
            challenge with { Status = ChallengeStatuses.Consumed },
            cancellationToken);
        return Result.Success();
    }

    private async Task<Result<SessionResponse>> IssueSessionAsync(UserRecord user, Guid correlationId, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var sessionId = ids.NewUuidV7();
        var roles = await TokenRolesAsync(user.Id, cancellationToken);
        var issued = tokens.Issue(user, roles, sessionId, await TokenOrgAsync(user.Id, cancellationToken));
        var session = new SessionRecord(
            sessionId,
            user.Id,
            ids.NewUuidV7(),
            issued.RefreshTokenHash,
            now.AddDays(RefreshDays),
            null,
            null);
        await users.InsertSessionAsync(session, now, cancellationToken);
        _ = correlationId;
        return Result<SessionResponse>.Success(await ToSession(user, issued.AccessToken, issued.RefreshTokenPlain, issued.ExpiresIn, sessionId, cancellationToken));
    }

    private async Task<SessionResponse> ToSession(
        UserRecord user,
        string accessToken,
        string refreshToken,
        int expiresIn,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var profile = await ProfileMapper.MapAsync(user, users, cancellationToken);
        return new SessionResponse(accessToken, refreshToken, "Bearer", expiresIn, sessionId, profile);
    }

    private async Task<IReadOnlyList<string>> TokenRolesAsync(Guid userId, CancellationToken cancellationToken)
    {
        var roles = (await users.GetRoleCodesAsync(userId, cancellationToken)).ToList();
        var memberships = await users.GetMembershipsForUserAsync(userId, cancellationToken);
        foreach (var membership in memberships.Where(item => item.Status == "ACTIVE"))
        {
            roles.AddRange(membership.RoleCodes);
        }

        return roles.Distinct(StringComparer.Ordinal).ToArray();
    }

    private async Task<Guid?> TokenOrgAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await users.GetMembershipsForUserAsync(userId, cancellationToken);
        return memberships.FirstOrDefault(item => item.Status == "ACTIVE")?.OrganizationId;
    }

    public static string HashSecret(string value) =>
        Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));

    private static bool FixedEquals(string left, string right) =>
        CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(left),
            System.Text.Encoding.UTF8.GetBytes(right));
}

public static class ProfileMapper
{
    public static async Task<UserProfileDto> MapAsync(
        UserRecord user,
        IIdentityRepository users,
        CancellationToken cancellationToken)
    {
        var roles = await users.GetRoleCodesAsync(user.Id, cancellationToken);
        var memberships = await users.GetMembershipsForUserAsync(user.Id, cancellationToken);
        return new UserProfileDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Phone,
            user.Status,
            roles,
            memberships.Select(m => new MembershipDto(m.Id, m.UserId, m.OrganizationId, m.Status, m.RoleCodes, m.RowVersion)).ToArray(),
            user.RowVersion,
            user.CreatedAt);
    }
}
