using BusTicketPlatform.Identity.Api;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Infrastructure;
using BusTicketPlatform.Identity.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);
builder.Services
    .AddIdentityApplication()
    .AddIdentityInfrastructure(builder.Configuration)
    .AddIdentityApi(builder.Configuration);

var app = builder.Build();
await app.Services.MigrateIdentityDatabaseAsync();
app.UseIdentityApi();
await app.RunAsync();
