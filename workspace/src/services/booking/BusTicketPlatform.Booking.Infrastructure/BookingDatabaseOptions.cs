namespace BusTicketPlatform.Booking.Infrastructure;

public sealed class BookingDatabaseOptions
{
    public const string ConnectionStringName = "Booking";

    public string ConnectionString { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
