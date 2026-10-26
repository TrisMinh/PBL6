using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Configurations;

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles", table =>
            table.HasCheckConstraint("ck_roles_scope", "scope in ('PLATFORM','TENANT','OWN')"));
        builder.HasKey(role => role.Id).HasName("roles_pkey");
        builder.Property(role => role.Id).HasColumnName("id");
        builder.Property(role => role.Code).HasColumnName("code").HasMaxLength(80);
        builder.Property(role => role.Scope).HasColumnName("scope").HasMaxLength(20);
        builder.Property(role => role.Description).HasColumnName("description").HasMaxLength(500);
        builder.Property(role => role.SystemRole).HasColumnName("system_role").HasDefaultValue(true);
        builder.Property(role => role.CreatedAt).HasColumnName("created_at");
        builder.HasAlternateKey(role => role.Code).HasName("roles_code_key");
        builder.HasData(new
        {
            Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
            Code = "CUSTOMER",
            Scope = "OWN",
            Description = "Own-resource customer policy",
            SystemRole = true,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}
