namespace BusTicketPlatform.Identity.Infrastructure.Services.Email;

public sealed class SmtpOptions
{
    public string Host { get; init; } = "smtp.gmail.com";
    public int Port { get; init; } = 587;
    public string From { get; init; } = string.Empty;
    public bool EnableSsl { get; init; } = true;
    public string? Username { get; init; }
    public string? Password { get; init; }
}
