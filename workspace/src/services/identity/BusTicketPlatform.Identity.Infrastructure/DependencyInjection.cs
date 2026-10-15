using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Application.Abstractions.Messaging;
using BusTicketPlatform.Identity.Application.Abstractions.Persistence;
using BusTicketPlatform.Identity.Application.Abstractions.Security;
using BusTicketPlatform.Identity.Application.Abstractions.Verification;
using BusTicketPlatform.Identity.Infrastructure.Consumers;
using BusTicketPlatform.Identity.Infrastructure.Data;
using BusTicketPlatform.Identity.Infrastructure.Persistence;
using BusTicketPlatform.Identity.Infrastructure.Persistence.Repositories;
using BusTicketPlatform.Identity.Infrastructure.Services.Caching;
using BusTicketPlatform.Identity.Infrastructure.Services.Email;
using BusTicketPlatform.Identity.Infrastructure.Services.Messaging;
using BusTicketPlatform.Identity.Infrastructure.Services.Security;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace BusTicketPlatform.Identity.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("IdentityDatabase")
            ?? throw new InvalidOperationException("ConnectionStrings:IdentityDatabase is required");
        var redisConnectionString = configuration.GetConnectionString("Redis")
            ?? throw new InvalidOperationException("ConnectionStrings:Redis is required");
        var registration = configuration.GetSection("Registration").Get<RegistrationOptions>()
            ?? throw new InvalidOperationException("Registration configuration is required");
        if (System.Text.Encoding.UTF8.GetByteCount(registration.VerificationSecret) < 32)
        {
            throw new InvalidOperationException("Registration:VerificationSecret must be at least 32 bytes");
        }

        services.Configure<RegistrationOptions>(configuration.GetSection("Registration"));
        services.Configure<SmtpOptions>(configuration.GetSection("Smtp"));
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.AddSingleton(new RegistrationPolicy(
            registration.ChallengeMinutes,
            registration.MaxAttempts,
            registration.ResendCooldownSeconds));
        services.AddPooledDbContextFactory<IdentityDbContext>(options => options.UseNpgsql(connectionString));
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserRoleRepository, UserRoleRepository>();
        services.AddScoped<ISecurityAuditRepository, SecurityAuditRepository>();
        services.AddScoped<IPasswordHasher, Argon2PasswordHasher>();
        services.AddScoped<IVerificationCodeProtector, Pbkdf2VerificationCodeProtector>();
        services.AddScoped<IVerificationCodeStore, RedisVerificationCodeStore>();
        services.AddScoped<IVerificationEmailPublisher, VerificationEmailPublisher>();
        services.AddScoped<SmtpEmailSender>();
        services.AddMassTransit(bus =>
        {
            bus.AddConsumer<VerificationEmailConsumer>();
            bus.UsingRabbitMq((context, rabbit) =>
            {
                var options = context.GetRequiredService<IOptions<RabbitMqOptions>>().Value;
                rabbit.Host(new Uri($"rabbitmq://{options.Host}:{options.Port}/"), host =>
                {
                    host.Username(options.Username);
                    host.Password(options.Password);
                });
                rabbit.ReceiveEndpoint(options.Queue, endpoint =>
                {
                    endpoint.PrefetchCount = 1;
                    endpoint.UseMessageRetry(retry => retry.Interval(3, TimeSpan.FromSeconds(5)));
                    endpoint.ConfigureConsumer<VerificationEmailConsumer>(context);
                });
            });
        });
        return services;
    }
}
