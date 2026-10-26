namespace BusTicketPlatform.Identity.Api.Contracts;

public sealed record RegisterRequest(
    string FullName,
    string Email,
    string Phone,
    string Password,
    string ConfirmPassword);

public sealed record VerificationRequest(Guid ChallengeId, string Code);

public sealed record OperationAccepted(Guid OperationId, string Status, string? StatusUrl);

public sealed record VerificationSucceeded(string Status);
