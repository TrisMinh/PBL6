namespace BusTicketPlatform.Payment.Infrastructure;

public sealed class PaymentDatabaseOptions
{
    public const string ConnectionStringName = "Payment";

    public string ConnectionString { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
