namespace BusTicketPlatform.Identity.Application;

public sealed record RegistrationPolicy(int ChallengeMinutes, int MaxAttempts, int ResendCooldownSeconds);
