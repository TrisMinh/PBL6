using BusTicketPlatform.Identity.Application.Abstractions.Persistence;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Repositories;

public sealed class SecurityAuditRepository(IdentityDbContext dbContext) : ISecurityAuditRepository
{
    public void AddEmailVerified(Guid userId, Guid correlationId, DateTime occurredAt)
    {
        dbContext.SecurityAudits.Add(new SecurityAudit(
            Guid.NewGuid(),
            userId,
            "IDENTITY_EMAIL_VERIFIED",
            "SUCCESS",
            correlationId,
            occurredAt));
    }
}
