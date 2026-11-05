using BusTicketPlatform.Booking.Application;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.Booking.Infrastructure;

public sealed class SeatHoldExpiryHostedService(
    IBookingRepository repository,
    ILogger<SeatHoldExpiryHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);
        do
        {
            try
            {
                await repository.ExpireHoldsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Seat hold expiration sweep failed; it will retry on the next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
