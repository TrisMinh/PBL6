using BusTicketPlatform.Identity.Application.Abstractions.Messaging;
using BusTicketPlatform.Identity.Infrastructure.Services.Email;
using MassTransit;

namespace BusTicketPlatform.Identity.Infrastructure.Consumers;

public sealed class VerificationEmailConsumer(SmtpEmailSender emailSender) : IConsumer<VerificationEmail>
{
    public Task Consume(ConsumeContext<VerificationEmail> context) =>
        emailSender.SendAsync(context.Message, context.CancellationToken);
}
