using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore.Health;

public static class HealthEndpointExtensions
{
    public static IEndpointRouteBuilder MapPlatformHealth(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/live", new HealthCheckOptions
        {
            Predicate = static check => check.Tags.Contains("live"),
            ResponseWriter = WriteStatus
        });

        endpoints.MapHealthChecks("/ready", new HealthCheckOptions
        {
            Predicate = static check => check.Tags.Contains("ready"),
            ResponseWriter = WriteStatus
        });

        endpoints.MapHealthChecks("/startup", new HealthCheckOptions
        {
            Predicate = static check => check.Tags.Contains("startup"),
            ResponseWriter = WriteStatus
        });

        endpoints.MapHealthChecks("/health", new HealthCheckOptions
        {
            Predicate = static check => check.Tags.Contains("live"),
            ResponseWriter = WriteStatus
        });

        return endpoints;
    }

    private static Task WriteStatus(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        var payload = new
        {
            status = report.Status.ToString().ToLowerInvariant()
        };
        return context.Response.WriteAsJsonAsync(payload);
    }
}
