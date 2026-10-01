using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Auth;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Notification.Application;
using BusTicketPlatform.Notification.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBuildingBlocks();
builder.Services.AddNotificationInfrastructure(builder.Configuration);
builder.Services.AddPlatformJwt(builder.Configuration);
builder.Services.AddPlatformOpenApi();
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddNotificationDatabaseCheck();
builder.Services.AddPlatformSwaggerCors();
var app = builder.Build();
app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();

app.MapGet("/api/v1/notifications", async (HttpContext context, NotificationService service, string? cursor, int limit = 20) =>
{
    var userId = context.User.UserId();
    return userId is null
        ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
        : (await service.ListAsync(new Actor(userId.Value), cursor, limit, context.RequestAborted)).ToHttp(context.CorrelationId());
}).RequireAuthorization();

app.MapPatch("/api/v1/notifications/{notificationId:guid}/read", async (HttpContext context, NotificationService service, Guid notificationId) =>
{
    var userId = context.User.UserId();
    return userId is null
        ? PlatformHttp.Error(PlatformErrors.AuthenticationRequired(), context.CorrelationId())
        : (await service.MarkReadAsync(new Actor(userId.Value), notificationId, context.RequestAborted)).ToHttp(context.CorrelationId());
}).RequireAuthorization();

app.MapPost("/internal/notifications", async (HttpContext context, NotificationService service, IngestNotification body) =>
{
    await service.IngestAsync(body, context.RequestAborted);
    return Results.StatusCode(204);
});

app.Run();
public partial class Program;
