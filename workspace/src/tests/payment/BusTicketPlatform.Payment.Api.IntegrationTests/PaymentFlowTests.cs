using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Payment.Application;
using BusTicketPlatform.Payment.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Payment.Api.IntegrationTests;

[CollectionDefinition("PaymentApi", DisableParallelization = true)]
public sealed class PaymentApiCollection : ICollectionFixture<PaymentPostgresFixture>;

public sealed class PaymentPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder().WithImage("postgres:17-alpine").WithDatabase("payment").WithUsername("platform").WithPassword("postgres").Build();
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authentication:SigningKey", TestJwt.SigningKey);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<PaymentDatabaseOptions>();
                services.AddSingleton(new PaymentDatabaseOptions { ConnectionString = Container.GetConnectionString() });
            });
        });
    }
    public HttpClient CreateClient() => Factory.CreateClient();
    public async Task DisposeAsync() { await Factory.DisposeAsync(); await Container.DisposeAsync(); }
}

[Collection("PaymentApi")]
public sealed class PaymentFlowTests
{
    private readonly PaymentPostgresFixture _fixture;
    public PaymentFlowTests(PaymentPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Webhook_succeeds_prepaid_payment()
    {
        var client = _fixture.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/ready")).StatusCode);
        var bookingId = Guid.CreateVersion7();
        var user = Guid.CreateVersion7();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new
        {
            bookingId,
            customerId = user,
            organizationId = Guid.CreateVersion7(),
            amount = 150000,
            currency = "VND",
            paymentChannel = "PREPAID",
            commissionRate = 0.1m
        });
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);

        var token = TestJwt.Mint(user, ["CUSTOMER"]);
        using var create = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments");
        create.Content = JsonContent.Create(new { provider = "VNPAY_SANDBOX", method = "VNPAY_QR", returnUri = "https://example.test/return" });
        create.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        create.Headers.Add("Idempotency-Key", Guid.CreateVersion7().ToString("N"));
        var created = await client.SendAsync(create);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("PROCESSING", body.GetProperty("status").GetString());
        var redirect = body.GetProperty("providerAction").GetProperty("redirectUri").GetString();
        Assert.Contains("vnp_TxnRef=", redirect, StringComparison.Ordinal);
        Assert.Contains("vnp_SecureHash=", redirect, StringComparison.Ordinal);
        var payment = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/payments/{body.GetProperty("id")}") { Headers = { Authorization = new AuthenticationHeaderValue("Bearer", token) } });
        var paymentBody = await payment.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        // logicalReference is not on DTO; webhook uses booking via Create storing logical_reference PAY-...
        var hook = await SendWebhook(client, paymentBody.GetProperty("id").GetGuid(), 150000, "VND");
        Assert.True(hook.IsSuccessStatusCode, await hook.Content.ReadAsStringAsync());
        var paid = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/payments/{body.GetProperty("id")}") { Headers = { Authorization = new AuthenticationHeaderValue("Bearer", token) } });
        var paidBody = await paid.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("SUCCEEDED", paidBody.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Payment_stays_processing_without_webhook_and_rejects_unverified_provider_data()
    {
        var client = _fixture.CreateClient();
        var (paymentId, user, token) = await CreatePayment(client, 150000, "VND");
        Assert.Equal("PROCESSING", (await GetPayment(client, paymentId, token)).GetProperty("status").GetString());

        var unsigned = await client.PostAsJsonAsync("/integrations/payments/vnpay-sandbox/webhooks", new
        {
            vnp_TmnCode = "LOCALDEV",
            vnp_TxnRef = paymentId.ToString(),
            vnp_Amount = "15000000",
            vnp_CurrCode = "VND",
            vnp_ResponseCode = "00",
            vnp_TransactionNo = Guid.CreateVersion7().ToString("N")
        });
        Assert.Equal(HttpStatusCode.BadRequest, unsigned.StatusCode);

        var wrongAmount = await SendWebhook(client, paymentId, 149999, "VND");
        Assert.Equal(HttpStatusCode.BadRequest, wrongAmount.StatusCode);
        var wrongCurrency = await SendWebhook(client, paymentId, 150000, "USD");
        Assert.Equal(HttpStatusCode.BadRequest, wrongCurrency.StatusCode);
        Assert.Equal("PROCESSING", (await GetPayment(client, paymentId, token)).GetProperty("status").GetString());
        _ = user;
    }

    [Fact]
    public async Task Expired_booking_quote_rejects_new_payment()
    {
        var client = _fixture.CreateClient();
        var bookingId = Guid.CreateVersion7();
        var user = Guid.CreateVersion7();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new
        {
            bookingId,
            customerId = user,
            organizationId = Guid.CreateVersion7(),
            amount = 150000,
            currency = "VND",
            paymentChannel = "PREPAID",
            commissionRate = 0.1m,
            expiresAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        });
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);

