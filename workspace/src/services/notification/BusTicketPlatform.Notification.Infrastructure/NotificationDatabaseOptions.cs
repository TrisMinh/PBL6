namespace BusTicketPlatform.Notification.Infrastructure;

public sealed class NotificationDatabaseOptions
{
    public const string ConnectionStringName = "Notification";

    public string ConnectionString { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
