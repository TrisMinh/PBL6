using FluentValidation;

namespace BusTicketPlatform.Identity.Application.Features.Registration.Register.Commands;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(command => command.FullName).NotEmpty().Length(2, 150);
        RuleFor(command => command.Email).NotEmpty().MaximumLength(254).EmailAddress();
        RuleFor(command => command.Phone).NotEmpty().Matches(@"^\+[1-9][0-9]{7,14}$");
        RuleFor(command => command.Password)
            .NotEmpty()
            .Length(10, 128)
            .Matches(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$")
            .WithMessage("Password must contain uppercase, lowercase, number, and special character");
        RuleFor(command => command.ConfirmPassword)
            .NotEmpty()
            .Equal(command => command.Password)
            .WithMessage("Passwords do not match");
    }
}
