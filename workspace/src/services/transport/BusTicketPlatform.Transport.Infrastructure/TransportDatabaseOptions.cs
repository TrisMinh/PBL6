namespace BusTicketPlatform.Transport.Infrastructure;

public sealed class TransportDatabaseOptions
{
    public const string ConnectionStringName = "Transport";

    public string ConnectionString { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
