using BusTicketPlatform.Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("users", table =>
        {
            table.HasCheckConstraint("ck_users_status", "status in ('PENDING_VERIFICATION','ACTIVE','LOCKED','DISABLED')");
            table.HasCheckConstraint("users_failed_login_count_check", "failed_login_count >= 0");
        });
        builder.HasKey(user => user.Id).HasName("users_pkey");
        builder.Property(user => user.Id).HasColumnName("id");
        builder.Property(user => user.FullName).HasColumnName("full_name").HasMaxLength(150);
        builder.Property(user => user.Email).HasColumnName("email").HasMaxLength(254);
        builder.Property(user => user.NormalizedEmail).HasColumnName("normalized_email").HasMaxLength(254);
        builder.Property(user => user.Phone).HasColumnName("phone").HasMaxLength(20);
        builder.Property(user => user.NormalizedPhone).HasColumnName("normalized_phone").HasMaxLength(20);
        builder.Property(user => user.PasswordHash).HasColumnName("password_hash").HasMaxLength(500);
        builder.Property(user => user.Status).HasColumnName("status").HasMaxLength(40);
        builder.Property(user => user.EmailVerifiedAt).HasColumnName("email_verified_at");
        builder.Property(user => user.FailedLoginCount).HasColumnName("failed_login_count").HasDefaultValue(0);
        builder.Property(user => user.LockoutUntil).HasColumnName("lockout_until");
        builder.Property(user => user.AuthorizationVersion).HasColumnName("authorization_version").HasDefaultValue(0L);
        builder.Property(user => user.CreatedAt).HasColumnName("created_at");
        builder.Property(user => user.UpdatedAt).HasColumnName("updated_at");
        builder.Property(user => user.DeletedAt).HasColumnName("deleted_at");
        builder.Property(user => user.RowVersion).HasColumnName("row_version").HasDefaultValue(0L).IsConcurrencyToken();
        builder.HasQueryFilter(user => user.DeletedAt == null);
        builder.HasIndex(user => user.NormalizedEmail)
            .HasDatabaseName("uq_users_email")
            .IsUnique()
            .HasFilter("deleted_at is null");
        builder.HasIndex(user => user.NormalizedPhone)
            .HasDatabaseName("uq_users_phone")
            .IsUnique()
            .HasFilter("deleted_at is null");
        builder.HasIndex(user => new { user.Status, user.CreatedAt }).HasDatabaseName("ix_users_status").IsDescending(false, true);
    }
}
