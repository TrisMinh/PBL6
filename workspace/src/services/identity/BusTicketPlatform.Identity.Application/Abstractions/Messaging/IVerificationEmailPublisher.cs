namespace BusTicketPlatform.Identity.Application.Abstractions.Messaging;

public sealed record VerificationEmail(string Email, Guid ChallengeId, string Code, int ExpiresInMinutes);

public interface IVerificationEmailPublisher
{
    Task PublishAsync(VerificationEmail message, CancellationToken cancellationToken);
}
