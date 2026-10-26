using BusTicketPlatform.Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Configurations;

internal sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("user_roles");
        builder.HasKey(userRole => userRole.Id).HasName("user_roles_pkey");
        builder.Property(userRole => userRole.Id).HasColumnName("id");
        builder.Property(userRole => userRole.UserId).HasColumnName("user_id");
        builder.Property(userRole => userRole.RoleId).HasColumnName("role_id");
        builder.Property(userRole => userRole.OrganizationId).HasColumnName("organization_id_external");
        builder.Property(userRole => userRole.Active).HasColumnName("active").HasDefaultValue(true);
        builder.Property(userRole => userRole.CreatedAt).HasColumnName("created_at");
        builder.Property(userRole => userRole.EndedAt).HasColumnName("ended_at");
        builder.HasOne<UserAccount>().WithMany().HasForeignKey(userRole => userRole.UserId).OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("user_roles_user_id_fkey");
        builder.HasOne<Role>().WithMany().HasForeignKey(userRole => userRole.RoleId).OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("user_roles_role_id_fkey");
        builder.HasIndex(userRole => new { userRole.UserId, userRole.RoleId })
            .HasDatabaseName("uq_user_platform_role_active")
            .IsUnique()
            .HasFilter("active and organization_id_external is null");
        builder.HasIndex(userRole => new { userRole.UserId, userRole.RoleId, userRole.OrganizationId })
            .HasDatabaseName("uq_user_tenant_role_active")
            .IsUnique()
            .HasFilter("active and organization_id_external is not null");
        builder.HasIndex(userRole => new { userRole.UserId, userRole.OrganizationId })
            .HasDatabaseName("ix_user_roles_context")
            .HasFilter("active");
    }
}
