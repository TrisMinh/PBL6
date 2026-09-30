using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Time;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore;

public static class BuildingBlocksServiceCollectionExtensions
{
    public static IServiceCollection AddBuildingBlocks(this IServiceCollection services)
    {
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IIdGenerator, UuidV7IdGenerator>();
        return services;
    }
}

public static class BuildingBlocksApplicationBuilderExtensions
{
    public static IApplicationBuilder UseBuildingBlocks(this IApplicationBuilder app)
    {
        app.UseMiddleware<Correlation.CorrelationMiddleware>();
        app.UseMiddleware<Http.ErrorEnvelopeMiddleware>();
        return app;
    }
}
