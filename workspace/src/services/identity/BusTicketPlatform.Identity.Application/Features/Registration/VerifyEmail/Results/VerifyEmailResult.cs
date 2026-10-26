namespace BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Results;

public sealed record VerifyEmailResult(bool Succeeded, string? ErrorCode);
