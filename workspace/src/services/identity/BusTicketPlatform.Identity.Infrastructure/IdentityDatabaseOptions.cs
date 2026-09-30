namespace BusTicketPlatform.Identity.Infrastructure;

public sealed class IdentityDatabaseOptions
{
    public const string ConnectionStringName = "Identity";

    public string ConnectionString { get; init; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
