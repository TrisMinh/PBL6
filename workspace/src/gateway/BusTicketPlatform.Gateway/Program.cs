using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// Building Blocks
// ============================================================
builder.Services.AddBuildingBlocks();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var path = context.Request.Path.Value ?? "";
        var request = context.Request.Method;
        var signup = HttpMethods.IsPost(request) && path.TrimEnd('/').Equals("/api/v1/auth/register", StringComparison.OrdinalIgnoreCase);
        var holds = (HttpMethods.IsPost(request) || HttpMethods.IsPut(request)) && path.Contains("/seat-holds", StringComparison.OrdinalIgnoreCase);
        var phone = HttpMethods.IsPost(request) && path.StartsWith("/api/v1/users/me/phone-verification", StringComparison.OrdinalIgnoreCase);
        if (!signup && !holds && !phone) return RateLimitPartition.GetNoLimiter("unrestricted");
        var operation = signup ? "signup" : holds ? "hold" : "phone";
        var ip = context.Connection.RemoteIpAddress?.MapToIPv6().ToString() ?? "unknown";
        return RateLimitPartition.GetSlidingWindowLimiter($"{operation}:{ip}", _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = signup ? 35 : holds ? 240 : 75,
            Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6
        });
    });
});

// ============================================================
// YARP Reverse Proxy
// ============================================================
builder.Services.AddReverseProxy()
    .LoadFromConfig(
        builder.Configuration.GetSection("ReverseProxy"));

// ============================================================
// Health Checks
// ============================================================
builder.Services.AddHealthChecks()
    .AddCheck(
        "self",
        () => HealthCheckResult.Healthy(),
        tags: ["live", "ready", "startup"]);

// ============================================================
// CORS
// ============================================================
var origins =
    builder.Configuration
        .GetSection("Cors:Origins")
        .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("clients", policy =>
    {
        if (origins.Length == 0 ||
            origins.Contains("*", StringComparer.Ordinal))
        {
            policy.AllowAnyOrigin();
        }
        else
        {
            policy.WithOrigins(origins);
        }

        policy
            .WithHeaders(
                "Authorization",
                "Content-Type",
                "Accept",
                "Idempotency-Key",
                "X-Correlation-Id")
            .WithMethods(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS")
            .WithExposedHeaders(
                "X-Correlation-Id");
    });
});

var app = builder.Build();

// ============================================================
// CORS
// ============================================================
app.UseCors("clients");

// ============================================================
// Building Blocks Middleware
// ============================================================
app.UseBuildingBlocks();
app.UseRateLimiter();

// ============================================================
// Health Check
// ============================================================
app.MapPlatformHealth();

// ============================================================
// Swagger UI
// ============================================================
// Swagger UI is centralized at the API Gateway.
// Each microservice exposes its own OpenAPI document.
//
// Identity    -> http://localhost:5081/openapi/v1.json
// Transport   -> http://localhost:5082/openapi/v1.json
// Booking     -> http://localhost:5083/openapi/v1.json
// Payment     -> http://localhost:5084/openapi/v1.json
// Notification-> http://localhost:5085/openapi/v1.json
// Reporting   -> http://localhost:5086/openapi/v1.json
// ============================================================
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint(
        "http://localhost:5081/openapi/v1.json",
        "Identity API");

    options.SwaggerEndpoint(
        "http://localhost:5082/openapi/v1.json",
        "Transport API");

    options.SwaggerEndpoint(
        "http://localhost:5083/openapi/v1.json",
        "Booking API");

    options.SwaggerEndpoint(
        "http://localhost:5084/openapi/v1.json",
        "Payment API");

    options.SwaggerEndpoint(
        "http://localhost:5085/openapi/v1.json",
        "Notification API");

    options.SwaggerEndpoint(
        "http://localhost:5086/openapi/v1.json",
        "Reporting API");
});

// ============================================================
// Existing platform OpenAPI YAML
// ============================================================
app.MapGet(
    "/openapi.yaml",
    (IWebHostEnvironment environment) =>
    {
        var candidates = new[]
        {
            Path.Combine(
                environment.ContentRootPath,
                "openapi.yaml"),

            Path.GetFullPath(
                Path.Combine(
                    environment.ContentRootPath,
                    "..",
                    "..",
                    "..",
                    "..",
                    "docs",
                    "contracts",
                    "openapi",
                    "platform-mvp.openapi.yaml"))
        };

        var path = candidates.FirstOrDefault(
            File.Exists);

        return path is null
            ? Results.NotFound()
            : Results.File(
                path,
                "application/yaml");
    });

// ============================================================
// YARP Reverse Proxy
// MUST BE LAST
// ============================================================
app.MapReverseProxy();

// ============================================================
// Run
// ============================================================
app.Run();

public partial class Program;
