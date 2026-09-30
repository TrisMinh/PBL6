namespace BusTicketPlatform.Transport.Domain;

public static class Roles
{
    public const string PlatformAdmin = "PLATFORM_ADMIN";
    public const string OperatorAdmin = "OPERATOR_ADMIN";
    public const string OperatorScheduler = "OPERATOR_SCHEDULER";
    public const string OperatorOperations = "OPERATOR_OPERATIONS";
    public const string Driver = "DRIVER";
}

public static class OrganizationStatuses
{
    public const string Active = "ACTIVE";
}

public static class TripStatuses
{
    public const string Draft = "DRAFT";
    public const string Scheduled = "SCHEDULED";
    public const string Boarding = "BOARDING";
    public const string Departed = "DEPARTED";
    public const string InTransit = "IN_TRANSIT";
    public const string Arrived = "ARRIVED";
    public const string Completed = "COMPLETED";
    public const string Cancelled = "CANCELLED";
}
