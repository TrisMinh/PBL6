using System.Threading.RateLimiting;
using BusTicketPlatform.Identity.Api.ExceptionHandling;
using Microsoft.AspNetCore.Mvc;

namespace BusTicketPlatform.Identity.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddIdentityApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers(options =>
            options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();
        services.AddRateLimiter(options =>
        {
            options.AddPolicy("registration", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                }));
            options.OnRejected = (context, _) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                return ValueTask.CompletedTask;
            };
        });
        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(
                GlobalExceptionHandler.CreateError(
                    context.HttpContext,
                    "VALIDATION_ERROR",
                    "The request is invalid"));
        });
        return services;
    }
}
