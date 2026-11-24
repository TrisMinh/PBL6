using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Transport.Domain;
using BusTicketPlatform.Transport.Infrastructure;
using BusTicketPlatform.Transport.Application;
using DotNet.Testcontainers.Builders;
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
    public async Task Admin_can_save_original_organization_profile_fields_with_version_check()
    {
        var client = _fixture.CreateClient();
        var token = TestJwt.Mint(Guid.CreateVersion7(), [Roles.PlatformAdmin]);
        var created = await SendAsync(client, HttpMethod.Post, "/api/v1/admin/organizations", new { code = "LEGAL" + Guid.NewGuid().ToString("N")[..6], name = "Legal Operator", contactEmail = "legal@example.test", contactPhone = "0900000000", expectedVersion = 0 }, token, Idempotency());
        var id = created.Body.GetProperty("id").GetGuid();
        var input = new { name = "Renamed Operator", contactEmail = "legal@example.test", contactPhone = "0900000000", status = "inactive", legalName = "Registered Company", taxId = "123456", address = "Actual address", contactName = "Contact Person", expectedVersion = 0 };
        var saved = await SendAsync(client, HttpMethod.Patch, $"/api/v1/admin/organizations/{id}/profile", input, token);
        Assert.Equal(HttpStatusCode.OK, saved.Response.StatusCode);
        Assert.Equal("Registered Company", saved.Body.GetProperty("legalName").GetString());
        Assert.Equal("INACTIVE", saved.Body.GetProperty("status").GetString());
        var conflict = await SendAsync(client, HttpMethod.Patch, $"/api/v1/admin/organizations/{id}/profile", input, token);
        Assert.Equal(HttpStatusCode.Conflict, conflict.Response.StatusCode);
    }

    [Fact]
    public async Task Public_catalogue_accepts_unselected_route_and_date()
    {
        var response = await _fixture.CreateClient().GetAsync("/api/v1/trips?passengerCount=1&page=0&size=100");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.GetProperty("items").ValueKind);
    }

    [Fact]
    public async Task Public_routes_cache_is_invalidated_after_a_successful_transport_write()
    {
        await using var redis = new ContainerBuilder()
            .WithImage("redis:7-alpine")
            .WithPortBinding(6379, assignRandomHostPort: true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilCommandIsCompleted("redis-cli", "ping"))
            .Build();
        await redis.StartAsync();
        await using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:Redis", $"{redis.Hostname}:{redis.GetMappedPublicPort(6379)}"));
        using var client = factory.CreateClient();
        var cache = factory.Services.GetRequiredService<PublicTransportCache>();
        var oldKey = await cache.ResolveKeyAsync("routes", CancellationToken.None);
        Assert.NotNull(oldKey);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/explore/routes")).StatusCode);
        Assert.NotNull(await cache.ReadAsync<ExploreRouteDto[]>(oldKey, CancellationToken.None));

        var token = TestJwt.Mint(Guid.CreateVersion7(), [Roles.PlatformAdmin]);
        var change = await SendAsync(client, HttpMethod.Post, "/api/v1/admin/organizations", new
        {
            code = "CACHE" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant(),
            name = "Cache test operator",
            contactEmail = "cache@example.test",
            contactPhone = "0900000000",
            expectedVersion = 0
        }, token, Idempotency());
        Assert.Equal(HttpStatusCode.Created, change.Response.StatusCode);

        var newKey = await cache.ResolveKeyAsync("routes", CancellationToken.None);
        Assert.NotNull(newKey);
        Assert.NotEqual(oldKey, newKey);
        Assert.Null(await cache.ReadAsync<ExploreRouteDto[]>(newKey, CancellationToken.None));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/explore/routes")).StatusCode);
        Assert.NotNull(await cache.ReadAsync<ExploreRouteDto[]>(newKey, CancellationToken.None));
    }

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

        const string searchPath = "/api/v1/trips?origin=Da%20Nang&destination=Hue&departureDate=2026-12-15&passengerCount=1";
        var search = await client.GetAsync(searchPath);
        var searchBody = await search.Content.ReadAsStringAsync();
        Assert.True(search.StatusCode == HttpStatusCode.OK, searchBody);
        var page = JsonSerializer.Deserialize<JsonElement>(await search.Content.ReadAsStringAsync(), Json);
        Assert.True(page.GetProperty("totalElements").GetInt64() >= 1);

        var cards = await SendAsync(client, HttpMethod.Get, searchPath + "&cards=true");
        Assert.Equal(HttpStatusCode.OK, cards.Response.StatusCode);
        var card = Assert.Single(cards.Body.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetGuid() == tripId);
        Assert.False(card.TryGetProperty("stops", out _));
        Assert.NotEmpty(cards.Body.GetProperty("routeStops").GetProperty(card.GetProperty("routeId").GetString()!).EnumerateArray());
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
    public async Task Recurring_trips_from_existing_draft_update_source_without_duplicate()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var original = await CreateTripAsync(client, fixture, fixture.BusId, fixture.Departure);
        var id = original.Body.GetProperty("id").GetGuid();
        var start = DateOnly.FromDateTime(fixture.Departure.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var body = new {
            sourceTripId = id,
            template = new { routeId = fixture.RouteId, busId = fixture.BusId, driverId = fixture.DriverId, departureAt = fixture.Departure, arrivalAt = fixture.Departure.AddHours(2), fare = new { amount = 200000, currency = "VND" }, policyVersion = "cancel-mvp-v1", expectedVersion = 0 },
            endDate = start.AddDays(2).ToString("yyyy-MM-dd"), weekdays = new[] { 0, 1, 2, 3, 4, 5, 6 }
        };
        var result = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Created, result.Response.StatusCode);
        var trips = result.Body.EnumerateArray().ToArray();
        Assert.Equal(3, trips.Length);
        Assert.Equal(id, trips[0].GetProperty("id").GetGuid());
        Assert.Equal(1, trips[0].GetProperty("rowVersion").GetInt64());
        Assert.Equal(0, trips[1].GetProperty("rowVersion").GetInt64());
        var list = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/trips?size=100", null, fixture.OperatorToken);
        Assert.Equal(3, list.Body.GetProperty("items").GetArrayLength());
        var source = list.Body.GetProperty("items").EnumerateArray().Single(trip => trip.GetProperty("id").GetGuid() == id);
        Assert.Equal(200000, source.GetProperty("fare").GetProperty("amount").GetInt64());
        var stale = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, stale.Response.StatusCode);
        var foreign = await CreateResourcesAsync(client);
        var denied = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, foreign.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.NotFound, denied.Response.StatusCode);
    }

    [Fact]
    public async Task Recurring_trips_allow_three_months_and_reject_longer_range()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var start = DateOnly.FromDateTime(fixture.Departure.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var body = new {
            template = new { routeId = fixture.RouteId, busId = fixture.BusId, driverId = fixture.DriverId, departureAt = fixture.Departure, arrivalAt = fixture.Departure.AddHours(2), fare = new { amount = 150000, currency = "VND" }, policyVersion = "cancel-mvp-v1", expectedVersion = 0 },
            endDate = start.AddMonths(3).ToString("yyyy-MM-dd"), weekdays = new[] { 0, 1, 2, 3, 4, 5, 6 }
        };
        var result = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Created, result.Response.StatusCode);
        var trips = result.Body.EnumerateArray().ToArray();
        var count = start.AddMonths(3).DayNumber - start.DayNumber + 1;
        Assert.Equal(count, trips.Length);
        Assert.Equal(count, trips.Select(trip => trip.GetProperty("id").GetGuid()).Distinct().Count());
        Assert.Equal(fixture.Departure.AddDays(count - 1), trips[^1].GetProperty("departureAt").GetDateTimeOffset());
        var tooLong = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", new { body.template, endDate = start.AddMonths(3).AddDays(1).ToString("yyyy-MM-dd"), body.weekdays }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.Response.StatusCode);
        var listed = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/trips?size=100", null, fixture.OperatorToken);
        Assert.Equal(count, listed.Body.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Recurring_trips_keep_local_times_and_retry_without_duplicates()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var start = DateOnly.FromDateTime(fixture.Departure.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var departure = new DateTimeOffset(start.ToDateTime(new TimeOnly(23, 30)), TimeSpan.FromHours(7));
        var body = new {
            template = new { routeId = fixture.RouteId, busId = fixture.BusId, driverId = fixture.DriverId, departureAt = departure, arrivalAt = departure.AddHours(2), fare = new { amount = 150000, currency = "VND" }, policyVersion = "cancel-mvp-v1", expectedVersion = 0 },
            endDate = start.AddDays(2).ToString("yyyy-MM-dd"), weekdays = new[] { 0, 1, 2, 3, 4, 5, 6 }
        };
        var key = Idempotency();
        var created = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, fixture.OperatorToken, key);
        Assert.Equal(HttpStatusCode.Created, created.Response.StatusCode);
        var trips = created.Body.EnumerateArray().ToArray();
        Assert.Equal(3, trips.Length);
        for (var index = 0; index < trips.Length; index++)
        {
            Assert.Equal(departure.AddDays(index), trips[index].GetProperty("departureAt").GetDateTimeOffset());
            Assert.Equal(departure.AddDays(index).AddHours(2), trips[index].GetProperty("arrivalAt").GetDateTimeOffset());
            Assert.Equal("DRAFT", trips[index].GetProperty("status").GetString());
        }
        var replay = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", body, fixture.OperatorToken, key);
        Assert.Equal(trips.Select(trip => trip.GetProperty("id").GetGuid()), replay.Body.EnumerateArray().Select(trip => trip.GetProperty("id").GetGuid()));
        var list = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/trips?size=100", null, fixture.OperatorToken);
        Assert.Equal(3, list.Body.GetProperty("items").GetArrayLength());
        foreach (var trip in list.Body.GetProperty("items").EnumerateArray())
            Assert.Equal(fixture.DriverId, trip.GetProperty("driverId").GetGuid());
        var publish = await SendAsync(client, HttpMethod.Post, $"/api/v1/operator/trips/{trips[0].GetProperty("id").GetGuid()}/publish", new { expectedVersion = 0 }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Accepted, publish.Response.StatusCode);
    }

    [Fact]
    public async Task Assignment_availability_excludes_resources_reserved_on_a_later_occurrence()
    {
        var client = _fixture.CreateClient();
        var resources = await CreateResourcesAsync(client);
        var departure = resources.Departure;
        var start = DateOnly.FromDateTime(departure.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var later = await CreateTripAsync(client, resources, resources.BusId, departure.AddDays(1));
        Assert.Equal(HttpStatusCode.Created, later.Response.StatusCode);
        var id = later.Body.GetProperty("id").GetGuid();
        var published = await SendAsync(client, HttpMethod.Post, $"/api/v1/operator/trips/{id}/publish",
            new { expectedVersion = 0 }, resources.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Accepted, published.Response.StatusCode);

        const string path = "/api/v1/operator/trips/assignment-availability";
        var first = await SendAsync(client, HttpMethod.Post, path,
            new { departureAt = departure, arrivalAt = departure.AddHours(2) }, resources.OperatorToken);
        Assert.Equal(HttpStatusCode.OK, first.Response.StatusCode);
        Assert.Contains(first.Body.GetProperty("busIds").EnumerateArray(), item => item.GetGuid() == resources.BusId);
        Assert.Contains(first.Body.GetProperty("driverIds").EnumerateArray(), item => item.GetGuid() == resources.DriverId);

        var series = await SendAsync(client, HttpMethod.Post, path,
            new { departureAt = departure, arrivalAt = departure.AddHours(2), endDate = start.AddDays(1), weekdays = new[] { (int)start.DayOfWeek, (int)start.AddDays(1).DayOfWeek } },
            resources.OperatorToken);
        Assert.Equal(HttpStatusCode.OK, series.Response.StatusCode);
        Assert.DoesNotContain(series.Body.GetProperty("busIds").EnumerateArray(), item => item.GetGuid() == resources.BusId);
        Assert.DoesNotContain(series.Body.GetProperty("driverIds").EnumerateArray(), item => item.GetGuid() == resources.DriverId);

        var overlaps = await SendAsync(client, HttpMethod.Post, path,
            new { departureAt = departure, arrivalAt = departure.AddHours(24), endDate = start.AddDays(1), weekdays = new[] { (int)start.DayOfWeek, (int)start.AddDays(1).DayOfWeek } },
            resources.OperatorToken);
        Assert.Equal(HttpStatusCode.BadRequest, overlaps.Response.StatusCode);
    }

    [Fact]
    public async Task Recurring_trips_validate_entire_range_before_creating_drafts()
    {
        var client = _fixture.CreateClient();
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var fixture = await CreateResourcesAsync(client, start.AddDays(1));
        var departure = new DateTimeOffset(start.ToDateTime(new TimeOnly(8, 0)), TimeSpan.FromHours(7));
        var available = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/assignment-availability",
            new { departureAt = departure, arrivalAt = departure.AddHours(2), endDate = start.AddDays(3), weekdays = new[] { 0, 1, 2, 3, 4, 5, 6 } }, fixture.OperatorToken);
        Assert.Equal(HttpStatusCode.OK, available.Response.StatusCode);
        Assert.Contains(available.Body.GetProperty("busIds").EnumerateArray(), item => item.GetGuid() == fixture.BusId);
        Assert.DoesNotContain(available.Body.GetProperty("driverIds").EnumerateArray(), item => item.GetGuid() == fixture.DriverId);
        var template = new { routeId = fixture.RouteId, busId = fixture.BusId, driverId = fixture.DriverId, departureAt = departure, arrivalAt = departure.AddHours(2), fare = new { amount = 150000, currency = "VND" }, policyVersion = "cancel-mvp-v1", expectedVersion = 0 };
        var invalid = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", new { template, endDate = start.AddDays(3).ToString("yyyy-MM-dd"), weekdays = new[] { 0, 1, 2, 3, 4, 5, 6 } }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.BadRequest, invalid.Response.StatusCode);
        var list = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/trips?size=100", null, fixture.OperatorToken);
        Assert.Equal(0, list.Body.GetProperty("items").GetArrayLength());
        var valid = await SendAsync(client, HttpMethod.Post, "/api/v1/operator/trips/recurring", new { template, endDate = start.AddDays(1).ToString("yyyy-MM-dd"), weekdays = new[] { (int)start.DayOfWeek } }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Created, valid.Response.StatusCode);
        Assert.Equal(1, valid.Body.GetArrayLength());
    }

    [Fact]
    public async Task Seat_permission_changes_one_seat_and_rejects_stale_version()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var buses = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/buses", null, fixture.OperatorToken);
        var bus = buses.Body.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == fixture.BusId);
        var seats = bus.GetProperty("seats").EnumerateArray().ToArray();
        var code = seats[0].GetProperty("code").GetString();
        var path = $"/api/v1/operator/buses/{fixture.BusId}/seats/{code}/permission";
        var body = new { enabled = false, expectedVersion = bus.GetProperty("expectedVersion").GetInt64() };
        var changed = await SendAsync(client, HttpMethod.Patch, path, body, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.OK, changed.Response.StatusCode);
        var updated = changed.Body.GetProperty("seats").EnumerateArray().ToArray();
        Assert.Equal(seats.Length, updated.Length);
        Assert.False(updated.Single(seat => seat.GetProperty("code").GetString() == code).GetProperty("enabled").GetBoolean());
        foreach (var seat in updated.Where(seat => seat.GetProperty("code").GetString() != code))
            Assert.Equal(seats.Single(original => original.GetProperty("code").GetString() == seat.GetProperty("code").GetString()).GetRawText(), seat.GetRawText());
        var stale = await SendAsync(client, HttpMethod.Patch, path, body, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, stale.Response.StatusCode);
        var foreign = await CreateResourcesAsync(client);
        var denied = await SendAsync(client, HttpMethod.Patch, path, body, foreign.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.NotFound, denied.Response.StatusCode);
    }

    [Fact]
    public async Task Delete_driver_hides_profile_and_rejects_assigned_driver()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var path = $"/api/v1/operator/drivers/{fixture.DriverId}";
        var deleted = await SendAsync(client, HttpMethod.Delete, path, null, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.OK, deleted.Response.StatusCode);
        var listed = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/drivers", null, fixture.OperatorToken);
        Assert.DoesNotContain(listed.Body.EnumerateArray(), item => item.GetProperty("id").GetGuid() == fixture.DriverId);
        var restore = await SendAsync(client, HttpMethod.Post, path + "/activate", new { }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.NotFound, restore.Response.StatusCode);

        var assigned = await CreateResourcesAsync(client);
        var trip = await CreateTripAsync(client, assigned, assigned.BusId, assigned.Departure);
        Assert.Equal(HttpStatusCode.Created, trip.Response.StatusCode);
        var blocked = await SendAsync(client, HttpMethod.Delete, $"/api/v1/operator/drivers/{assigned.DriverId}", null, assigned.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.Conflict, blocked.Response.StatusCode);
        var foreign = await SendAsync(client, HttpMethod.Delete, $"/api/v1/operator/drivers/{assigned.DriverId}", null, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.NotFound, foreign.Response.StatusCode);
    }

    [Fact]
    public async Task Paused_driver_remains_listed_and_can_be_restored()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var path = $"/api/v1/operator/drivers/{fixture.DriverId}";
        var paused = await SendAsync(client, HttpMethod.Post, path + "/deactivate", new { }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.OK, paused.Response.StatusCode);
        Assert.Equal("INACTIVE", paused.Body.GetProperty("status").GetString());
        var listed = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/drivers", null, fixture.OperatorToken);
        Assert.Contains(listed.Body.EnumerateArray(), item => item.GetProperty("id").GetGuid() == fixture.DriverId);

        // Simulate profiles paused before the fix, when pausing also set deleted_at.
        await using (var db = new Npgsql.NpgsqlConnection(_fixture.Container.GetConnectionString()))
        {
            await db.OpenAsync();
            await using var command = new Npgsql.NpgsqlCommand("UPDATE driver_profiles SET deleted_at = now() WHERE id = @id", db);
            command.Parameters.AddWithValue("id", fixture.DriverId);
            await command.ExecuteNonQueryAsync();
        }
        var historical = await SendAsync(client, HttpMethod.Get, "/api/v1/operator/drivers", null, fixture.OperatorToken);
        Assert.Contains(historical.Body.EnumerateArray(), item => item.GetProperty("id").GetGuid() == fixture.DriverId);

        var restored = await SendAsync(client, HttpMethod.Post, path + "/activate", new { }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.OK, restored.Response.StatusCode);
        Assert.Equal("ACTIVE", restored.Body.GetProperty("status").GetString());
        var repeated = await SendAsync(client, HttpMethod.Post, path + "/activate", new { }, fixture.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.OK, repeated.Response.StatusCode);
        Assert.Equal(restored.Body.GetProperty("expectedVersion").GetInt64(), repeated.Body.GetProperty("expectedVersion").GetInt64());

        var foreign = await CreateResourcesAsync(client);
        var forbidden = await SendAsync(client, HttpMethod.Post, path + "/activate", new { }, foreign.OperatorToken, Idempotency());
        Assert.Equal(HttpStatusCode.NotFound, forbidden.Response.StatusCode);
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
    public async Task Schedule_uses_operational_time_and_keeps_completed_trips_in_history()
    {
        var client = _fixture.CreateClient();
        var fixture = await CreateResourcesAsync(client);
        var ids = new List<Guid>();
        for (var day = 0; day < 3; day++)
        {
            var created = await CreateTripAsync(client, fixture, fixture.BusId, fixture.Departure.AddDays(day));
            Assert.Equal(HttpStatusCode.Created, created.Response.StatusCode);
            var id = created.Body.GetProperty("id").GetGuid();
            ids.Add(id);
            var published = await SendAsync(client, HttpMethod.Post, $"/api/v1/operator/trips/{id}/publish",
                new { expectedVersion = created.Body.GetProperty("rowVersion").GetInt64() }, fixture.OperatorToken, Idempotency());
            Assert.Equal(HttpStatusCode.Accepted, published.Response.StatusCode);
        }

        await using (var db = new Npgsql.NpgsqlConnection(_fixture.Container.GetConnectionString()))
        {
            await db.OpenAsync();
            await using var command = new Npgsql.NpgsqlCommand("""
                UPDATE trips SET status='BOARDING' WHERE id=@future;
                UPDATE trips SET status='BOARDING', departure_at=now()-interval '24 hours', arrival_at=now()-interval '22 hours',
                    operating_window=tstzrange(now()-interval '25 hours', now()-interval '21 hours', '[)') WHERE id=@overdue;
                UPDATE trips SET status='COMPLETED', departure_at=now()-interval '48 hours', arrival_at=now()-interval '46 hours',
                    operating_window=tstzrange(now()-interval '49 hours', now()-interval '45 hours', '[)') WHERE id=@completed;
                """, db);
            command.Parameters.AddWithValue("future", ids[0]);
            command.Parameters.AddWithValue("overdue", ids[1]);
            command.Parameters.AddWithValue("completed", ids[2]);
            await command.ExecuteNonQueryAsync();
        }

        const string path = "/api/v1/operator/trips/schedule";
        var active = await SendAsync(client, HttpMethod.Get, path + "?scope=active", bearer: fixture.OperatorToken);
        Assert.Equal(HttpStatusCode.OK, active.Response.StatusCode);
        var upcoming = Assert.Single(active.Body.GetProperty("items").EnumerateArray());
        Assert.Equal(ids[0], upcoming.GetProperty("id").GetGuid());
        Assert.Equal("BOARDING", upcoming.GetProperty("status").GetString());
        Assert.Equal("SCHEDULED", upcoming.GetProperty("scheduleStatus").GetString());

        var history = await SendAsync(client, HttpMethod.Get, path + "?scope=history&size=1", bearer: fixture.OperatorToken);
        Assert.Equal(2, history.Body.GetProperty("totalElements").GetInt32());
        var overdue = Assert.Single(history.Body.GetProperty("items").EnumerateArray());
        Assert.Equal(ids[1], overdue.GetProperty("id").GetGuid());
        Assert.Equal("NEEDS_UPDATE", overdue.GetProperty("scheduleStatus").GetString());

        var completed = await SendAsync(client, HttpMethod.Get, path + "?scope=history&status=completed", bearer: fixture.OperatorToken);
        var finished = Assert.Single(completed.Body.GetProperty("items").EnumerateArray());
        Assert.Equal(ids[2], finished.GetProperty("id").GetGuid());
        Assert.Equal("COMPLETED", finished.GetProperty("scheduleStatus").GetString());
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
