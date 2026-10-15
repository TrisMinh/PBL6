using FluentValidation;

namespace BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Commands;

public sealed class VerifyEmailCommandValidator : AbstractValidator<VerifyEmailCommand>
{
    public VerifyEmailCommandValidator()
    {
        RuleFor(command => command.Code)
            .NotEmpty()
            .Matches(@"^[0-9]{6}$")
            .WithMessage("Code must contain exactly 6 digits");
    }
}
