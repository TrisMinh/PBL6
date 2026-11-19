using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Auth;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Reporting.Application;
using BusTicketPlatform.Reporting.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBuildingBlocks();
builder.Services.AddReportingInfrastructure(builder.Configuration);
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

Actor? ActorOf(HttpContext context)
{
    var userId = context.User.UserId();
    return userId is null
        ? null
        : new Actor(userId.Value, context.User.OrganizationId(),
            context.User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).Distinct().ToArray(),
            context.User.FindAll("org_role").Select(c => c.Value).ToArray());
}

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
