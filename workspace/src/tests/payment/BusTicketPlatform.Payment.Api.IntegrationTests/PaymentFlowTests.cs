using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BusTicketPlatform.Payment.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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
        var hook = await client.PostAsJsonAsync("/integrations/payments/vnpay-sandbox/webhooks", new
        {
            logicalReference = (string?)null,
            success = true,
            externalEventId = Guid.CreateVersion7().ToString("N"),
            txnRef = paymentBody.GetProperty("id").GetGuid().ToString()
        });
        Assert.True(hook.IsSuccessStatusCode, await hook.Content.ReadAsStringAsync());
        var paid = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/payments/{body.GetProperty("id")}") { Headers = { Authorization = new AuthenticationHeaderValue("Bearer", token) } });
        var paidBody = await paid.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("SUCCEEDED", paidBody.GetProperty("status").GetString());
    }
}
