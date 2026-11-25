using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Booking.Infrastructure;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Payment.Application;
using BusTicketPlatform.Payment.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace BusTicketPlatform.Payment.Api.IntegrationTests;

[Collection("PaymentApi")]
public sealed class SePayBookingFlowTests(PaymentPostgresFixture fixture)
{
    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, false, false)]
    [InlineData(false, true, false)]
    [InlineData(true, true, false)]
    [InlineData(false, false, true)]
    public async Task Two_seats_to_SePay_capture_to_booking_tickets_manifest_and_refund(
        bool bookingExpiresBeforeEvent, bool withCoupon, bool scheduled)
    {
        var dbName = "booking_" + Guid.NewGuid().ToString("N");
        await using (var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()))
        {
            await connection.OpenAsync(); await using var create = new NpgsqlCommand("CREATE DATABASE " + dbName, connection); await create.ExecuteNonQueryAsync();
        }
        var connectionString = new NpgsqlConnectionStringBuilder(fixture.Container.GetConnectionString()) { Database = dbName }.ToString();
        await using var bookingFactory = new WebApplicationFactory<BusTicketPlatform.Booking.Api.BookingApiMarker>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authentication:SigningKey", TestJwt.SigningKey);
            builder.ConfigureTestServices(services => { services.RemoveAll<BookingDatabaseOptions>(); services.AddSingleton(new BookingDatabaseOptions { ConnectionString = connectionString }); });
        });
        var bookingClient = bookingFactory.CreateClient(); var paymentClient = fixture.CreateClient();
        await using var replicaFactory = fixture.Factory.WithWebHostBuilder(_ => { });
        using var replicaClient = replicaFactory.CreateClient();
        var user = Guid.CreateVersion7(); var org = Guid.CreateVersion7(); var trip = Guid.CreateVersion7();
        var origin = Guid.CreateVersion7(); var destination = Guid.CreateVersion7(); var token = TestJwt.Mint(user, ["CUSTOMER"]);
        var imported = await bookingClient.PostAsJsonAsync("/api/v1/internal/trips/published", new {
            tripId = trip, organizationId = org, routeId = Guid.CreateVersion7(), busId = Guid.CreateVersion7(),
            originStopId = origin, destinationStopId = destination, departureAt = DateTimeOffset.UtcNow.AddDays(2), arrivalAt = DateTimeOffset.UtcNow.AddDays(2).AddHours(6),
            currency = "VND", status = "SCHEDULED", sourceTripVersion = 1,
            routeSnapshot = "{}", busSnapshot = JsonSerializer.Serialize(new { seats = new[] {
                new { id = Guid.CreateVersion7(), code = "A01", deck = 1, row = 1, column = 1, type = "STANDARD", active = true },
                new { id = Guid.CreateVersion7(), code = "A02", deck = 1, row = 1, column = 2, type = "STANDARD", active = true }
            } }), farePolicySnapshot = "{\"baseFare\":150000,\"allowPayLater\":false,\"policyVersion\":\"cancel-mvp-v1\"}"
        });
        Assert.Equal(HttpStatusCode.Accepted, imported.StatusCode);
        var seats = (await Send(bookingClient, HttpMethod.Get, $"/api/v1/trips/{trip}/seats", token)).GetProperty("seats").EnumerateArray().Select(s => s.GetProperty("id").GetGuid()).ToArray();
        var hold = await Send(bookingClient, HttpMethod.Post, $"/api/v1/trips/{trip}/seat-holds", token, new { seatIds = seats, pickupStopId = origin, dropoffStopId = destination });
        var couponCode = withCoupon ? "BLUE20" : null;
        var payable = withCoupon ? 250000L : 300000L;
        if (withCoupon)
        {
            await Send(bookingClient, HttpMethod.Put, "/api/v1/admin/coupons", TestJwt.Mint(Guid.NewGuid(), ["PLATFORM_ADMIN"]),
                new { code=couponCode, percent=20, cap=50000, minimum=250000, startsAt=DateTimeOffset.UtcNow.AddDays(-1), expiresAt=DateTimeOffset.UtcNow.AddDays(1), active=true });
        }
        var booking = await Send(bookingClient, HttpMethod.Post, "/api/v1/bookings", token, new {
            holdToken = hold.GetProperty("holdToken").GetString(), contact = new { fullName = "Nguyen An", email = "an@example.test", phone = "+84911111111" },
            passengers = seats.Select((seat, index) => new { seatId = seat, fullName = "Passenger " + index, pickupStopId = origin, dropoffStopId = destination }),
            expectedTotal = payable, couponCode, currency = "VND", paymentChannel = "PREPAID"
        });
        var bookingId = booking.GetProperty("id").GetGuid();
        var created = await ReadEvent(connectionString, "BookingCreated", bookingId);
        await PaymentEventHandlers.HandleAsync(fixture.Factory.Services, created, default);
        var payment = await Send(paymentClient, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments", token,
            new { provider = "SEPAY", method = "BANK_TRANSFER", returnUri = "https://blue.example.test/payment/sepay/return" });
        Assert.Equal(payable, decimal.Parse(payment.GetProperty("providerAction").GetProperty("order_amount").GetString()!, System.Globalization.CultureInfo.InvariantCulture));
        var paymentId = payment.GetProperty("id").GetGuid();
        Assert.Equal(0, (await Send(bookingClient, HttpMethod.Get, $"/api/v1/bookings/{bookingId}/tickets", token)).GetArrayLength());
        var notification = new {
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), notification_type = "ORDER_PAID",
            order = new { order_invoice_number = payment.GetProperty("providerAction").GetProperty("order_invoice_number").GetString(), order_amount = payable.ToString("F2", System.Globalization.CultureInfo.InvariantCulture), order_currency = "VND", order_status = "CAPTURED" },
            transaction = new { id = Guid.NewGuid().ToString(), transaction_amount = payable.ToString(System.Globalization.CultureInfo.InvariantCulture), transaction_currency = "VND", transaction_status = "APPROVED", transaction_type = "PAYMENT" }, customer = new { customer_id = user.ToString() }
        };
        async Task<HttpStatusCode> SendIpnAsync(HttpClient client)
        {
            using var hook = new HttpRequestMessage(HttpMethod.Post, "/integrations/payments/sepay/ipn");
            hook.Headers.Add("X-Secret-Key", "test-only-ipn-key");
            hook.Content = JsonContent.Create(notification);
            using var response = await client.SendAsync(hook);
            return response.StatusCode;
        }

        if (scheduled)
        {
            await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString());
            await connection.OpenAsync();
            await using var age = new NpgsqlCommand(
                "UPDATE payments SET created_at = NOW() - INTERVAL '2 minutes' WHERE id = @id", connection);
            age.Parameters.AddWithValue("id", paymentId);
            await age.ExecuteNonQueryAsync();

            var capture = new SePayNotification(notification.order.order_invoice_number!, notification.transaction.id,
                "ORDER_PAID", payable, "VND");
            await using var reconciliationHost = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(
                services => services.AddSingleton<ISePayOrderLookup>(new CapturedInvoice(capture))));
            var check = reconciliationHost.Services.GetRequiredService<SePayReconciliation>();
            await check.CheckDueAsync(default);
            var verified = await Send(paymentClient, HttpMethod.Get, $"/api/v1/payments/{paymentId}", token);
            Assert.Equal("SUCCEEDED", verified.GetProperty("status").GetString());
        }

        Assert.Equal(HttpStatusCode.OK, await SendIpnAsync(replicaClient));
        Assert.Equal(HttpStatusCode.OK, await SendIpnAsync(paymentClient));
        await using (var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var count = new NpgsqlCommand("SELECT COUNT(*) FROM outbox_messages WHERE aggregate_id = @id AND message_type = 'PaymentSucceeded'", connection);
            count.Parameters.AddWithValue("id", paymentId);
            Assert.Equal(1L, await count.ExecuteScalarAsync());
        }
        if (bookingExpiresBeforeEvent)
        {
            await using var connection = new NpgsqlConnection(connectionString); await connection.OpenAsync();
            await using var expire = new NpgsqlCommand("UPDATE bookings SET created_at = NOW() - INTERVAL '2 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE id = @id", connection);
            expire.Parameters.AddWithValue("id", bookingId); await expire.ExecuteNonQueryAsync();
        }
        var paid = await ReadEvent(fixture.Container.GetConnectionString(), "PaymentSucceeded", paymentId);
        // Same production consumer, duplicate delivery. Transport is intentionally explicit in this deterministic test.
        await BookingEventHandlers.HandlePaymentAsync(bookingFactory.Services, paid, default);
        await BookingEventHandlers.HandlePaymentAsync(bookingFactory.Services, paid, default);
        var tickets = await Send(bookingClient, HttpMethod.Get, $"/api/v1/bookings/{bookingId}/tickets", token);
        if (bookingExpiresBeforeEvent)
        {
            Assert.Equal(0, tickets.GetArrayLength());
            var refund = await ReadEvent(connectionString, "RefundRequested", bookingId);
            await PaymentEventHandlers.HandleAsync(fixture.Factory.Services, refund, default);
            var state = await Send(paymentClient, HttpMethod.Get, $"/api/v1/payments/{paymentId}", token);
            Assert.Equal("REFUND_PENDING", state.GetProperty("status").GetString());
            return;
        }
        Assert.Equal(2, tickets.GetArrayLength());
        Assert.Equal(payable, tickets.EnumerateArray().Sum(t => t.GetProperty("unitPrice").GetInt64()));
        Assert.All(tickets.EnumerateArray(), ticket => Assert.NotEmpty(ticket.GetProperty("qrPayload").GetString()!));
        var stranger = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        using var denied = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/bookings/{bookingId}/tickets"); denied.Headers.Authorization = new AuthenticationHeaderValue("Bearer", stranger);
        Assert.Equal(HttpStatusCode.NotFound, (await bookingClient.SendAsync(denied)).StatusCode);
        var operatorToken = TestJwt.Mint(Guid.CreateVersion7(), ["OPERATOR_ADMIN"], org);
        var manifest = await Send(bookingClient, HttpMethod.Get, $"/api/v1/operator/trips/{trip}/manifest", operatorToken);
        Assert.Equal(2, manifest.GetProperty("passengers").GetArrayLength());
        var stateBooking = await Send(bookingClient, HttpMethod.Get, $"/api/v1/bookings/{bookingId}", token);
        Assert.Equal("PAID", stateBooking.GetProperty("status").GetString());
        var preview = await Send(bookingClient, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/cancellation-preview", token,
            new { ticketIds = tickets.EnumerateArray().Select(t => t.GetProperty("id").GetGuid()).ToArray() });
        var cancellation = await Send(bookingClient, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/cancel", token, new {
            previewId = preview.GetProperty("previewId").GetGuid(), expectedVersion = stateBooking.GetProperty("rowVersion").GetInt64(), reason = "CUSTOMER_CANCELLATION" });
        var refundEvent = await ReadEvent(connectionString, "RefundRequested", bookingId);
        Assert.Equal(refundEvent.EventId, cancellation.GetProperty("refundRequestId").GetGuid());
        await PaymentEventHandlers.HandleAsync(fixture.Factory.Services, await ReadEvent(connectionString, "BookingCancelled", bookingId), default);
        await PaymentEventHandlers.HandleAsync(fixture.Factory.Services, refundEvent, default);
        await PaymentEventHandlers.HandleAsync(fixture.Factory.Services, refundEvent, default);
        Assert.Equal("REFUND_PENDING", (await Send(paymentClient, HttpMethod.Get, $"/api/v1/payments/{paymentId}", token)).GetProperty("status").GetString());
        var cancelled = await Send(bookingClient, HttpMethod.Get, $"/api/v1/bookings/{bookingId}/tickets", token);
        Assert.All(cancelled.EnumerateArray(), t => Assert.Equal("CANCELLED", t.GetProperty("status").GetString()));
        Assert.All(cancelled.EnumerateArray(), t => Assert.Equal(refundEvent.EventId, t.GetProperty("refundRequestId").GetGuid()));
        var refundPath = $"/api/v1/refunds?bookingId={bookingId}";
        var customerRefund = Assert.Single((await Send(paymentClient, HttpMethod.Get, refundPath, token)).GetProperty("items").EnumerateArray());
        var refundId = customerRefund.GetProperty("id").GetGuid();
        Assert.Equal("EVENT-" + refundEvent.EventId.ToString("N"), customerRefund.GetProperty("refundReference").GetString());
        var refundAmount = preview.GetProperty("refundAmount").GetInt64();
        Assert.Equal(refundAmount, customerRefund.GetProperty("amount").GetInt64());
        Assert.Equal("SEPAY", customerRefund.GetProperty("paymentProvider").GetString());
        Assert.Equal("REQUESTED", customerRefund.GetProperty("status").GetString());
        using var privateRefunds = new HttpRequestMessage(HttpMethod.Get, refundPath);
        privateRefunds.Headers.Authorization = new AuthenticationHeaderValue("Bearer", stranger);
        Assert.Equal(HttpStatusCode.NotFound, (await paymentClient.SendAsync(privateRefunds)).StatusCode);

        var transferPath = $"/api/v1/admin/refunds/{refundId}/transfer";
        var transfer = new { transferReference = "SANDBOX-" + refundId.ToString("N"), amount = refundAmount };
        using var forbiddenTransfer = new HttpRequestMessage(HttpMethod.Put, transferPath) { Content = JsonContent.Create(transfer) };
        forbiddenTransfer.Headers.Authorization = new AuthenticationHeaderValue("Bearer", operatorToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await paymentClient.SendAsync(forbiddenTransfer)).StatusCode);
        var financeToken = TestJwt.Mint(Guid.CreateVersion7(), ["PLATFORM_ADMIN"]);
        var saved = await Send(paymentClient, HttpMethod.Put, transferPath, financeToken, transfer);
        Assert.Equal("SUCCEEDED", saved.GetProperty("status").GetString());
        await Send(replicaClient, HttpMethod.Put, transferPath, financeToken, transfer);
        var verifiedRefund = await Send(paymentClient, HttpMethod.Get, $"/api/v1/refunds/{refundId}", token);
        Assert.Equal("SUCCEEDED", verifiedRefund.GetProperty("status").GetString());
        var audit = await Send(paymentClient, HttpMethod.Get, $"/api/v1/admin/refunds/{refundId}/audit", financeToken);
        Assert.Equal(transfer.transferReference.ToUpperInvariant(), audit.GetProperty("transferReference").GetString());
        Assert.Equal("PARTIALLY_REFUNDED", (await Send(paymentClient, HttpMethod.Get, $"/api/v1/payments/{paymentId}", token)).GetProperty("status").GetString());
        var recorded = await ReadEvent(fixture.Container.GetConnectionString(), "RefundSucceeded", refundId);
        await BookingEventHandlers.HandlePaymentAsync(bookingFactory.Services, recorded, default);
        await BookingEventHandlers.HandlePaymentAsync(bookingFactory.Services, recorded, default);
        Assert.Equal("REFUNDED", (await Send(bookingClient, HttpMethod.Get, $"/api/v1/bookings/{bookingId}", token)).GetProperty("status").GetString());

        await using var verify = new NpgsqlConnection(fixture.Container.GetConnectionString());
        await verify.OpenAsync();
        await using var result = new NpgsqlCommand("""
            SELECT (SELECT COUNT(*) FROM refunds WHERE payment_id = @payment),
              (SELECT COUNT(*) FROM outbox_messages WHERE aggregate_id = @refund AND message_type = 'RefundSucceeded'),
              (SELECT gross_amount FROM booking_settlements WHERE payment_id = @payment)
            """, verify);
        result.Parameters.AddWithValue("refund", refundId);
        result.Parameters.AddWithValue("payment", paymentId);
        await using var reader = await result.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(1L, reader.GetInt64(0));
        Assert.Equal(1L, reader.GetInt64(1));
        Assert.Equal(payable - refundAmount, reader.GetInt64(2));
    }

    private sealed class CapturedInvoice(SePayNotification capture) : ISePayOrderLookup
    {
        public Task<Result<IReadOnlyList<SePayNotification>>> FindCapturesAsync(string invoice,
            CancellationToken cancellationToken) =>
            Task.FromResult(Result<IReadOnlyList<SePayNotification>>.Success(
                invoice == capture.Invoice ? [capture] : []));
    }

    private static async Task<EventMessage> ReadEvent(string connectionString, string type, Guid aggregate)
    {
        await using var connection = new NpgsqlConnection(connectionString); await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT payload::text FROM outbox_messages WHERE aggregate_id = @id AND message_type = @type ORDER BY occurred_at LIMIT 1", connection);
        command.Parameters.AddWithValue("id", aggregate); command.Parameters.AddWithValue("type", type);
        var payload = (string)(await command.ExecuteScalarAsync())!; Assert.NotNull(payload);
        return JsonSerializer.Deserialize<EventMessage>(payload, EventMessageJson.Options)!;
    }

    private static async Task<JsonElement> Send(HttpClient client, HttpMethod method, string path, string token, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) { request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString()); request.Content = JsonContent.Create(body); }
        var response = await client.SendAsync(request);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
