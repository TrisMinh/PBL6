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
