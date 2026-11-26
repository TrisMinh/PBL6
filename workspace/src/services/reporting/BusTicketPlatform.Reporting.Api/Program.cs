using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Auth;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Reporting.Api;
using BusTicketPlatform.Reporting.Application;
using BusTicketPlatform.Reporting.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBuildingBlocks();
builder.Services.AddReportingInfrastructure(builder.Configuration);
if (builder.Configuration.GetValue<bool>("Retention:Enabled"))
{
    builder.Services.AddSingleton<RetentionService>();
    builder.Services.AddHostedService(services => services.GetRequiredService<RetentionService>());
}
builder.Services.Configure<PowerBiEmbeddingOptions>(builder.Configuration.GetSection("PowerBi"));
builder.Services.AddHttpClient(PowerBiEmbedding.ClientName, client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddSingleton<PowerBiEmbedding>();
builder.Services.AddPlatformJwt(builder.Configuration);
builder.Services.AddPlatformOpenApi();
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddReportingDatabaseCheck();
builder.Services.AddPlatformSwaggerCors();
var app = builder.Build();
app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();
if (builder.Configuration.GetValue<bool>("Retention:Enabled")) app.MapRetentionEndpoints();

Actor? ActorOf(HttpContext context)
{
    var userId = context.User.UserId();
    return userId is null
        ? null
        : new Actor(userId.Value, context.User.OrganizationId(),
            context.User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray(),
            context.User.FindAll("org_role").Select(c => c.Value).ToArray());
}

app.MapPost("/api/v1/reports/power-bi/embed", async (HttpContext context, PowerBiEmbedding powerBi) =>
{
    context.Response.Headers.CacheControl = "no-store";
    var actor = ActorOf(context);
    if (actor is null)
        return PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId());
    if (actor.OrganizationId is not Guid organizationId || organizationId == Guid.Empty ||
        actor.OrganizationRoles?.Any(role => role is "OPERATOR_ADMIN" or "OPERATOR_FINANCE") != true)
        return PlatformHttp.Error(PlatformErrors.AccessDenied(), context.CorrelationId());
    if (!powerBi.Enabled)
        return PlatformHttp.Error(PlatformErrors.NotFound(), context.CorrelationId());

    try
    {
        return Results.Ok(await powerBi.CreateSessionAsync(organizationId, context.RequestAborted));
    }
    catch (Exception error) when (!context.RequestAborted.IsCancellationRequested &&
        error is HttpRequestException or OperationCanceledException or InvalidOperationException or System.Text.Json.JsonException)
    {
        // Upstream payloads can contain credentials. Log only the exception type and status.
        app.Logger.LogWarning("Power BI embedding unavailable ({ErrorType}, {Status})",
            error.GetType().Name, (error as HttpRequestException)?.StatusCode);
        return PlatformHttp.Error(new AppError("POWER_BI_UNAVAILABLE",
            "Power BI is temporarily unavailable.", 503), context.CorrelationId());
    }
}).RequireAuthorization();

app.MapGet("/api/v1/reports/revenue", async (HttpContext context, ReportingService service, DateTimeOffset from, DateTimeOffset to, string timezone, bool? operatorOnly, bool? allTime) =>
{
    var actor = ActorOf(context);
    return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
        : (await service.RevenueAsync(actor, from, to, timezone, context.RequestAborted, operatorOnly == true, allTime == true)).ToHttp(context.CorrelationId());
}).RequireAuthorization();

app.MapGet("/api/v1/reports/bookings", async (HttpContext context, ReportingService service, DateTimeOffset from, DateTimeOffset to, string timezone) =>
{
    var actor = ActorOf(context);
    return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.BookingsAsync(actor, from, to, timezone, context.RequestAborted)).ToHttp(context.CorrelationId());
}).RequireAuthorization();

app.MapGet("/api/v1/reports/occupancy", async (HttpContext context, ReportingService service, DateTimeOffset from, DateTimeOffset to, string timezone) =>
{
    var actor = ActorOf(context);
    return actor is null ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId()) : (await service.OccupancyAsync(actor, from, to, timezone, context.RequestAborted)).ToHttp(context.CorrelationId());
}).RequireAuthorization();

app.Run();
public partial class Program;
