using System.Net;
using System.Net.Mail;
using BusTicketPlatform.Identity.Application.Abstractions.Messaging;
using Microsoft.Extensions.Options;

namespace BusTicketPlatform.Identity.Infrastructure.Services.Email;

public sealed class SmtpEmailSender(IOptions<SmtpOptions> options)
{
    public async Task SendAsync(VerificationEmail email, CancellationToken cancellationToken)
    {
        var smtp = options.Value;
        using var message = new MailMessage(smtp.From, email.Email)
        {
            Subject = "Verify your Bus Ticket account",
            Body = $"Challenge ID: {email.ChallengeId}\nVerification code: {email.Code}\nExpires in {email.ExpiresInMinutes} minutes."
        };
        using var client = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = smtp.EnableSsl
        };
        if (!string.IsNullOrWhiteSpace(smtp.Username))
        {
            client.Credentials = new NetworkCredential(smtp.Username, smtp.Password);
        }

        await client.SendMailAsync(message, cancellationToken);
    }
}
