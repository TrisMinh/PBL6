using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Infrastructure.Persistence;
using BusTicketPlatform.Identity.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.Identity.Infrastructure;

public static class IdentityInfrastructureExtensions
{
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = new IdentityDatabaseOptions
        {
            ConnectionString = configuration.GetConnectionString(IdentityDatabaseOptions.ConnectionStringName) ?? ""
        };

        services.AddSingleton(options);
        services.Configure<Security.AuthenticationOptions>(configuration.GetSection(Security.AuthenticationOptions.SectionName));
        services.Configure<Security.SmtpOptions>(configuration.GetSection(Security.SmtpOptions.SectionName));
        services.AddSingleton<SqlBaselineMigrator>();
        services.AddHostedService<SqlBaselineHostedService>();
        services.AddSingleton<IPasswordHasher, Argon2PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<CapturingChallengeNotifier>();
        services.AddSingleton<IChallengeMailbox>(sp => sp.GetRequiredService<CapturingChallengeNotifier>());
        services.AddSingleton<IChallengeNotifier, ChallengeNotifier>();
        services.AddSingleton<IIdentityRepository, IdentityRepository>();
        services.AddSingleton<IIdempotencyStore, IdempotencyStore>();
        services.AddSingleton<OutboxPublisher>();
        services.AddSingleton(sp => new BusTicketPlatform.BuildingBlocks.Messaging.OutboxRelay(sp.GetRequiredService<IdentityDatabaseOptions>().ConnectionString));
        services.AddHostedService<BusTicketPlatform.BuildingBlocks.Messaging.OutboxDispatchHostedService>();
        services.AddSingleton<IRegistrationEvents, RegistrationEvents>();
        services.AddSingleton<AuthService>();
        services.AddSingleton<ProfileService>();
        services.AddSingleton<AdminIdentityService>();
        return services;
    }

    public static IHealthChecksBuilder AddIdentityDatabaseCheck(this IHealthChecksBuilder builder)
    {
        return builder.AddCheck<PostgresHealthCheck>("database", tags: ["ready"]);
    }
}
