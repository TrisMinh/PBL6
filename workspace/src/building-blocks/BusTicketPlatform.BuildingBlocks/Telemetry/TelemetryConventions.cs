namespace BusTicketPlatform.BuildingBlocks.Telemetry;

public static class TelemetryConventions
{
    public const string ServiceNamespace = "busticket";
    public const string CorrelationTag = "correlation.id";
    public const string EventIdTag = "messaging.event_id";
    public const string EventTypeTag = "messaging.event_type";
}
