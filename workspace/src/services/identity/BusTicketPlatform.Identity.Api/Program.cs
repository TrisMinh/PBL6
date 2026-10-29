using System.Text;
using System.Security.Claims;
using BusTicketPlatform.BuildingBlocks.AspNetCore;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Health;
using BusTicketPlatform.Identity.Api;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;
using BusTicketPlatform.Identity.Infrastructure;
using BusTicketPlatform.Identity.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBuildingBlocks();
builder.Services.AddIdentityInfrastructure(builder.Configuration);
builder.Services.AddPlatformOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
var auth = builder.Configuration.GetSection(AuthenticationOptions.SectionName).Get<AuthenticationOptions>()
    ?? new AuthenticationOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = auth.Issuer,
            ValidAudience = auth.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                string.IsNullOrWhiteSpace(auth.SigningKey)
                    ? "local-dev-only-change-me-32bytes-min"
                    : auth.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            NameClaimType = "sub"
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var subject = context.Principal?.FindFirstValue("sub")
                    ?? context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var versionValue = context.Principal?.FindFirstValue("ver");
                if (!Guid.TryParse(subject, out var userId)
                    || !long.TryParse(versionValue, out var tokenVersion))
                {
                    context.Fail("The access token is missing required identity claims.");
                    return;
                }

                var repository = context.HttpContext.RequestServices.GetRequiredService<IIdentityRepository>();
                var user = await repository.FindByIdAsync(userId, context.HttpContext.RequestAborted);
                if (user is null
                    || user.Status != UserStatuses.Active
                    || user.AuthorizationVersion != tokenVersion)
                {
                    context.Fail("The access token has been revoked.");
                }
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddPlatformSwaggerCors();
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live", "ready", "startup"])
    .AddIdentityDatabaseCheck();

var app = builder.Build();

app.UsePlatformSwaggerCors();
app.UseBuildingBlocks();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformHealth();
app.MapPlatformOpenApi();
app.MapIdentityEndpoints();

app.Run();

public partial class Program;
