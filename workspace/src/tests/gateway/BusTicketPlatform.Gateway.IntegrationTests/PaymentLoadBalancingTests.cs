using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.Gateway.IntegrationTests;

public sealed class PaymentLoadBalancingTests
{
    [Fact]
    public async Task Payment_traffic_is_balanced_and_an_unready_replica_is_reinstated_on_recovery()
    {
        var replicaReady = 1;
        await using var primary = BuildUpstream("primary", () => true);
        await using var replica = BuildUpstream("replica", () => Volatile.Read(ref replicaReady) == 1);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await Task.WhenAll(primary.StartAsync(timeout.Token), replica.StartAsync(timeout.Token));

        await using var factory = new WebApplicationFactory<Program>();
        await using var gateway = factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ReverseProxy:Clusters:payment:Destinations:payment-local:Address"] = primary.Urls.Single(),
                    ["ReverseProxy:Clusters:payment:Destinations:payment-2:Address"] = replica.Urls.Single(),
                    ["ReverseProxy:Clusters:payment:HealthCheck:Active:Interval"] = "00:00:00.200"
                })));
        using var client = gateway.CreateClient();

        await WaitForTargetsAsync(client, ["primary", "replica"], timeout.Token);
        Volatile.Write(ref replicaReady, 0);
        await WaitForTargetsAsync(client, ["primary"], timeout.Token);
        Volatile.Write(ref replicaReady, 1);
        await WaitForTargetsAsync(client, ["primary", "replica"], timeout.Token);
    }

    private static WebApplication BuildUpstream(string name, Func<bool> isReady)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        var app = builder.Build();
        app.MapGet("/ready", () => isReady() ? Results.Ok() : Results.StatusCode(503));
        app.MapGet("/api/v1/payment-methods", () => name);
        return app;
    }

    private static async Task WaitForTargetsAsync(HttpClient client, string[] expected, CancellationToken cancellationToken)
    {
        while (true)
        {
            var targets = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < 6; i++)
            {
                targets.Add(await client.GetStringAsync("/api/v1/payment-methods", cancellationToken));
            }

            if (targets.SetEquals(expected)) return;
            await Task.Delay(TimeSpan.FromMilliseconds(150), cancellationToken);
        }
    }
}
