using BusTicketPlatform.Identity.Application.Abstractions.Messaging;
using BusTicketPlatform.Identity.Application.Abstractions.Persistence;
using BusTicketPlatform.Identity.Application.Abstractions.Security;
using BusTicketPlatform.Identity.Application.Abstractions.Verification;
using BusTicketPlatform.Identity.Application.Features.Registration.Register.Results;
using BusTicketPlatform.Identity.Domain.Users;
using MediatR;

namespace BusTicketPlatform.Identity.Application.Features.Registration.Register.Commands;

public sealed class RegisterCommandHandler(
    IUserRepository userRepository,
    IUserRoleRepository userRoleRepository,
    IPasswordHasher passwordHasher,
    IVerificationCodeProtector codeProtector,
    IVerificationCodeStore codeStore,
    IVerificationEmailPublisher emailPublisher,
    RegistrationPolicy policy) : IRequestHandler<RegisterCommand, RegisterResult>
{
    public async Task<RegisterResult> Handle(RegisterCommand command, CancellationToken cancellationToken)
    {
        var normalizedEmail = command.Email.Trim().ToLowerInvariant();
        var phone = command.Phone.Trim();
        var operationId = Guid.NewGuid();
        Guid userId;

        var matches = await userRepository.FindRegistrationMatchesAsync(
            normalizedEmail,
            phone,
            cancellationToken);
        var pendingUser = matches.Count == 1 && matches[0].Status == UserStatuses.PendingVerification
            ? matches[0]
            : null;

        if (pendingUser is null && matches.Count > 0)
        {
            return new RegisterResult(operationId);
        }

        if (pendingUser is not null)
        {
            userId = pendingUser.Id;
            var sameRegistration = pendingUser.NormalizedEmail == normalizedEmail &&
                                   pendingUser.NormalizedPhone == phone;
            if (!sameRegistration)
            {
                if (await codeStore.HasActiveChallengeAsync(userId))
                {
                    return new RegisterResult(operationId);
                }

                var user = await userRepository.FindAsync(userId, cancellationToken);
                if (user is null || user.Status != UserStatuses.PendingVerification)
                {
                    return new RegisterResult(operationId);
                }

                user.RestartRegistration(
                    command.FullName.Trim(),
                    command.Email.Trim(),
                    normalizedEmail,
                    phone,
                    phone,
                    await passwordHasher.HashAsync(command.Password),
                    DateTime.UtcNow);
                if (!await userRepository.SaveChangesAsync(cancellationToken))
                {
                    return new RegisterResult(operationId);
                }
            }
        }
        else
        {
            userId = Guid.NewGuid();
            var user = new UserAccount(
                userId,
                command.FullName.Trim(),
                command.Email.Trim(),
                normalizedEmail,
                phone,
                phone,
                await passwordHasher.HashAsync(command.Password),
                UserStatuses.PendingVerification,
                0);
            userRepository.Add(user);
            await userRoleRepository.AssignCustomerAsync(userId, cancellationToken);
            if (!await userRepository.SaveChangesAsync(cancellationToken))
            {
                var concurrentMatches = await userRepository.FindRegistrationMatchesAsync(
                    normalizedEmail,
                    phone,
                    cancellationToken);
                var concurrentUser = concurrentMatches.SingleOrDefault(match =>
                    match.Status == UserStatuses.PendingVerification &&
                    match.NormalizedEmail == normalizedEmail &&
                    match.NormalizedPhone == phone);
                if (concurrentUser is null)
                {
                    return new RegisterResult(operationId);
                }

                userId = concurrentUser.Id;
            }
        }

        var code = codeProtector.GenerateCode();
        var protectedCode = codeProtector.Protect(operationId, code);
        var storedCode = await codeStore.StoreAsync(
            userId,
            operationId,
            protectedCode.Hash,
            protectedCode.Salt,
            TimeSpan.FromMinutes(policy.ChallengeMinutes),
            TimeSpan.FromSeconds(policy.ResendCooldownSeconds));
        if (!storedCode.Created)
        {
            return new RegisterResult(storedCode.ChallengeId);
        }

        await emailPublisher.PublishAsync(
            new VerificationEmail(command.Email.Trim(), storedCode.ChallengeId, code, policy.ChallengeMinutes),
            cancellationToken);

        return new RegisterResult(storedCode.ChallengeId);
    }
}
