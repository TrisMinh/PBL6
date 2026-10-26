namespace BusTicketPlatform.Identity.Domain.Users;

public static class UserStatuses
{
    public const string PendingVerification = "PENDING_VERIFICATION";
    public const string Active = "ACTIVE";
}

public sealed class UserAccount
{
    private UserAccount()
    {
    }

    public UserAccount(
        Guid id,
        string fullName,
        string email,
        string normalizedEmail,
        string phone,
        string normalizedPhone,
        string passwordHash,
        string status,
        long rowVersion)
    {
        Id = id;
        FullName = fullName;
        Email = email;
        NormalizedEmail = normalizedEmail;
        Phone = phone;
        NormalizedPhone = normalizedPhone;
        PasswordHash = passwordHash;
        Status = status;
        RowVersion = rowVersion;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string NormalizedPhone { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;
    public DateTime? EmailVerifiedAt { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTime? LockoutUntil { get; private set; }
    public long AuthorizationVersion { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public long RowVersion { get; private set; }

    public void Activate(DateTime verifiedAt)
    {
        Status = UserStatuses.Active;
        EmailVerifiedAt = verifiedAt;
        UpdatedAt = verifiedAt;
        RowVersion++;
    }

    public void RestartRegistration(
        string fullName,
        string email,
        string normalizedEmail,
        string phone,
        string normalizedPhone,
        string passwordHash,
        DateTime updatedAt)
    {
        if (Status != UserStatuses.PendingVerification)
        {
            throw new InvalidOperationException("Only pending users can restart registration");
        }

        FullName = fullName;
        Email = email;
        NormalizedEmail = normalizedEmail;
        Phone = phone;
        NormalizedPhone = normalizedPhone;
        PasswordHash = passwordHash;
        UpdatedAt = updatedAt;
        RowVersion++;
    }
}
