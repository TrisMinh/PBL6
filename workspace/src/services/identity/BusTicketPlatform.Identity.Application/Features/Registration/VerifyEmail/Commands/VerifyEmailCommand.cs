using BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Results;
using MediatR;

namespace BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Commands;

public sealed record VerifyEmailCommand(
    Guid ChallengeId,
    string Code,
    Guid CorrelationId) : IRequest<VerifyEmailResult>;
