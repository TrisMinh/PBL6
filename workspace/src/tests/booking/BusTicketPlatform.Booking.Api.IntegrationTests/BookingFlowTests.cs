using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.Booking.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Booking.Api.IntegrationTests;

[CollectionDefinition("BookingApi", DisableParallelization = true)]
public sealed class BookingApiCollection : ICollectionFixture<BookingPostgresFixture>;

public sealed class BookingPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder().WithImage("postgres:17-alpine").WithDatabase("booking").WithUsername("platform").WithPassword("postgres").Build();
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authentication:SigningKey", TestJwt.SigningKey);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<BookingDatabaseOptions>();
                services.AddSingleton(new BookingDatabaseOptions { ConnectionString = Container.GetConnectionString() });
            });
        });
    }

    public HttpClient CreateClient() => Factory.CreateClient();
    public async Task DisposeAsync() { await Factory.DisposeAsync(); await Container.DisposeAsync(); }
}

[Collection("BookingApi")]
public sealed class BookingFlowTests
{
    private readonly BookingPostgresFixture _fixture;
    public BookingFlowTests(BookingPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Customer_can_hold_seat_and_pay_later_book()
    {
        var client = _fixture.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/ready")).StatusCode);

        var tripId = Guid.CreateVersion7();
        var orgId = Guid.CreateVersion7();
        var origin = Guid.CreateVersion7();
        var dest = Guid.CreateVersion7();
        var seatSource = Guid.CreateVersion7();
        var snapshot = JsonSerializer.Serialize(new { seats = new[] { new { id = seatSource, code = "1A", deck = 1, row = 1, column = 1, type = "STANDARD", active = true } } });
        var fare = JsonSerializer.Serialize(new { baseFare = 150000, allowPayLater = true, policyVersion = "cancel-mvp-v1" });
        var imported = await client.PostAsJsonAsync("/api/v1/internal/trips/published", new
        {
            tripId,
            organizationId = orgId,
            routeId = Guid.CreateVersion7(),
            busId = Guid.CreateVersion7(),
            originStopId = origin,
            destinationStopId = dest,
            departureAt = DateTimeOffset.UtcNow.AddDays(2),
            arrivalAt = DateTimeOffset.UtcNow.AddDays(2).AddHours(4),
            currency = "VND",
            status = "SCHEDULED",
            sourceTripVersion = 1L,
            routeSnapshot = "{}",
            busSnapshot = snapshot,
            farePolicySnapshot = fare
        });
        Assert.Equal(HttpStatusCode.Accepted, imported.StatusCode);

        var user = Guid.CreateVersion7();
        var token = TestJwt.Mint(user, ["CUSTOMER"]);
        var seats = await Send(client, HttpMethod.Get, $"/api/v1/trips/{tripId}/seats", null, token);
        Assert.Equal(HttpStatusCode.OK, seats.Response.StatusCode);
        var seatId = seats.Body.GetProperty("seats")[0].GetProperty("id").GetGuid();

        var hold = await Send(client, HttpMethod.Post, $"/api/v1/trips/{tripId}/seat-holds", new { seatIds = new[] { seatId }, pickupStopId = origin, dropoffStopId = dest }, token, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Created, hold.Response.StatusCode);
        var holdToken = hold.Body.GetProperty("holdToken").GetString();
        var total = hold.Body.GetProperty("seats")[0].GetProperty("price").GetProperty("amount").GetInt64();

        var booking = await Send(client, HttpMethod.Post, "/api/v1/bookings", new
        {
            holdToken,
            contact = new { fullName = "Nguyen Van A", email = "a@example.test", phone = "+84911111111" },
            passengers = new[] { new { seatId, fullName = "Nguyen Van A", pickupStopId = origin, dropoffStopId = dest } },
            expectedTotal = total,
            currency = "VND",
            paymentChannel = "PAY_LATER"
        }, token, Guid.CreateVersion7().ToString("N"));
        Assert.True(booking.Response.IsSuccessStatusCode, booking.Body.ToString());
        Assert.Equal("CONFIRMED", booking.Body.GetProperty("status").GetString());

        var tickets = await Send(client, HttpMethod.Get, "/api/v1/tickets", null, token);
        Assert.True(tickets.Response.IsSuccessStatusCode, tickets.Body.ToString());
        var ticketId = tickets.Body.GetProperty("items")[0].GetProperty("id").GetGuid();
        var ticket = await Send(client, HttpMethod.Get, $"/api/v1/tickets/{ticketId}", null, token);
        Assert.True(ticket.Response.IsSuccessStatusCode, ticket.Body.ToString());
        var qrPayload = ticket.Body.GetProperty("qrPayload").GetString();
        Assert.StartsWith("BT1.", qrPayload);
        Assert.True(TicketQr.TryVerify(qrPayload!, TestJwt.SigningKey, out var signedId));
        Assert.Equal(ticketId, signedId);
        var current = await Send(client, HttpMethod.Get, $"/api/v1/bookings/{booking.Body.GetProperty("id").GetGuid()}", null, token);
        var version = current.Body.GetProperty("rowVersion").GetInt64();
        var preview = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{booking.Body.GetProperty("id").GetGuid()}/cancellation-preview", new { ticketIds = new[] { ticketId } }, token);
        Assert.True(preview.Response.IsSuccessStatusCode, preview.Body.ToString());
        var cancel = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{booking.Body.GetProperty("id").GetGuid()}/cancel", new
        {
            previewId = preview.Body.GetProperty("previewId").GetGuid(),
            reason = "Change of plans",
            expectedVersion = version
        }, token, Guid.CreateVersion7().ToString("N"));
        Assert.True(cancel.Response.IsSuccessStatusCode, cancel.Body.ToString());
    }

