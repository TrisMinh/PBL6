namespace BusTicketPlatform.Identity.Infrastructure.Services.Security;

public sealed class RegistrationOptions
{
    public string VerificationSecret { get; init; } = string.Empty;
    public int ChallengeMinutes { get; init; } = 5;
    public int MaxAttempts { get; init; } = 5;
    public int ResendCooldownSeconds { get; init; } = 60;
}
