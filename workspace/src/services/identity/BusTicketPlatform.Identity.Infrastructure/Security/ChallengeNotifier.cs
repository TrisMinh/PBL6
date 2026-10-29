using System.Collections.Concurrent;
using System.Net;
using System.Net.Mail;
using BusTicketPlatform.Identity.Application;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusTicketPlatform.Identity.Infrastructure.Security;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "";
    public int Port { get; set; } = 1025;
    public string From { get; set; } = "noreply@example.test";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public bool EnableSsl { get; set; }
    public bool CaptureChallenges { get; set; } = true;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host);
}

public sealed class CapturingChallengeNotifier : IChallengeMailbox
{
    private readonly ConcurrentDictionary<string, ChallengeNotice> _last = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<Guid, ChallengeNotice> _byChallenge = new();

    public ChallengeNotice? LastFor(string email) =>
        _last.TryGetValue(email.Trim(), out var notice) ? notice : null;

    public ChallengeNotice? ByChallenge(Guid challengeId) =>
        _byChallenge.TryGetValue(challengeId, out var notice) ? notice : null;

    public void Remember(ChallengeNotice notice)
    {
        _last[notice.Email] = notice;
        _byChallenge[notice.ChallengeId] = notice;
    }
}

public sealed class ChallengeNotifier(
    CapturingChallengeNotifier mailbox,
    IOptions<SmtpOptions> smtp,
    ILogger<ChallengeNotifier> logger) : IChallengeNotifier
{
    public async Task NotifyAsync(
        string email,
        string challengeType,
        Guid challengeId,
        string code,
        CancellationToken cancellationToken)
    {
        var options = smtp.Value;
        if (options.CaptureChallenges)
        {
            mailbox.Remember(new ChallengeNotice(email, challengeType, challengeId, code));
        }

        if (!options.IsConfigured)
        {
            return;
        }

        try
        {
            using var message = new MailMessage(options.From, email)
            {
                Subject = challengeType == "PASSWORD_RESET" ? "Reset your password" : "Verify your email",
                Body = $"challengeId={challengeId}; code={code}"
            };
            using var client = new SmtpClient(options.Host, options.Port)
            {
                DeliveryMethod = SmtpDeliveryMethod.Network,
                EnableSsl = options.EnableSsl,
                Credentials = string.IsNullOrWhiteSpace(options.Username)
                    ? CredentialCache.DefaultNetworkCredentials
                    : new NetworkCredential(options.Username, options.Password)
            };
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Challenge email delivery failed; domain change was kept.");
        }
    }
}
