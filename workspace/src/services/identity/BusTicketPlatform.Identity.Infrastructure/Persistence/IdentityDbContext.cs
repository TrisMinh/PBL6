using BusTicketPlatform.Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<UserAccount> Users => Set<UserAccount>();
    internal DbSet<UserRole> UserRoles => Set<UserRole>();
    internal DbSet<Role> Roles => Set<Role>();
    internal DbSet<SecurityAudit> SecurityAudits => Set<SecurityAudit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pgcrypto");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);
    }
}

internal sealed class Role
{
    private Role()
    {
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Scope { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool SystemRole { get; private set; }
    public DateTime CreatedAt { get; private set; }
}

internal sealed class UserRole(Guid id, Guid userId, Guid roleId, DateTime createdAt)
{
    private UserRole() : this(Guid.Empty, Guid.Empty, Guid.Empty, default)
    {
    }

    public Guid Id { get; private set; } = id;
    public Guid UserId { get; private set; } = userId;
    public Guid RoleId { get; private set; } = roleId;
    public Guid? OrganizationId { get; private set; }
    public bool Active { get; private set; } = true;
    public DateTime CreatedAt { get; private set; } = createdAt;
    public DateTime? EndedAt { get; private set; }
}

internal sealed class SecurityAudit(
    Guid id,
    Guid targetUserId,
    string action,
    string result,
    Guid correlationId,
    DateTime occurredAt)
{
    private SecurityAudit() : this(Guid.Empty, Guid.Empty, string.Empty, string.Empty, Guid.Empty, default)
    {
    }

    public Guid Id { get; private set; } = id;
    public Guid? ActorId { get; private set; }
    public Guid? TargetUserId { get; private set; } = targetUserId;
    public string Action { get; private set; } = action;
    public string Result { get; private set; } = result;
    public string? ReasonCode { get; private set; }
    public Guid CorrelationId { get; private set; } = correlationId;
    public string SafeMetadata { get; private set; } = "{}";
    public DateTime OccurredAt { get; private set; } = occurredAt;
}
