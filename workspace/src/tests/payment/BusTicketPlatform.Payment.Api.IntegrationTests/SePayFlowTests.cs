using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using BusTicketPlatform.Payment.Application;
using BusTicketPlatform.Payment.Infrastructure;
using Xunit.Abstractions;

namespace BusTicketPlatform.Payment.Api.IntegrationTests;

[Collection("PaymentApi")]
public sealed class SePayFlowTests(PaymentPostgresFixture fixture, ITestOutputHelper output)
{
    [Theory]
    [InlineData("http://127.0.0.1:5173", "sandbox", "http://127.0.0.1:5173")]
    [InlineData("http://127.0.0.1:5180", "sandbox", "http://127.0.0.1:5180")]
    [InlineData("http://localhost:5180", "sandbox", "http://localhost:5180")]
    [InlineData("https://localhost:5180", "sandbox", "https://localhost:5180")]
    [InlineData("http://127.0.0.1:5180", "production", "https://blue.example.test")]
    [InlineData("https://attacker.example", "sandbox", "https://blue.example.test")]
    [InlineData("http://localhost.attacker.example:5180", "sandbox", "https://blue.example.test")]
    [InlineData("http://user@localhost:5180", "sandbox", "https://blue.example.test")]
    public void Sandbox_returns_to_the_original_local_origin_without_open_redirects(string origin, string environment, string expected)
    {
        var options = new SePayOptions { Environment=environment, CustomerOrigin="https://blue.example.test", MerchantId="test", SecretKey="test-secret", IpnSecretKey="test-ipn" };
        var booking=Guid.NewGuid();
        var payment=new PaymentRecord(Guid.NewGuid(),booking,Guid.NewGuid(),Guid.NewGuid(),"SEPAY","PAY-TEST",280000,"VND","PROCESSING",DateTimeOffset.UtcNow.AddMinutes(5),0,origin+"/payment/sepay/return?bookingId="+booking);
        var action=SePayCheckout.BuildAction(options,payment,"BANK_TRANSFER");
        foreach(var field in new[]{"success_url","error_url","cancel_url"})
        {
            if(environment == "sandbox" && expected != "https://blue.example.test")
            {
                Assert.StartsWith("https://blue.example.test/integrations/payments/sepay/browser-return?state=",action[field]);
                var token=new Uri(action[field]).Query[7..];
                Assert.True(SePayCheckout.TryReadLocalReturn(options,token,out var target));
                Assert.Equal(expected+"/payment/sepay/return?bookingId="+booking,target);
                Assert.False(SePayCheckout.TryReadLocalReturn(options,token+"x",out _));
            }
            else Assert.Equal(expected+"/payment/sepay/return?bookingId="+booking,action[field]);
        }
        Assert.Equal(SePayCheckout.Sign(action,options.SecretKey),action["signature"]);
    }