    [Fact]
    public async Task Holds_are_atomic_and_concurrent()
    {
        var client = _fixture.CreateClient();
        var trip = await ImportTrip(client, seatCount: 2);
        var customerA = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var customerB = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);

        var contenders = await Task.WhenAll(
            Send(client, HttpMethod.Post, $"/api/v1/trips/{trip.TripId}/seat-holds", HoldBody(trip, [trip.SeatIds[0]]), customerA, Guid.CreateVersion7().ToString("N")),
            Send(client, HttpMethod.Post, $"/api/v1/trips/{trip.TripId}/seat-holds", HoldBody(trip, [trip.SeatIds[0]]), customerB, Guid.CreateVersion7().ToString("N")));

        Assert.Single(contenders, result => result.Response.StatusCode == HttpStatusCode.Created);
        Assert.Single(contenders, result => result.Response.StatusCode == HttpStatusCode.Conflict);

        var atomicFailure = await Send(
            client,
            HttpMethod.Post,
            $"/api/v1/trips/{trip.TripId}/seat-holds",
            HoldBody(trip, trip.SeatIds),
            customerB,
            Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Conflict, atomicFailure.Response.StatusCode);

        var seats = await Send(client, HttpMethod.Get, $"/api/v1/trips/{trip.TripId}/seats", null, customerB);
        var unclaimed = seats.Body.GetProperty("seats").EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == trip.SeatIds[1]);
        Assert.Equal("AVAILABLE", unclaimed.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Booking_validates_passenger_cardinality_channel_and_price_without_consuming_hold()
    {
        var client = _fixture.CreateClient();
        var trip = await ImportTrip(client, seatCount: 2, allowPayLater: false);
        var token = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await CreateHold(client, trip, trip.SeatIds, token);
        var holdToken = hold.Body.GetProperty("holdToken").GetString()!;
        var total = hold.Body.GetProperty("seats").EnumerateArray().Sum(item => item.GetProperty("price").GetProperty("amount").GetInt64());

        var missingPassenger = await CreateBooking(client, trip, holdToken, token, total, "PREPAID", [Passenger(trip, trip.SeatIds[0], "Passenger A")]);
        Assert.Equal(HttpStatusCode.BadRequest, missingPassenger.Response.StatusCode);

        var blankName = await CreateBooking(client, trip, holdToken, token, total, "PREPAID",
        [
            Passenger(trip, trip.SeatIds[0], " "),
            Passenger(trip, trip.SeatIds[1], "Passenger B")
        ]);
        Assert.Equal(HttpStatusCode.BadRequest, blankName.Response.StatusCode);

        var unsupported = await CreateBooking(client, trip, holdToken, token, total, "CASH",
        [
            Passenger(trip, trip.SeatIds[0], "Passenger A"),
            Passenger(trip, trip.SeatIds[1], "Passenger B")
        ]);
        Assert.Equal(HttpStatusCode.BadRequest, unsupported.Response.StatusCode);

        var wrongTotal = await CreateBooking(client, trip, holdToken, token, total - 1, "PREPAID",
        [
            Passenger(trip, trip.SeatIds[0], "Passenger A"),
            Passenger(trip, trip.SeatIds[1], "Passenger B")
        ]);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrongTotal.Response.StatusCode);

        var created = await CreateBooking(client, trip, holdToken, token, total, "PREPAID",
        [
            Passenger(trip, trip.SeatIds[0], "Passenger A"),
            Passenger(trip, trip.SeatIds[1], "Passenger B")
        ]);
        Assert.Equal(HttpStatusCode.Created, created.Response.StatusCode);
        Assert.Equal(total, created.Body.GetProperty("total").GetInt64());
        Assert.Equal("PENDING_PAYMENT", created.Body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Expired_prepaid_booking_is_terminal_and_releases_inventory()
    {
        var client = _fixture.CreateClient();
        var trip = await ImportTrip(client);
        var token = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await CreateHold(client, trip, trip.SeatIds, token);
        var total = hold.Body.GetProperty("seats")[0].GetProperty("price").GetProperty("amount").GetInt64();
        var booking = await CreateBooking(client, trip, hold.Body.GetProperty("holdToken").GetString()!, token, total, "PREPAID", [Passenger(trip, trip.SeatIds[0], "Passenger A")]);
        Assert.Equal(HttpStatusCode.Created, booking.Response.StatusCode);
        var bookingId = booking.Body.GetProperty("id").GetGuid();

        await ExecuteSql("UPDATE bookings SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = @id", bookingId);
        var seats = await Send(client, HttpMethod.Get, $"/api/v1/trips/{trip.TripId}/seats", null, token);
        Assert.Equal("AVAILABLE", seats.Body.GetProperty("seats")[0].GetProperty("status").GetString());

        var current = await Send(client, HttpMethod.Get, $"/api/v1/bookings/{bookingId}", null, token);
        Assert.Equal("EXPIRED", current.Body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Booking_and_ticket_are_concealed_and_qr_contains_no_passenger_pii()
    {
        var client = _fixture.CreateClient();
        var trip = await ImportTrip(client);
        var owner = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var stranger = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await CreateHold(client, trip, trip.SeatIds, owner);
        var total = hold.Body.GetProperty("seats")[0].GetProperty("price").GetProperty("amount").GetInt64();
        var booking = await CreateBooking(client, trip, hold.Body.GetProperty("holdToken").GetString()!, owner, total, "PAY_LATER", [Passenger(trip, trip.SeatIds[0], "Sensitive Passenger")]);
        var bookingId = booking.Body.GetProperty("id").GetGuid();
        var tickets = await Send(client, HttpMethod.Get, "/api/v1/tickets", null, owner);
        var ticketId = tickets.Body.GetProperty("items")[0].GetProperty("id").GetGuid();
        var ticket = await Send(client, HttpMethod.Get, $"/api/v1/tickets/{ticketId}", null, owner);
        var qr = ticket.Body.GetProperty("qrPayload").GetString()!;

        Assert.Equal(HttpStatusCode.NotFound, (await Send(client, HttpMethod.Get, $"/api/v1/bookings/{bookingId}", null, stranger)).Response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(client, HttpMethod.Get, $"/api/v1/tickets/{ticketId}", null, stranger)).Response.StatusCode);
        Assert.DoesNotContain("Sensitive", qr, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("example.test", qr, StringComparison.OrdinalIgnoreCase);
        Assert.True(TicketQr.TryVerify(qr, TestJwt.SigningKey, out var signedId));
        Assert.Equal(ticketId, signedId);
    }

    [Fact]
    public async Task Check_in_requires_authorized_assigned_actor_and_is_idempotent()
    {
        var client = _fixture.CreateClient();
        var organizationId = Guid.CreateVersion7();
        var assignedDriver = Guid.CreateVersion7();
        var trip = await ImportTrip(client, organizationId: organizationId, driverUserId: assignedDriver);
        var customer = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await CreateHold(client, trip, trip.SeatIds, customer);
        var total = hold.Body.GetProperty("seats")[0].GetProperty("price").GetProperty("amount").GetInt64();
        var booking = await CreateBooking(client, trip, hold.Body.GetProperty("holdToken").GetString()!, customer, total, "PAY_LATER", [Passenger(trip, trip.SeatIds[0], "Passenger A")]);
        var bookingId = booking.Body.GetProperty("id").GetGuid();
        var ticket = (await Send(client, HttpMethod.Get, "/api/v1/tickets", null, customer)).Body.GetProperty("items")[0];
        var ticketId = ticket.GetProperty("id").GetGuid();
        var qr = ticket.GetProperty("qrPayload").GetString()!;
        var scan = new { tripId = trip.TripId, scannedToken = qr, expectedVersion = 0 };

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", scan, customer, Guid.CreateVersion7().ToString("N"))).Response.StatusCode);
        var unassigned = TestJwt.Mint(Guid.CreateVersion7(), ["DRIVER"], organizationId);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", scan, unassigned, Guid.CreateVersion7().ToString("N"))).Response.StatusCode);

        var driver = TestJwt.Mint(assignedDriver, ["DRIVER"], organizationId);
        var unknown = await Send(client, HttpMethod.Post, "/api/v1/tickets/validate", new { tripId = trip.TripId, scannedToken = "UNKNOWN-TICKET", expectedVersion = 0 }, driver);
        Assert.Equal(HttpStatusCode.NotFound, unknown.Response.StatusCode);
        var wrongTrip = new { tripId = Guid.CreateVersion7(), scannedToken = qr, expectedVersion = 0 };
        Assert.Equal(HttpStatusCode.NotFound, (await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", wrongTrip, driver, Guid.CreateVersion7().ToString("N"))).Response.StatusCode);

        var idem = Guid.CreateVersion7().ToString("N");
        var first = await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", scan, driver, idem);
        var replay = await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", scan, driver, idem);
        Assert.Equal(HttpStatusCode.OK, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replay.Response.StatusCode);
        Assert.Equal("CHECKED_IN", first.Body.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(client, HttpMethod.Post, $"/api/v1/tickets/{ticketId}/check-in", scan with { expectedVersion = 1 }, driver, Guid.CreateVersion7().ToString("N"))).Response.StatusCode);

        var checkedInPreview = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/cancellation-preview", new { ticketIds = new[] { ticketId } }, customer);
        Assert.Equal(HttpStatusCode.Conflict, checkedInPreview.Response.StatusCode);
    }

    [Fact]
    public async Task Cancelled_trip_snapshot_is_not_sellable()
    {
        var client = _fixture.CreateClient();
        var trip = await ImportTrip(client, status: "CANCELLED");
        var customer = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await Send(client, HttpMethod.Post, $"/api/v1/trips/{trip.TripId}/seat-holds", HoldBody(trip, trip.SeatIds), customer, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, hold.Response.StatusCode);
    }

    [Fact]
    public async Task Trip_cancellation_invalidates_pay_later_ticket_and_releases_seat()
    {
        var client = _fixture.CreateClient();
        var organizationId = Guid.CreateVersion7();
        var driverId = Guid.CreateVersion7();
        var trip = await ImportTrip(client, organizationId: organizationId, driverUserId: driverId);
        var customer = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var hold = await CreateHold(client, trip, trip.SeatIds, customer);
        var total = hold.Body.GetProperty("seats")[0].GetProperty("price").GetProperty("amount").GetInt64();
        var booking = await CreateBooking(client, trip, hold.Body.GetProperty("holdToken").GetString()!, customer, total, "PAY_LATER", [Passenger(trip, trip.SeatIds[0], "Passenger A")]);
        var bookingId = booking.Body.GetProperty("id").GetGuid();
        var ticket = (await Send(client, HttpMethod.Get, "/api/v1/tickets", null, customer)).Body.GetProperty("items")[0];
        var ticketId = ticket.GetProperty("id").GetGuid();
        var qr = ticket.GetProperty("qrPayload").GetString()!;

        var service = _fixture.Factory.Services.GetRequiredService<BookingService>();
        var result = await service.ApplyTripStatusAsync(new TripStatusChangedMessage(trip.TripId, "CANCELLED"), CancellationToken.None);
        Assert.True(result.IsSuccess);

        var currentBooking = await Send(client, HttpMethod.Get, $"/api/v1/bookings/{bookingId}", null, customer);
        var currentTicket = await Send(client, HttpMethod.Get, $"/api/v1/tickets/{ticketId}", null, customer);
        var seats = await Send(client, HttpMethod.Get, $"/api/v1/trips/{trip.TripId}/seats", null, customer);
        Assert.Equal("CANCELLED", currentBooking.Body.GetProperty("status").GetString());
        Assert.Equal("CANCELLED", currentTicket.Body.GetProperty("status").GetString());
        Assert.True(!currentTicket.Body.TryGetProperty("qrPayload", out var cancelledQr) || cancelledQr.ValueKind == JsonValueKind.Null);
        Assert.Equal("AVAILABLE", seats.Body.GetProperty("seats")[0].GetProperty("status").GetString());

        var driver = TestJwt.Mint(driverId, ["DRIVER"], organizationId);
        var validation = await Send(client, HttpMethod.Post, "/api/v1/tickets/validate", new { tripId = trip.TripId, scannedToken = qr, expectedVersion = 0 }, driver);
        Assert.Equal(HttpStatusCode.OK, validation.Response.StatusCode);
        Assert.False(validation.Body.GetProperty("valid").GetBoolean());
    }

    private async Task ExecuteSql(string sql, Guid id)
    {
        await using var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<TestTrip> ImportTrip(
        HttpClient client,
        int seatCount = 1,
        bool allowPayLater = true,
        string status = "SCHEDULED",
        Guid? organizationId = null,
        Guid? driverUserId = null)
    {
        var tripId = Guid.CreateVersion7();
        var origin = Guid.CreateVersion7();
        var destination = Guid.CreateVersion7();
        var sourceSeats = Enumerable.Range(1, seatCount).Select(_ => Guid.CreateVersion7()).ToArray();
        var bus = JsonSerializer.Serialize(new
        {
            seats = sourceSeats.Select((id, index) => new { id, code = $"{index + 1}A", deck = 1, row = index + 1, column = 1, type = "STANDARD", active = true })
        });
        var fare = JsonSerializer.Serialize(new { baseFare = 150000, allowPayLater, policyVersion = "cancel-mvp-v1" });
        var response = await client.PostAsJsonAsync("/api/v1/internal/trips/published", new
        {
            tripId,
            organizationId = organizationId ?? Guid.CreateVersion7(),
            routeId = Guid.CreateVersion7(),
            busId = Guid.CreateVersion7(),
            originStopId = origin,
            destinationStopId = destination,
            departureAt = DateTimeOffset.UtcNow.AddDays(3),
            arrivalAt = DateTimeOffset.UtcNow.AddDays(3).AddHours(4),
            currency = "VND",
            status,
            sourceTripVersion = 1L,
            routeSnapshot = "{}",
            busSnapshot = bus,
            farePolicySnapshot = fare,
            driverUserId
        });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var token = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var seats = await Send(client, HttpMethod.Get, $"/api/v1/trips/{tripId}/seats", null, token);
        Assert.Equal(HttpStatusCode.OK, seats.Response.StatusCode);
        return new TestTrip(
            tripId,
            origin,
            destination,
            seats.Body.GetProperty("seats").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ToArray());
    }

    private static object HoldBody(TestTrip trip, IReadOnlyList<Guid> seatIds) =>
        new { seatIds, pickupStopId = trip.OriginId, dropoffStopId = trip.DestinationId };

    private static object Passenger(TestTrip trip, Guid seatId, string fullName) =>
        new { seatId, fullName, pickupStopId = trip.OriginId, dropoffStopId = trip.DestinationId };

    private static Task<(HttpResponseMessage Response, JsonElement Body)> CreateHold(HttpClient client, TestTrip trip, IReadOnlyList<Guid> seats, string token) =>
        Send(client, HttpMethod.Post, $"/api/v1/trips/{trip.TripId}/seat-holds", HoldBody(trip, seats), token, Guid.CreateVersion7().ToString("N"));

    private static Task<(HttpResponseMessage Response, JsonElement Body)> CreateBooking(
        HttpClient client,
        TestTrip trip,
        string holdToken,
        string bearer,
        long total,
        string channel,
        IReadOnlyList<object> passengers) =>
        Send(client, HttpMethod.Post, "/api/v1/bookings", new
        {
            holdToken,
            contact = new { fullName = "Nguyen Van A", email = "a@example.test", phone = "+84911111111" },
            passengers,
            expectedTotal = total,
            currency = "VND",
            paymentChannel = channel
        }, bearer, Guid.CreateVersion7().ToString("N"));

    private sealed record TestTrip(Guid TripId, Guid OriginId, Guid DestinationId, IReadOnlyList<Guid> SeatIds);

    private static async Task<(HttpResponseMessage Response, JsonElement Body)> Send(HttpClient client, HttpMethod method, string path, object? body, string? bearer = null, string? idem = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null) request.Content = JsonContent.Create(body);
        if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        if (idem is not null) request.Headers.Add("Idempotency-Key", idem);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response, string.IsNullOrWhiteSpace(text) ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }
}
