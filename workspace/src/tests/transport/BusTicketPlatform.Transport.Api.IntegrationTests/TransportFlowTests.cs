using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Transport.Domain;
using BusTicketPlatform.Transport.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Transport.Api.IntegrationTests;

[CollectionDefinition("TransportApi", DisableParallelization = true)]
public sealed class TransportApiCollection : ICollectionFixture<TransportPostgresFixture>;

public sealed class TransportPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("transport")
        .WithUsername("platform")
        .WithPassword("postgres")
        .Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        var connectionString = Container.GetConnectionString() + ";Include Error Detail=true";
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authentication:SigningKey", TestJwt.SigningKey);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<TransportDatabaseOptions>();
                services.AddSingleton(new TransportDatabaseOptions { ConnectionString = connectionString });
            });
        });
    }

    public HttpClient CreateClient() => Factory.CreateClient();

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await Container.DisposeAsync();
    }
}

[Collection("TransportApi")]
public sealed class TransportFlowTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly TransportPostgresFixture _fixture;

    public TransportFlowTests(TransportPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Ready_succeeds_after_baseline()
    {
        var client = _fixture.CreateClient();
        var response = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Operator_can_publish_trip_and_customer_can_search()
    {
        var client = _fixture.CreateClient();
        var orgId = Guid.CreateVersion7();
        var admin = TestJwt.Mint(Guid.CreateVersion7(), [Roles.PlatformAdmin]);
        var operatorUser = Guid.CreateVersion7();
        var driverUser = Guid.CreateVersion7();

        var createdOrg = await SendAsync(client, HttpMethod.Post, "/api/v1/admin/organizations", new
        {
            code = "OP" + Guid.CreateVersion7().ToString("N")[..6].ToUpperInvariant(),
            name = "Da Nang Lines",
            contactEmail = "ops@example.test",
            contactPhone = "0900000000",
            allowPayLater = true,
            expectedVersion = 0
        }, admin, Idempotency());
        Assert.True(createdOrg.Response.StatusCode == HttpStatusCode.Created, createdOrg.Body.ToString());
        orgId = createdOrg.Body.GetProperty("id").GetGuid();

        var opToken = TestJwt.Mint(operatorUser, [Roles.OperatorAdmin, Roles.OperatorScheduler], orgId);
        var bus = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/buses", new
        {
            plateNumber = "43B-12345",
            type = "STANDARD",
            amenities = new[] { "AC" },
            expectedVersion = 0
        }, opToken, Idempotency());
        Assert.True(bus.Response.StatusCode == HttpStatusCode.Created, bus.Body.ToString());
        var busId = bus.Body.GetProperty("id").GetGuid();

        var seats = await SendAsync(client, HttpMethod.Put, $"/api/v1/operator/buses/{busId}/seats", new[]
        {
            new { code = "1A", deck = 1, row = 1, column = 1, type = "STANDARD", enabled = true },
            new { code = "1B", deck = 1, row = 1, column = 2, type = "STANDARD", enabled = true }
        }, opToken, Idempotency());
        Assert.True(seats.Response.StatusCode == HttpStatusCode.OK, seats.Body.ToString());

        var driver = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/drivers", new
        {
            userId = driverUser,
            licenseNumber = "LIC-" + Guid.CreateVersion7().ToString("N")[..8],
            licenseExpiresOn = "2030-01-01",
            expectedVersion = 0
        }, opToken, Idempotency());
        Assert.True(driver.Response.StatusCode == HttpStatusCode.Created, driver.Body.ToString());
        var driverId = driver.Body.GetProperty("id").GetGuid();

        var route = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/routes", new
        {
            name = "Da Nang - Hue",
            origin = "Da Nang",
            destination = "Hue",
            durationMinutes = 180,
            expectedVersion = 0
        }, opToken, Idempotency());
        Assert.True(route.Response.StatusCode == HttpStatusCode.Created, route.Body.ToString());
        var routeId = route.Body.GetProperty("id").GetGuid();

        var departure = new DateTimeOffset(2026, 12, 15, 8, 0, 0, TimeSpan.FromHours(7));
        var trip = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips", new
        {
            routeId,
            busId,
            driverId,
            departureAt = departure,
            arrivalAt = departure.AddHours(4),
            fare = new { amount = 150000, currency = "VND" },
            policyVersion = "cancel-mvp-v1",
            expectedVersion = 0
        }, opToken, Idempotency());
        Assert.True(trip.Response.IsSuccessStatusCode, trip.Body.ToString());
        var tripId = trip.Body.GetProperty("id").GetGuid();
        var version = trip.Body.GetProperty("rowVersion").GetInt64();

        var publish = await SendAsync(client, HttpMethod.Post, $"/api/v1/operator/trips/{tripId}/publish", new { expectedVersion = version }, opToken, Idempotency());
        Assert.True(publish.Response.StatusCode == HttpStatusCode.Accepted, publish.Body.ToString());

        var ready = await SendAsync(client, HttpMethod.Post, $"/internal/trips/{tripId}/inventory-ready", new { });
        Assert.Equal(HttpStatusCode.Accepted, ready.Response.StatusCode);

        var search = await client.GetAsync("/api/v1/trips?origin=Da%20Nang&destination=Hue&departureDate=2026-12-15&passengerCount=1");
        var searchBody = await search.Content.ReadAsStringAsync();
        Assert.True(search.StatusCode == HttpStatusCode.OK, searchBody);
        var page = JsonSerializer.Deserialize<JsonElement>(await search.Content.ReadAsStringAsync(), Json);
        Assert.True(page.GetProperty("totalElements").GetInt64() >= 1);
    }

    private static string Idempotency() => Guid.CreateVersion7().ToString("N");

    private static async Task<(HttpResponseMessage Response, JsonElement Body)> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? body = null,
        string? bearer = null,
        string? idempotency = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (bearer is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        }

        if (idempotency is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotency);
        }

        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        var json = string.IsNullOrWhiteSpace(text) ? default : JsonSerializer.Deserialize<JsonElement>(text, Json);
        return (response, json);
    }
}
