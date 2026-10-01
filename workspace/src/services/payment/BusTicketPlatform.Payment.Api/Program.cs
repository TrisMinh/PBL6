using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Auth;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.Payment.Api;
using BusTicketPlatform.Payment.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBuildingBlocks();
builder.Services.AddPaymentInfrastructure(builder.Configuration);
builder.Services.AddPlatformJwt(builder.Configuration);
builder.Services.AddPlatformOpenApi();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddPaymentDatabaseCheck();
builder.Services.AddPlatformSwaggerCors();
var app = builder.Build();
app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();
app.MapPaymentEndpoints();
app.Run();
public partial class Program;
