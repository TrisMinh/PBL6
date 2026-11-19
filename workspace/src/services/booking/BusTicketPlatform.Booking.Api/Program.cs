using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Auth;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.Booking.Api;
using BusTicketPlatform.Booking.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBuildingBlocks();
builder.Services.AddBookingInfrastructure(builder.Configuration);
builder.Services.AddPlatformJwt(builder.Configuration);

builder.Services.AddPlatformOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddBookingDatabaseCheck();

builder.Services.AddPlatformSwaggerCors();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddFixedWindowLimiter("ticket-lookup", limiter =>
    {
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.PermitLimit = 40;
    });
});

var app = builder.Build();

app.UsePlatformSwaggerCors();

app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapPlatformHealth();

app.MapPlatformOpenApi();

app.MapBookingEndpoints();
app.MapAdminBookingAudit();
app.MapOperatorBookingAnalytics();

app.Run();

public partial class Program;

namespace BusTicketPlatform.Booking.Api { public sealed class BookingApiMarker; }
