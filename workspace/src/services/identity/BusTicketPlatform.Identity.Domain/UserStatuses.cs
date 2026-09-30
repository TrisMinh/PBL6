namespace BusTicketPlatform.Identity.Domain;

public static class UserStatuses
{
    public const string PendingVerification = "PENDING_VERIFICATION";
    public const string Active = "ACTIVE";
    public const string Locked = "LOCKED";
    public const string Disabled = "DISABLED";
}

public static class ChallengeTypes
{
    public const string EmailVerification = "EMAIL_VERIFICATION";
    public const string PasswordReset = "PASSWORD_RESET";
}

public static class ChallengeStatuses
{
    public const string Active = "ACTIVE";
    public const string Consumed = "CONSUMED";
    public const string Expired = "EXPIRED";
    public const string Revoked = "REVOKED";
}

public static class RoleCodes
{
    public const string Customer = "CUSTOMER";
    public const string PlatformAdmin = "PLATFORM_ADMIN";
}
