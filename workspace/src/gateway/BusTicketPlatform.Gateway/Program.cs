using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBuildingBlocks();
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"]);

var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("clients", policy =>
    {
        if (origins.Length == 0 || origins.Contains("*", StringComparer.Ordinal))
        {
            policy.AllowAnyOrigin();
        }
        else
        {
            policy.WithOrigins(origins);
        }

        policy
            .WithHeaders("Authorization", "Content-Type", "Accept", "Idempotency-Key", "X-Correlation-Id")
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .WithExposedHeaders("X-Correlation-Id");
    });
});

var app = builder.Build();

app.UseCors("clients");
app.UseBuildingBlocks();
app.MapPlatformHealth();
app.MapGet("/openapi.yaml", (IWebHostEnvironment environment) =>
{
    var candidates = new[]
    {
        Path.Combine(environment.ContentRootPath, "openapi.yaml"),
        Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "..", "..", "..", "docs", "contracts", "openapi", "platform-mvp.openapi.yaml"))
    };
    var path = candidates.FirstOrDefault(File.Exists);
    return path is null
        ? Results.NotFound()
        : Results.File(path, "application/yaml");
});
app.MapReverseProxy();

app.Run();

public partial class Program;
