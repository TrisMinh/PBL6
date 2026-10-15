namespace BusTicketPlatform.Identity.Application.Abstractions.Persistence;

public interface ISecurityAuditRepository
{
    void AddEmailVerified(Guid userId, Guid correlationId, DateTime occurredAt);
}
