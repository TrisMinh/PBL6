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

    [Fact]
    public async Task Search_rejects_oversized_and_negative_pages()
    {
        var client = _fixture.CreateClient();
        var oversized = await SendAsync(
            client,
            HttpMethod.Get,
            "/api/v1/trips?origin=Nowhere&destination=Elsewhere&departureDate=2030-01-01&passengerCount=1&size=100000");
        Assert.Equal(HttpStatusCode.BadRequest, oversized.Response.StatusCode);

        var negative = await SendAsync(
            client,
            HttpMethod.Get,
            "/api/v1/trips?origin=Nowhere&destination=Elsewhere&departureDate=2030-01-01&passengerCount=1&page=-1");
        Assert.Equal(HttpStatusCode.BadRequest, negative.Response.StatusCode);
    }

    [Fact]
    public async Task Route_rejects_duplicate_or_non_contiguous_stop_sequences()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);

        var duplicate = await SendAsync(
            client,
            HttpMethod.Put,
            $"/api/v1/operator/routes/{fixture.RouteId}/stops",
            new[]
            {
                new { name = "Origin", address = "A", sequence = 0, offsetMinutes = 0, pickupAllowed = true, dropoffAllowed = false },
                new { name = "Destination", address = "B", sequence = 0, offsetMinutes = 60, pickupAllowed = false, dropoffAllowed = true }
            },
            fixture.OperatorToken);
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.Response.StatusCode);

        var gap = await SendAsync(
            client,
            HttpMethod.Put,
            $"/api/v1/operator/routes/{fixture.RouteId}/stops",
            new[]
            {
                new { name = "Origin", address = "A", sequence = 0, offsetMinutes = 0, pickupAllowed = true, dropoffAllowed = false },
                new { name = "Destination", address = "B", sequence = 2, offsetMinutes = 60, pickupAllowed = false, dropoffAllowed = true }
            },
            fixture.OperatorToken);
        Assert.Equal(HttpStatusCode.BadRequest, gap.Response.StatusCode);
    }

    [Fact]
    public async Task Expired_driver_profile_is_saved_as_unavailable_and_cannot_be_assigned()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client, new DateOnly(2020, 1, 1));
        Assert.Equal("EXPIRED", fixture.DriverStatus);

        var draft = await CreateTripAsync(client, fixture, fixture.BusId, fixture.Departure);
        Assert.Equal(HttpStatusCode.BadRequest, draft.Response.StatusCode);
    }

    [Fact]
    public async Task Overlapping_driver_drafts_are_allowed_but_second_publish_conflicts()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client, secondBus: true);
        var first = await CreateTripAsync(client, fixture, fixture.BusId, fixture.Departure);
        var second = await CreateTripAsync(client, fixture, fixture.SecondBusId!.Value, fixture.Departure.AddMinutes(15));
        Assert.Equal(HttpStatusCode.Created, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.Response.StatusCode);

        var firstPublish = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/operator/trips/{first.Body.GetProperty("id").GetGuid()}/publish",
            new { expectedVersion = first.Body.GetProperty("rowVersion").GetInt64() },
            fixture.OperatorToken,
            Idempotency());
        Assert.Equal(HttpStatusCode.Accepted, firstPublish.Response.StatusCode);

        var secondPublish = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/operator/trips/{second.Body.GetProperty("id").GetGuid()}/publish",
            new { expectedVersion = second.Body.GetProperty("rowVersion").GetInt64() },
            fixture.OperatorToken,
            Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, secondPublish.Response.StatusCode);
        Assert.Equal("SCHEDULE_CONFLICT", secondPublish.Body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Only_assigned_driver_can_follow_trip_lifecycle_and_hard_delete_is_unavailable()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var draft = await CreateTripAsync(client, fixture, fixture.BusId, fixture.Departure);
        Assert.Equal(HttpStatusCode.Created, draft.Response.StatusCode);
        var tripId = draft.Body.GetProperty("id").GetGuid();
        var version = draft.Body.GetProperty("rowVersion").GetInt64();
        var published = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/operator/trips/{tripId}/publish",
            new { expectedVersion = version },
            fixture.OperatorToken,
            Idempotency());
        Assert.Equal(HttpStatusCode.Accepted, published.Response.StatusCode);

        var invalid = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/operator/trips/{tripId}/status-transitions",
            new { expectedVersion = version + 1, targetStatus = "ARRIVED", reason = "skip states" },
            fixture.OperatorToken,
            Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, invalid.Response.StatusCode);
        Assert.Equal("INVALID_STATE_TRANSITION", invalid.Body.GetProperty("error").GetProperty("code").GetString());

        var stranger = TestJwt.Mint(Guid.CreateVersion7(), [Roles.Driver], fixture.OrganizationId);
        var denied = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/operator/trips/{tripId}/status-transitions",
            new { expectedVersion = version + 1, targetStatus = "BOARDING", reason = "not assigned" },
            stranger,
            Idempotency());
        Assert.Equal(HttpStatusCode.Forbidden, denied.Response.StatusCode);

        var driverToken = TestJwt.Mint(fixture.DriverUserId, [Roles.Driver], fixture.OrganizationId);
        foreach (var status in new[] { "BOARDING", "DEPARTED", "IN_TRANSIT", "ARRIVED", "COMPLETED" })
        {
            var transitioned = await SendAsync(
                client,
                HttpMethod.Post,
                $"/api/v1/operator/trips/{tripId}/status-transitions",
                new { expectedVersion = ++version, targetStatus = status, reason = "lifecycle test" },
                driverToken,
                Idempotency());
            Assert.Equal(HttpStatusCode.OK, transitioned.Response.StatusCode);
            Assert.Equal(status, transitioned.Body.GetProperty("status").GetString());
        }

        var deleted = await SendAsync(client, HttpMethod.Delete, $"/api/v1/operator/trips/{tripId}", bearer: fixture.OperatorToken);
        Assert.True(
            deleted.Response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            deleted.Body.ToString());
        var retained = await SendAsync(client, HttpMethod.Get, $"/api/v1/trips/{tripId}");
        Assert.Equal(HttpStatusCode.OK, retained.Response.StatusCode);
    }

    [Fact]
    public async Task Tenant_cannot_mutate_another_tenants_bus()
    {
        var client = _fixture.CreateClient();
        var owner = await CreateResourcesAsync(client);
        var foreign = await CreateResourcesAsync(client);
        var response = await SendAsync(
            client,
            HttpMethod.Patch,
            $"/api/v1/operator/buses/{owner.BusId}",
            new { plateNumber = "99Z-99999", type = "STANDARD", amenities = Array.Empty<string>(), expectedVersion = 0 },
            foreign.OperatorToken);
        Assert.Equal(HttpStatusCode.NotFound, response.Response.StatusCode);

        var ownerDraft = await CreateTripAsync(client, owner, owner.BusId, owner.Departure);
        Assert.Equal(HttpStatusCode.Created, ownerDraft.Response.StatusCode);
        var crossTenantReferences = await SendAsync(
            client,
            HttpMethod.Patch,
            $"/api/v1/operator/trips/{ownerDraft.Body.GetProperty("id").GetGuid()}",
            new
            {
                routeId = foreign.RouteId,
                busId = foreign.BusId,
                driverId = foreign.DriverId,
                departureAt = owner.Departure,
                arrivalAt = owner.Departure.AddHours(2),
                fare = new { amount = 150000, currency = "VND" },
                policyVersion = "cancel-mvp-v1",
                expectedVersion = 0
            },
            owner.OperatorToken);
        Assert.Equal(HttpStatusCode.BadRequest, crossTenantReferences.Response.StatusCode);
    }

    [Fact]
    public async Task Duplicate_bus_plate_returns_conflict_instead_of_server_error()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var listed = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/buses", bearer: fixture.OperatorToken);
        Assert.Equal(HttpStatusCode.OK, listed.Response.StatusCode);
        var plate = listed.Body.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == fixture.BusId).GetProperty("plateNumber").GetString();

        var duplicate = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/buses", new
        {
            plateNumber = plate,
            type = "STANDARD",
            amenities = Array.Empty<string>(),
            expectedVersion = 0
        }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, duplicate.Response.StatusCode);
        Assert.Equal("RESOURCE_CONFLICT", duplicate.Body.GetProperty("error").GetProperty("code").GetString());
    }

    private async Task<ResourceFixture> CreateResourcesAsync(
        HttpClient client,
        DateOnly? licenseExpiresOn = null,
        bool secondBus = false)
    {
        var admin = TestJwt.Mint(Guid.CreateVersion7(), [Roles.PlatformAdmin]);
        var createdOrg = await SendAsync(client, HttpMethod.Post, "/api/v1/admin/organizations", new
        {
            code = "T" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant(),
            name = "Test Operator " + Guid.NewGuid().ToString("N")[..6],
            contactEmail = "ops@example.test",
            contactPhone = "0900000000",
            allowPayLater = true,
            expectedVersion = 0
        }, admin, Idempotency());
        Assert.True(createdOrg.Response.StatusCode == HttpStatusCode.Created, createdOrg.Body.ToString());
        var organizationId = createdOrg.Body.GetProperty("id").GetGuid();
        var operatorToken = TestJwt.Mint(Guid.CreateVersion7(), [Roles.OperatorAdmin, Roles.OperatorScheduler, Roles.OperatorOperations], organizationId);

        async Task<Guid> CreateBus(string prefix)
        {
            var response = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/buses", new
            {
                plateNumber = prefix + Guid.NewGuid().ToString("N")[..7].ToUpperInvariant(),
                type = "STANDARD",
                amenities = new[] { "AC" },
                expectedVersion = 0
            }, operatorToken, Idempotency());
            Assert.Equal(HttpStatusCode.Created, response.Response.StatusCode);
            return response.Body.GetProperty("id").GetGuid();
        }

        var busId = await CreateBus("A");
        var secondBusId = secondBus ? await CreateBus("B") : (Guid?)null;
        var driverUserId = Guid.CreateVersion7();
        var driver = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/drivers", new
        {
            userId = driverUserId,
            licenseNumber = "LIC-" + Guid.NewGuid().ToString("N")[..10],
            licenseExpiresOn = (licenseExpiresOn ?? new DateOnly(2035, 1, 1)).ToString("yyyy-MM-dd"),
            expectedVersion = 0
        }, operatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Created, driver.Response.StatusCode);

        var route = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/routes", new
        {
            name = "Origin - Destination " + Guid.NewGuid().ToString("N")[..6],
            origin = "Origin " + Guid.NewGuid().ToString("N")[..6],
            destination = "Destination " + Guid.NewGuid().ToString("N")[..6],
            durationMinutes = 120,
            expectedVersion = 0
        }, operatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Created, route.Response.StatusCode);

        return new ResourceFixture(
            organizationId,
            operatorToken,
            busId,
            secondBusId,
            driver.Body.GetProperty("id").GetGuid(),
            driverUserId,
            driver.Body.GetProperty("status").GetString()!,
            route.Body.GetProperty("id").GetGuid(),
            DateTimeOffset.UtcNow.AddDays(30));
    }

    private static Task<(HttpResponseMessage Response, JsonElement Body)> CreateTripAsync(
        HttpClient client,
        ResourceFixture fixture,
        Guid busId,
        DateTimeOffset departure) =>
        SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips", new
        {
            routeId = fixture.RouteId,
            busId,
            driverId = fixture.DriverId,
            departureAt = departure,
            arrivalAt = departure.AddHours(2),
            fare = new { amount = 150000, currency = "VND" },
            policyVersion = "cancel-mvp-v1",
            expectedVersion = 0
        }, fixture.OperatorToken, Idempotency());

    private sealed record ResourceFixture(
        Guid OrganizationId,
        string OperatorToken,
        Guid BusId,
        Guid? SecondBusId,
        Guid DriverId,
        Guid DriverUserId,
        string DriverStatus,
        Guid RouteId,
        DateTimeOffset Departure);

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