        var response = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments", new
        {
            provider = "VNPAY_SANDBOX",
            method = "VNPAY_QR",
            returnUri = "https://example.test/return"
        }, TestJwt.Mint(user, ["CUSTOMER"]), Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("BOOKING_EXPIRED", body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Duplicate_success_is_idempotent_and_creates_one_settlement()
    {
        var client = _fixture.CreateClient();
        var (paymentId, _, token) = await CreatePayment(client, 150000, "VND");
        var eventId = Guid.CreateVersion7().ToString("N");
        Assert.True((await SendWebhook(client, paymentId, 150000, "VND", eventId)).IsSuccessStatusCode);
        Assert.True((await SendWebhook(client, paymentId, 150000, "VND", eventId)).IsSuccessStatusCode);
        Assert.True((await SendWebhook(client, paymentId, 150000, "VND", Guid.CreateVersion7().ToString("N"))).IsSuccessStatusCode);
        Assert.Equal("SUCCEEDED", (await GetPayment(client, paymentId, token)).GetProperty("status").GetString());

        Assert.Equal(1L, await Scalar("SELECT COUNT(*) FROM booking_settlements WHERE payment_id = @id", paymentId));
        Assert.Equal(1L, await Scalar("SELECT COUNT(*) FROM outbox_messages WHERE message_type = 'PaymentSucceeded' AND aggregate_id = @id", paymentId));
    }

    [Fact]
    public async Task Late_success_is_compensated_and_refund_ceiling_is_enforced()
    {
        var client = _fixture.CreateClient();
        var (latePaymentId, _, lateToken) = await CreatePayment(client, 150000, "VND");
        await Execute("UPDATE payments SET created_at = NOW() - INTERVAL '20 minutes', expires_at = NOW() - INTERVAL '10 minutes' WHERE id = @id", latePaymentId);
        Assert.Equal(HttpStatusCode.Accepted, (await Send(client, HttpMethod.Post, $"/api/v1/payments/{latePaymentId}/cancel", null, lateToken, Guid.CreateVersion7().ToString("N"))).StatusCode);
        Assert.True((await SendWebhook(client, latePaymentId, 150000, "VND")).IsSuccessStatusCode);
        Assert.Equal("REFUNDED", (await GetPayment(client, latePaymentId, lateToken)).GetProperty("status").GetString());
        Assert.Equal(1L, await Scalar("SELECT COUNT(*) FROM refunds WHERE payment_id = @id AND status = 'SUCCEEDED'", latePaymentId));
        Assert.Equal(0L, await Scalar("SELECT gross_amount FROM booking_settlements WHERE payment_id = @id AND collection_status = 'REFUNDED'", latePaymentId));

        var (paymentId, _, token) = await CreatePayment(client, 150000, "VND");
        Assert.True((await SendWebhook(client, paymentId, 150000, "VND")).IsSuccessStatusCode);
        var payment = await GetPayment(client, paymentId, token);
        var bookingId = payment.GetProperty("bookingId").GetGuid();
        var finance = TestJwt.Mint(Guid.CreateVersion7(), ["PLATFORM_FINANCE"]);

        var partialReference = "TEST-PARTIAL-" + Guid.CreateVersion7().ToString("N");
        var partialBody = new
        {
            refundReference = partialReference,
            paymentId,
            bookingId,
            amount = 100000,
            currency = "VND",
            reason = "TEST"
        };
        var first = await Send(client, HttpMethod.Post, "/api/v1/refunds", partialBody, finance, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);

        var replay = await Send(client, HttpMethod.Post, "/api/v1/refunds", partialBody, finance, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Accepted, replay.StatusCode);

        var over = await Send(client, HttpMethod.Post, "/api/v1/refunds", new
        {
            refundReference = "TEST-OVER-" + Guid.CreateVersion7().ToString("N"),
            paymentId,
            bookingId,
            amount = 60000,
            currency = "VND",
            reason = "TEST"
        }, finance, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Conflict, over.StatusCode);
        Assert.Equal(100000L, await Scalar("SELECT COALESCE(SUM(amount),0) FROM refunds WHERE payment_id = @id AND status = 'SUCCEEDED'", paymentId));
        Assert.Equal(50000L, await Scalar("SELECT gross_amount FROM booking_settlements WHERE payment_id = @id AND commission_amount = 5000 AND operator_net = 45000", paymentId));
    }

    [Fact]
    public async Task Operator_finance_cannot_read_another_operators_payment()
    {
        var client = _fixture.CreateClient();
        var organizationId = Guid.CreateVersion7();
        var otherOrganizationId = Guid.CreateVersion7();
        var bookingId = Guid.CreateVersion7();
        var customerId = Guid.CreateVersion7();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new BookingQuote(bookingId, customerId, organizationId, 150000, "VND", "PREPAID", 0.1m));
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);
        var customerToken = TestJwt.Mint(customerId, ["CUSTOMER"]);
        var created = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments", new
        {
            provider = "VNPAY_SANDBOX", method = "VNPAY_QR", returnUri = "https://example.test/return"
        }, customerToken, Guid.CreateVersion7().ToString("N"));
        var paymentId = JsonSerializer.Deserialize<JsonElement>(await created.Content.ReadAsStringAsync()).GetProperty("id").GetGuid();

        var ownFinance = TestJwt.Mint(Guid.CreateVersion7(), ["OPERATOR_FINANCE"], organizationId);
        var otherFinance = TestJwt.Mint(Guid.CreateVersion7(), ["OPERATOR_FINANCE"], otherOrganizationId);
        Assert.Equal(HttpStatusCode.OK, (await Send(client, HttpMethod.Get, $"/api/v1/payments/{paymentId}", null, ownFinance)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(client, HttpMethod.Get, $"/api/v1/payments/{paymentId}", null, otherFinance)).StatusCode);
        var search = await Send(client, HttpMethod.Get, "/api/v1/admin/payments?page=0&size=20", null, otherFinance);
        Assert.Equal(HttpStatusCode.OK, search.StatusCode);
        Assert.Equal(0, (await search.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("totalElements").GetInt64());
    }

    private async Task<(Guid PaymentId, Guid UserId, string Token)> CreatePayment(HttpClient client, long amount, string currency)
    {
        var bookingId = Guid.CreateVersion7();
        var user = Guid.CreateVersion7();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new
        {
            bookingId,
            customerId = user,
            organizationId = Guid.CreateVersion7(),
            amount,
            currency,
            paymentChannel = "PREPAID",
            commissionRate = 0.1m,
            expiresAt = DateTimeOffset.UtcNow.AddMinutes(10)
        });
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);
        var token = TestJwt.Mint(user, ["CUSTOMER"]);
        var response = await Send(client, HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments", new
        {
            provider = "VNPAY_SANDBOX",
            method = "VNPAY_QR",
            returnUri = "https://example.test/return"
        }, token, Guid.CreateVersion7().ToString("N"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
        return (body.GetProperty("id").GetGuid(), user, token);
    }

    private static async Task<JsonElement> GetPayment(HttpClient client, Guid paymentId, string token)
    {
        var response = await Send(client, HttpMethod.Get, $"/api/v1/payments/{paymentId}", null, token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
    }

    private static Task<HttpResponseMessage> SendWebhook(HttpClient client, Guid paymentId, long amount, string currency, string? eventId = null)
    {
        var fields = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_TmnCode"] = "LOCALDEV",
            ["vnp_TxnRef"] = paymentId.ToString(),
            ["vnp_Amount"] = (amount * 100).ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = currency,
            ["vnp_ResponseCode"] = "00",
            ["vnp_TransactionNo"] = eventId ?? Guid.CreateVersion7().ToString("N")
        };
        fields["vnp_SecureHash"] = VnPayCheckout.Sign("local-dev-only-vnpay-hash-secret-32b", fields);
        return client.PostAsJsonAsync("/integrations/payments/vnpay-sandbox/webhooks", fields);
    }

    private async Task Execute(string sql, Guid id)
    {
        await using var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<long> Scalar(string sql, Guid id, bool textParameter = false)
    {
        await using var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", textParameter ? id.ToString() : id);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static async Task<HttpResponseMessage> Send(HttpClient client, HttpMethod method, string path, object? body, string bearer, string? idem = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null) request.Content = JsonContent.Create(body);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        if (idem is not null) request.Headers.Add("Idempotency-Key", idem);
        return await client.SendAsync(request);
    }
}