    [Fact]
    public async Task Resuming_an_existing_payment_uses_the_current_browser_origin()
    {
        var client=fixture.CreateClient();var user=Guid.NewGuid();var first=await Create(client,user);
        using var request=new HttpRequestMessage(HttpMethod.Post,$"/api/v1/bookings/{first.GetProperty("bookingId").GetGuid()}/payments");
        request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",TestJwt.Mint(user,["CUSTOMER"]));
        request.Headers.Add("Idempotency-Key",Guid.NewGuid().ToString());
        request.Content=JsonContent.Create(new {provider="SEPAY",method="BANK_TRANSFER",returnUri="http://127.0.0.1:5180/payment/sepay/return"});
        var response=await client.SendAsync(request);Assert.Equal(HttpStatusCode.Created,response.StatusCode);
        var resumed=await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(first.GetProperty("id").GetGuid(),resumed.GetProperty("id").GetGuid());
        var callback=resumed.GetProperty("providerAction").GetProperty("success_url").GetString()!;
        Assert.StartsWith("https://blue.example.test/integrations/payments/sepay/browser-return?state=",callback);
        using var bridgeClient=fixture.Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect=false });
        var redirect=await bridgeClient.GetAsync(new Uri(callback).PathAndQuery);
        Assert.Equal(HttpStatusCode.Redirect,redirect.StatusCode);
        Assert.Equal("http://127.0.0.1:5180/payment/sepay/return?bookingId="+first.GetProperty("bookingId").GetGuid(),redirect.Headers.Location!.ToString());
        Assert.Equal("no-store",redirect.Headers.CacheControl!.ToString());
        Assert.Equal(HttpStatusCode.BadRequest,(await bridgeClient.GetAsync("/integrations/payments/sepay/browser-return?state=invalid")).StatusCode);
    }

    [Fact]
    public void Expired_local_handoff_is_rejected_and_nonpublic_customer_origin_is_not_configured()
    {
        var options=new SePayOptions{Environment="sandbox",CustomerOrigin="https://blue.example.test",MerchantId="test",SecretKey="test-secret",IpnSecretKey="test-ipn"};
        var payment=new PaymentRecord(Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),"SEPAY","PAY-EXPIRED",280000,"VND","PROCESSING",DateTimeOffset.UtcNow.AddDays(-2),0,"http://localhost:5180/payment/sepay/return");
        var callback=SePayCheckout.BuildAction(options,payment,"BANK_TRANSFER")["success_url"];
        Assert.False(SePayCheckout.TryReadLocalReturn(options,new Uri(callback).Query[7..],out _));
        options.CustomerOrigin="http://localhost:5173";
        Assert.False(options.IsConfigured);
    }

    private async Task<JsonElement> Create(HttpClient client, Guid? user = null, string method = "BANK_TRANSFER")
    {
        var owner = user ?? Guid.CreateVersion7();
        var booking = Guid.CreateVersion7();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new {
            bookingId = booking, customerId = owner, organizationId = Guid.CreateVersion7(), amount = 280000,
            currency = "VND", paymentChannel = "PREPAID", commissionRate = 0.1m, expiresAt = DateTimeOffset.UtcNow.AddMinutes(10)
        });
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/bookings/{booking}/payments");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(owner, ["CUSTOMER"]));
        request.Headers.Add("Idempotency-Key", Guid.CreateVersion7().ToString());
        request.Content = JsonContent.Create(new { provider = "SEPAY", method, returnUri = "https://attacker.example/return" });
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static object Notification(JsonElement payment, string txn, string type = "ORDER_PAID", long amount = 280000) => new {
        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), notification_type = type,
        order = new { order_invoice_number = payment.GetProperty("providerAction").GetProperty("order_invoice_number").GetString(),
            order_status = "CAPTURED", order_amount = amount.ToString() + ".00", order_currency = "VND" },
        transaction = new { id = txn, transaction_type = "PAYMENT", transaction_status = "APPROVED", transaction_amount = amount.ToString(), transaction_currency = "VND" },
        customer = new { customer_id = "test-customer" }
    };

    private static async Task<HttpResponseMessage> Ipn(HttpClient client, object payload, string secret = "test-only-ipn-key")
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/integrations/payments/sepay/ipn");
        request.Headers.Add("X-Secret-Key", secret);
        request.Content = JsonContent.Create(payload);
        return await client.SendAsync(request);
    }

    private async Task<long> Count(string table, Guid paymentId, string? messageType = null)
    {
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        var filter = table == "outbox_messages" ? "aggregate_id" : "payment_id";
        var messageFilter = messageType is null ? "" : " AND message_type = @messageType";
        await using var command = new NpgsqlCommand($"SELECT COUNT(*) FROM {table} WHERE {filter} = @id{messageFilter}", connection);
        command.Parameters.AddWithValue("id", paymentId);
        if (messageType is not null) command.Parameters.AddWithValue("messageType", messageType);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private async Task<string> Status(Guid paymentId)
    {
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()); await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT status FROM payments WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", paymentId);
        return (string)(await command.ExecuteScalarAsync())!;
    }

    [Theory]
    [InlineData("captured", 200, "SUCCEEDED")]
    [InlineData("concurrent", 200, "SUCCEEDED")]
    [InlineData("expired", 200, "REFUND_PENDING")]
    [InlineData("pending", 200, "PROCESSING")]
    [InlineData("mismatch", 503, "PROCESSING")]
    [InlineData("outage", 503, "PROCESSING")]
    public async Task SePay_reconciliation_checks_owner_and_reuses_capture_invariants(string scenario, int expectedStatus, string paymentStatus)
    {
        using var primary = fixture.CreateClient();
        var customerId = Guid.NewGuid();
        var payment = await Create(primary, customerId);
        var paymentId = payment.GetProperty("id").GetGuid();
        var invoice = payment.GetProperty("providerAction").GetProperty("order_invoice_number").GetString();
        var transactionId = Guid.NewGuid().ToString();
        var requestCount = 0;
        if (scenario == "expired")
        {
            await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString());
            await connection.OpenAsync();
            await using var expire = new NpgsqlCommand("""
                UPDATE payments SET created_at = NOW() - INTERVAL '2 minutes', expires_at = NOW() - INTERVAL '1 minute'
                WHERE id = @id;
                """, connection);
            expire.Parameters.AddWithValue("id", paymentId);
            await expire.ExecuteNonQueryAsync();
        }

        await using var replica = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddHttpClient<ISePayOrderLookup, SePayOrderLookup>().ConfigurePrimaryHttpMessageHandler(() =>
                new OrderHandler(async request =>
                {
                    Interlocked.Increment(ref requestCount);
                    Assert.Equal(HttpMethod.Get, request.Method);
                    Assert.Equal($"https://pgapi-sandbox.sepay.vn/v1/order/detail/{invoice}", request.RequestUri!.AbsoluteUri);
                    Assert.Equal("Basic", request.Headers.Authorization?.Scheme);
                    Assert.Equal("TEST_MERCHANT:test-only-merchant-key", System.Text.Encoding.UTF8.GetString(
                        Convert.FromBase64String(request.Headers.Authorization!.Parameter!)));
                    if (scenario == "concurrent")
                    {
                        using var ipn = await Ipn(primary, Notification(payment, transactionId));
                        Assert.Equal(HttpStatusCode.OK, ipn.StatusCode);
                    }
                    var amount = scenario == "mismatch" ? "290000" : "280000";
                    return scenario == "outage" ? new HttpResponseMessage(HttpStatusCode.BadGateway) : new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = JsonContent.Create(new { data = new {
                            order_invoice_number = invoice,
                            order_status = scenario == "pending" ? "AUTHENTICATION_NOT_NEEDED" : "CAPTURED",
                            order_amount = amount + ".00", order_currency = "VND",
                            transactions = new[] { new { id = transactionId, transaction_type = "PAYMENT",
                                transaction_status = "APPROVED", transaction_amount = amount, transaction_currency = "VND" } }
                        } })
                    };
                }))));
        using var client = replica.CreateClient();

        async Task<HttpStatusCode> CheckAsync(Guid user)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/payments/{paymentId}/reconcile");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(user, ["CUSTOMER"]));
            using var response = await client.SendAsync(request);
            return response.StatusCode;
        }

        Assert.Equal(HttpStatusCode.NotFound, await CheckAsync(Guid.NewGuid()));
        Assert.Equal(0, requestCount);
        Assert.Equal((HttpStatusCode)expectedStatus, await CheckAsync(customerId));
        Assert.Equal(paymentStatus, await Status(paymentId));
        Assert.Equal(paymentStatus == "PROCESSING" ? HttpStatusCode.TooManyRequests : HttpStatusCode.OK, await CheckAsync(customerId));
        Assert.Equal(1, requestCount);

        if (scenario is "captured" or "expired" or "concurrent")
        {
            using var lateIpn = await Ipn(primary, Notification(payment, transactionId));
            Assert.Equal(HttpStatusCode.OK, lateIpn.StatusCode);
            Assert.Equal(1, await Count("webhook_receipts", paymentId));
        }

        Assert.Equal(paymentStatus == "SUCCEEDED" ? 1 : 0, await Count("outbox_messages", paymentId, "PaymentSucceeded"));
        Assert.Equal(scenario == "expired" ? 1 : 0, await Count("refunds", paymentId));
    }

    [Theory]
    [InlineData("active", "SUCCEEDED")]
    [InlineData("concurrent", "SUCCEEDED")]
    [InlineData("expired", "REFUND_PENDING")]
    [InlineData("outage", "PROCESSING")]
    public async Task Scheduled_reconciliation_recovers_missing_ipn_without_rechecking_on_two_instances(
        string scenario, string expectedStatus)
    {
        using var primary = fixture.CreateClient();
        var customer = Guid.NewGuid();
        var due = await Create(primary, customer);
        var fresh = await Create(primary);
        var olderExpired = scenario == "active" ? await Create(primary) : default;
        var id = due.GetProperty("id").GetGuid();
        var invoice = due.GetProperty("providerAction").GetProperty("order_invoice_number").GetString()!;
        var freshInvoice = fresh.GetProperty("providerAction").GetProperty("order_invoice_number").GetString()!;
        var transactionId = Guid.NewGuid().ToString();
        var checks = 0;
        var freshChecks = 0;
        var lookupStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseLookup = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using (var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var age = new NpgsqlCommand("""
                UPDATE payments SET created_at = NOW() - INTERVAL '2 minutes',
                    expires_at = CASE WHEN @expired THEN NOW() - INTERVAL '1 minute' ELSE expires_at END
                WHERE id = @id
                """, connection);
            age.Parameters.AddWithValue("id", id);
            age.Parameters.AddWithValue("expired", scenario == "expired");
            await age.ExecuteNonQueryAsync();
            if (scenario == "active")
            {
                await using var expireOlder = new NpgsqlCommand("""
                    UPDATE payments SET created_at = NOW() - INTERVAL '10 minutes', expires_at = NOW() - INTERVAL '7 minutes'
                    WHERE id = @id
                    """, connection);
                expireOlder.Parameters.AddWithValue("id", olderExpired.GetProperty("id").GetGuid());
                await expireOlder.ExecuteNonQueryAsync();
                var store = fixture.Factory.Services.GetRequiredService<ISePayPaymentStore>();
                Assert.Equal([id], await store.FindDueReconciliationsAsync(1, default));
            }
        }

        await using var replica = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("SePay:AutomaticReconciliationEnabled", scenario == "active" ? "true" : "false");
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<ISePayOrderLookup, SePayOrderLookup>().ConfigurePrimaryHttpMessageHandler(() =>
                new OrderHandler(async request =>
                {
                    var requested = request.RequestUri!.Segments[^1];
                    if (requested == freshInvoice) Interlocked.Increment(ref freshChecks);
                    if (requested != invoice)
                        return new HttpResponseMessage(HttpStatusCode.NotFound);

                    Interlocked.Increment(ref checks);
                    if (scenario == "outage")
                    {
                        lookupStarted.TrySetResult();
                        await releaseLookup.Task.WaitAsync(TimeSpan.FromSeconds(4));
                    }
                    if (scenario == "concurrent")
                    {
                        using var ipn = await Ipn(primary, Notification(due, transactionId));
                        Assert.Equal(HttpStatusCode.OK, ipn.StatusCode);
                    }
                    return scenario == "outage" ? new HttpResponseMessage(HttpStatusCode.BadGateway)
                        : new HttpResponseMessage(HttpStatusCode.OK)
                        {
                            Content = JsonContent.Create(new { data = new {
                                order_invoice_number = invoice, order_status = "CAPTURED",
                                order_amount = "280000", order_currency = "VND",
                                transactions = new[] { new { id = transactionId, transaction_type = "PAYMENT",
                                    transaction_status = "APPROVED", transaction_amount = "280000", transaction_currency = "VND" } }
                            } })
                        };
                })));
        });
        using var replicaClient = replica.CreateClient();
        if (scenario == "active")
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(24));
            while (await Status(id) == "PROCESSING")
                await Task.Delay(100, deadline.Token);
        }
        else
        {
            await using var secondReplica = replica.WithWebHostBuilder(_ => { });
            var first = replica.Services.GetRequiredService<SePayReconciliation>();
            var second = secondReplica.Services.GetRequiredService<SePayReconciliation>();
            if (scenario == "outage")
            {
                var running = first.CheckDueAsync(default);
                try
                {
                    await lookupStarted.Task.WaitAsync(TimeSpan.FromSeconds(4));
                    var manual = await second.CheckAsync(customer, id, Guid.NewGuid(), default);
                    Assert.Equal("RATE_LIMITED", manual.Error?.Code);
                    await second.CheckDueAsync(default);
                }
                finally
                {
                    releaseLookup.TrySetResult();
                    await running;
                }
            }
            else
            {
                await Task.WhenAll(first.CheckDueAsync(default), second.CheckDueAsync(default));
            }
        }

        Assert.Equal(1, checks);
        Assert.Equal(0, freshChecks);
        Assert.Equal(expectedStatus, await Status(id));
        Assert.Equal("PROCESSING", await Status(fresh.GetProperty("id").GetGuid()));
        if (scenario != "outage")
        {
            using var lateIpn = await Ipn(primary, Notification(due, transactionId));
            Assert.Equal(HttpStatusCode.OK, lateIpn.StatusCode);
            Assert.Equal(1, await Count("webhook_receipts", id));
        }
        Assert.Equal(expectedStatus == "SUCCEEDED" ? 1 : 0, await Count("outbox_messages", id, "PaymentSucceeded"));
        Assert.Equal(scenario == "expired" ? 1 : 0, await Count("refunds", id));
    }

    private sealed class OrderHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            respond(request);
    }

    [Fact]
    public async Task Checkout_database_failure_can_retry_same_key_without_duplicate_payment()
    {
        var client = fixture.CreateClient(); var owner = Guid.CreateVersion7(); var booking = Guid.CreateVersion7();
        var key = Guid.NewGuid().ToString();
        var quote = await client.PostAsJsonAsync("/internal/quotes", new {
            bookingId = booking, customerId = owner, organizationId = Guid.CreateVersion7(), amount = 280000,
            currency = "VND", paymentChannel = "PREPAID", commissionRate = 0.1m, expiresAt = DateTimeOffset.UtcNow.AddMinutes(10)
        });
        Assert.Equal(HttpStatusCode.NoContent, quote.StatusCode);
        async Task<HttpResponseMessage> Send()
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/bookings/{booking}/payments");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(owner, ["CUSTOMER"]));
            request.Headers.Add("Idempotency-Key", key);
            request.Content = JsonContent.Create(new { provider = "SEPAY", method = "BANK_TRANSFER", returnUri = "https://blue.example.test/return" });
            return await client.SendAsync(request);
        }
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()); await connection.OpenAsync();
        await using (var fault = new NpgsqlCommand("""
            CREATE FUNCTION fail_checkout_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected checkout failure'; END $$;
            CREATE TRIGGER fail_checkout_test BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION fail_checkout_test();
            """, connection)) await fault.ExecuteNonQueryAsync();
        try
        {
            var failed = await Send();
            Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        }
        finally
        {
            await using var cleanup = new NpgsqlCommand("DROP TRIGGER fail_checkout_test ON payments; DROP FUNCTION fail_checkout_test();", connection);
            await cleanup.ExecuteNonQueryAsync();
        }
        var retried = await Send(); Assert.Equal(HttpStatusCode.Created, retried.StatusCode);
        var replayed = await Send(); Assert.Equal(HttpStatusCode.Created, replayed.StatusCode);
        var first = await retried.Content.ReadFromJsonAsync<JsonElement>(); var second = await replayed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(first.GetProperty("id").GetGuid(), second.GetProperty("id").GetGuid());
        await using var count = new NpgsqlCommand("SELECT count(*) FROM payments WHERE booking_id_external=@id", connection);
        count.Parameters.AddWithValue("id", booking); Assert.Equal(1L, (long)(await count.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task Legacy_database_migration_recovers_payment_tenant_without_deleting_history()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()); await connection.OpenAsync();
        Guid original;
        await using (var read = new NpgsqlCommand("SELECT organization_id_external FROM payments WHERE id=@id", connection))
        {
            read.Parameters.AddWithValue("id", id); original = (Guid)(await read.ExecuteScalarAsync())!;
        }
        await using (var legacy = new NpgsqlCommand("ALTER TABLE payments DROP COLUMN organization_id_external", connection)) await legacy.ExecuteNonQueryAsync();
        using var sql = typeof(Infrastructure.SqlBaselineMigrator).Assembly.GetManifestResourceStream("sql.payment-organization")!;
        using var reader = new StreamReader(sql);
        await Infrastructure.SqlBaselineMigrator.ExecuteAsync(connection, await reader.ReadToEndAsync(), default);
        await using var verify = new NpgsqlCommand("SELECT organization_id_external FROM payments WHERE id=@id", connection);
        verify.Parameters.AddWithValue("id", id); Assert.Equal(original, (Guid)(await verify.ExecuteScalarAsync())!);
        Assert.Equal("PROCESSING", await Status(id));
    }

    [Fact]
    public async Task SePay_mode_disables_legacy_simulator_and_refuses_checkout_without_credentials()
    {
        await using var factory = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => {
            services.RemoveAll<VnPayOptions>(); services.AddSingleton(new VnPayOptions { Enabled = false });
            services.RemoveAll<SePayOptions>(); services.AddSingleton(new SePayOptions());
        }));
        var client = factory.CreateClient(); var user = Guid.CreateVersion7();
        foreach (var provider in new[] { "VNPAY_SANDBOX", "SEPAY" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/bookings/{Guid.CreateVersion7()}/payments");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(user, ["CUSTOMER"]));
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
            request.Content = JsonContent.Create(new { provider, method = provider == "SEPAY" ? "BANK_TRANSFER" : "VNPAY_QR", returnUri = "https://blue.example.test/return" });
            var response = await client.SendAsync(request);
            Assert.Equal(provider == "SEPAY" ? HttpStatusCode.Conflict : HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task Checkout_is_signed_POST_for_server_amount_and_uses_only_configured_callback()
    {
        var payment = await Create(fixture.CreateClient());
        var action = payment.GetProperty("providerAction");
        Assert.Equal("FORM_POST", action.GetProperty("type").GetString());
        Assert.Equal("https://pay-sandbox.sepay.vn/v1/checkout/init", action.GetProperty("actionUrl").GetString());
        Assert.Equal("280000", action.GetProperty("order_amount").GetString());
        Assert.Equal("BANK_TRANSFER", action.GetProperty("payment_method").GetString());
        Assert.StartsWith("https://blue.example.test/payment/sepay/return?bookingId=", action.GetProperty("success_url").GetString());
        Assert.DoesNotContain("test-only-merchant-key", action.GetRawText());
        var fields = action.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!);
        Assert.Equal(Application.SePayCheckout.Sign(fields, "test-only-merchant-key"), fields["signature"]);
        Assert.Equal("PROCESSING", await Status(payment.GetProperty("id").GetGuid()));
    }

    [Fact]
    public async Task Paid_IPN_commits_payment_settlement_receipt_and_events_once_even_when_concurrent()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        var notification = Notification(payment, Guid.NewGuid().ToString());
        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ =>
        {
            var started = Stopwatch.GetTimestamp();
            var result = await Ipn(client, notification);
            return (result.StatusCode, Elapsed: Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }));
        Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.StatusCode));
        output.WriteLine($"SePay IPN p95 ({results.Length} duplicate deliveries): {results.Max(result => result.Elapsed):F0} ms");
        Assert.Equal("SUCCEEDED", await Status(id));
        Assert.Equal(1, await Count("webhook_receipts", id));
        Assert.Equal(1, await Count("booking_settlements", id));
        Assert.Equal(1, await Count("outbox_messages", id, "PaymentSucceeded"));
        Assert.Equal(2, await Count("outbox_messages", id, "RevenueMovementRecorded"));
        Assert.Equal(1, await Count("outbox_messages", id, "PaymentBookingLinked"));
    }

    [Fact]
    public async Task Invalid_secret_or_wrong_amount_does_not_change_payment_or_emit_event()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Ipn(client, Notification(payment, "bad-auth"), "wrong")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Ipn(client, Notification(payment, "bad-amount", amount: 1))).StatusCode);
        Assert.Equal("PROCESSING", await Status(id));
        Assert.Equal(0, await Count("outbox_messages", id));
        Assert.Equal(0, await Count("webhook_receipts", id));
    }

    [Fact]
    public async Task Transaction_cannot_be_reused_to_pay_a_second_order()
    {
        var client = fixture.CreateClient(); var first = await Create(client); var second = await Create(client);
        var txn = Guid.NewGuid().ToString();
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(first, txn))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Ipn(client, Notification(second, txn))).StatusCode);
        Assert.Equal("PROCESSING", await Status(second.GetProperty("id").GetGuid()));
    }

    [Fact]
    public async Task Late_payment_is_captured_but_queues_real_refund_without_issuing_success_event()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        await using (var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand("UPDATE payments SET created_at = NOW() - INTERVAL '2 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE id = @id", connection);
            command.Parameters.AddWithValue("id", id); await command.ExecuteNonQueryAsync();
        }
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(payment, Guid.NewGuid().ToString()))).StatusCode);
        Assert.Equal("REFUND_PENDING", await Status(id));
        Assert.Equal(1, await Count("refunds", id));
        Assert.Equal(0, await Count("outbox_messages", id, "PaymentSucceeded"));
    }

    [Fact]
    public async Task Void_after_capture_never_downgrades_paid_payment_or_reissues_tickets()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid(); var txn = Guid.NewGuid().ToString();
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(payment, txn))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(payment, txn, "TRANSACTION_VOID"))).StatusCode);
        Assert.Equal("SUCCEEDED", await Status(id)); Assert.Equal(1, await Count("outbox_messages", id, "PaymentSucceeded"));
        Assert.Equal(1, await Count("reconciliation_cases", id));
    }

    [Fact]
    public async Task Failed_attempt_can_retry_with_new_invoice_and_old_IPN_cannot_capture_new_attempt()
    {
        var client = fixture.CreateClient(); var user = Guid.CreateVersion7(); var payment = await Create(client, user);
        var txn = Guid.NewGuid().ToString();
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(payment, txn, "TRANSACTION_VOID"))).StatusCode);
        var bookingId = payment.GetProperty("bookingId").GetGuid();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/bookings/{bookingId}/payments");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(user, ["CUSTOMER"]));
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        request.Content = JsonContent.Create(new { provider = "SEPAY", method = "BANK_TRANSFER", returnUri = "https://blue.example.test/return" });
        var response = await client.SendAsync(request); Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var next = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(payment.GetProperty("id").GetGuid(), next.GetProperty("id").GetGuid());
        Assert.NotEqual(payment.GetProperty("providerAction").GetProperty("order_invoice_number").GetString(), next.GetProperty("providerAction").GetProperty("order_invoice_number").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, Notification(payment, txn))).StatusCode);
        Assert.Equal("REFUND_PENDING", await Status(payment.GetProperty("id").GetGuid()));
        Assert.Equal("PROCESSING", await Status(next.GetProperty("id").GetGuid()));
    }

    [Fact]
    public async Task Legacy_VNPay_callback_cannot_confirm_a_SePay_payment()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        var fields = new Dictionary<string, string> { ["vnp_TmnCode"] = "LOCALDEV", ["vnp_TxnRef"] = id.ToString(),
            ["vnp_Amount"] = "28000000", ["vnp_CurrCode"] = "VND", ["vnp_ResponseCode"] = "00", ["vnp_TransactionNo"] = Guid.NewGuid().ToString() };
        fields["vnp_SecureHash"] = Application.VnPayCheckout.Sign("local-dev-only-vnpay-hash-secret-32b", fields);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/integrations/payments/vnpay-sandbox/webhooks", fields)).StatusCode);
        Assert.Equal("PROCESSING", await Status(id)); Assert.Equal(0, await Count("outbox_messages", id));
    }

    [Theory]
    [InlineData("order", "order_currency", "USD")]
    [InlineData("order", "order_status", "PENDING")]
    [InlineData("transaction", "transaction_status", "DECLINED")]
    [InlineData("transaction", "transaction_type", "REFUND")]
    [InlineData("transaction", "transaction_amount", "1")]
    public async Task Authenticated_but_invalid_provider_state_is_rejected(string parent, string field, string value)
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        var payload = System.Text.Json.Nodes.JsonNode.Parse(JsonSerializer.Serialize(Notification(payment, Guid.NewGuid().ToString())))!;
        payload[parent]![field] = value;
        Assert.Equal(HttpStatusCode.BadRequest, (await Ipn(client, payload)).StatusCode);
        Assert.Equal("PROCESSING", await Status(id)); Assert.Equal(0, await Count("webhook_receipts", id));
    }

    [Fact]
    public async Task Database_failure_rolls_back_receipt_and_capture_so_same_IPN_can_be_retried()
    {
        var client = fixture.CreateClient(); var payment = await Create(client); var id = payment.GetProperty("id").GetGuid();
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString()); await connection.OpenAsync();
        await using (var install = new NpgsqlCommand($"""
            CREATE FUNCTION fail_sepay_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
              IF NEW.aggregate_id = '{id}' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER fail_sepay_outbox BEFORE INSERT ON outbox_messages FOR EACH ROW EXECUTE FUNCTION fail_sepay_outbox();
            """, connection)) await install.ExecuteNonQueryAsync();
        var payload = Notification(payment, Guid.NewGuid().ToString());
        try
        {
            var response = await Ipn(client, payload); Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            Assert.Equal("PROCESSING", await Status(id)); Assert.Equal(0, await Count("webhook_receipts", id));
        }
        finally
        {
            await using var remove = new NpgsqlCommand("DROP TRIGGER fail_sepay_outbox ON outbox_messages; DROP FUNCTION fail_sepay_outbox();", connection);
            await remove.ExecuteNonQueryAsync();
        }
        Assert.Equal(HttpStatusCode.OK, (await Ipn(client, payload)).StatusCode);
        Assert.Equal("SUCCEEDED", await Status(id)); Assert.Equal(1, await Count("outbox_messages", id, "PaymentSucceeded"));
    }
}
