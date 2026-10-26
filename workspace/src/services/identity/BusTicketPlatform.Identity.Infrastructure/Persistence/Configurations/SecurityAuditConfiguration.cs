using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Configurations;

internal sealed class SecurityAuditConfiguration : IEntityTypeConfiguration<SecurityAudit>
{
    public void Configure(EntityTypeBuilder<SecurityAudit> builder)
    {
        builder.ToTable("security_audits");
        builder.HasKey(audit => audit.Id).HasName("security_audits_pkey");
        builder.Property(audit => audit.Id).HasColumnName("id");
        builder.Property(audit => audit.ActorId).HasColumnName("actor_id");
        builder.Property(audit => audit.TargetUserId).HasColumnName("target_user_id");
        builder.Property(audit => audit.Action).HasColumnName("action").HasMaxLength(120);
        builder.Property(audit => audit.Result).HasColumnName("result").HasMaxLength(40);
        builder.Property(audit => audit.ReasonCode).HasColumnName("reason_code").HasMaxLength(80);
        builder.Property(audit => audit.CorrelationId).HasColumnName("correlation_id");
        builder.Property(audit => audit.SafeMetadata).HasColumnName("safe_metadata").HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
        builder.Property(audit => audit.OccurredAt).HasColumnName("occurred_at");
        builder.HasIndex(audit => new { audit.TargetUserId, audit.OccurredAt })
            .HasDatabaseName("ix_security_audit_target_time")
            .IsDescending(false, true);
        builder.HasIndex(audit => new { audit.Action, audit.OccurredAt })
            .HasDatabaseName("ix_security_audit_action_time")
            .IsDescending(false, true);
    }
}
