using BusTicketPlatform.Identity.Application.Abstractions.Persistence;
using BusTicketPlatform.Identity.Application.Abstractions.Security;
using BusTicketPlatform.Identity.Application.Abstractions.Verification;
using BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Results;
using BusTicketPlatform.Identity.Domain.Users;
using MediatR;

namespace BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Commands;

public sealed class VerifyEmailCommandHandler(
    IUserRepository userRepository,
    ISecurityAuditRepository securityAuditRepository,
    IVerificationCodeProtector codeProtector,
    IVerificationCodeStore codeStore,
    RegistrationPolicy policy) : IRequestHandler<VerifyEmailCommand, VerifyEmailResult>
{
    public async Task<VerifyEmailResult> Handle(VerifyEmailCommand command, CancellationToken cancellationToken)
    {
        var challenge = await codeStore.FindAsync(command.ChallengeId);
        if (challenge is null)
        {
            return Invalid();
        }

        var valid = codeProtector.Verify(
            command.ChallengeId,
            command.Code,
            challenge.CodeHash,
            challenge.CodeSalt);
        if (!await codeStore.TryConsumeAsync(
                command.ChallengeId,
                challenge,
                valid,
                policy.MaxAttempts))
        {
            return Invalid();
        }

        var user = await userRepository.FindAsync(challenge.UserId, cancellationToken);
        if (user is null || user.Status != UserStatuses.PendingVerification)
        {
            return Invalid();
        }

        var now = DateTime.UtcNow;
        await userRepository.ActivateAsync(user.Id, now, cancellationToken);
        securityAuditRepository.AddEmailVerified(user.Id, command.CorrelationId, now);
        if (!await userRepository.SaveChangesAsync(cancellationToken))
        {
            return Invalid();
        }

        return new VerifyEmailResult(true, null);
    }

    private static VerifyEmailResult Invalid() => new(false, "VERIFICATION_INVALID");
}
