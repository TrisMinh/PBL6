using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore;

public static class PlatformOpenApiExtensions
{
    public static IServiceCollection AddPlatformOpenApi(this IServiceCollection services)
    {
        services.AddOpenApi();
        return services;
    }

    public static IServiceCollection AddPlatformSwaggerCors(this IServiceCollection services)
    {
        services.AddCors(options =>
        {
            options.AddPolicy("swagger", policy =>
            {
                policy
                    .WithOrigins("http://localhost:5080")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        return services;
    }

    public static IEndpointRouteBuilder MapPlatformOpenApi(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapOpenApi();
        return endpoints;
    }

    public static IApplicationBuilder UsePlatformSwaggerCors(this IApplicationBuilder app)
    {
        return app.UseCors("swagger");
    }
}