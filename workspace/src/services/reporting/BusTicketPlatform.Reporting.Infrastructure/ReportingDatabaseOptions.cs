namespace BusTicketPlatform.Reporting.Infrastructure;

public sealed class ReportingDatabaseOptions
{
    public const string ConnectionStringName = "Reporting";

    public string ConnectionString { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
