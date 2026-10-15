using BusTicketPlatform.Identity.Application.Features.Registration.Register.Results;
using MediatR;

namespace BusTicketPlatform.Identity.Application.Features.Registration.Register.Commands;

public sealed record RegisterCommand(
    string FullName,
    string Email,
    string Phone,
    string Password,
    string ConfirmPassword) : IRequest<RegisterResult>;
