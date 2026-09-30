using Microsoft.Extensions.Hosting;

namespace BusTicketPlatform.Payment.Infrastructure;

public sealed class SqlBaselineHostedService(SqlBaselineMigrator migrator) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken) => migrator.ApplyAsync(cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
