using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Notification.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Notification.Api.IntegrationTests;

[CollectionDefinition("NotificationApi", DisableParallelization = true)]
public sealed class NotificationApiCollection : ICollectionFixture<NotificationPostgresFixture>;

public sealed class NotificationPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder().WithImage("postgres:17-alpine").WithDatabase("notification").WithUsername("platform").WithPassword("postgres").Build();
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Authentication:SigningKey", TestJwt.SigningKey);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<NotificationDatabaseOptions>();
                services.AddSingleton(new NotificationDatabaseOptions { ConnectionString = Container.GetConnectionString() });
            });
        });
    }
    public HttpClient CreateClient() => Factory.CreateClient();
    public async Task DisposeAsync() { await Factory.DisposeAsync(); await Container.DisposeAsync(); }
}

[Collection("NotificationApi")]
public sealed class NotificationHealthTests
{
    private readonly NotificationPostgresFixture _fixture;
    public NotificationHealthTests(NotificationPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Ready_succeeds() =>
        Assert.Equal(HttpStatusCode.OK, (await _fixture.CreateClient().GetAsync("/ready")).StatusCode);

    [Fact]
    public async Task Customer_can_ingest_list_and_mark_read()
    {
        var client = _fixture.CreateClient();
        var user = Guid.CreateVersion7();
        var ingest = await client.PostAsJsonAsync("/internal/notifications", new
        {
            userId = user,
            type = "BOOKING_CREATED",
            title = "Booking created",
            body = "Your booking was created.",
            sourceMessageId = Guid.CreateVersion7().ToString("N"),
            referenceType = "booking",
            referenceId = Guid.CreateVersion7().ToString()
        });
        Assert.Equal(HttpStatusCode.NoContent, ingest.StatusCode);

        var token = TestJwt.Mint(user, ["CUSTOMER"]);
        using var listRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/notifications");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var list = await client.SendAsync(listRequest);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var page = await list.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(page.GetProperty("items").GetArrayLength() >= 1);
        var notificationId = page.GetProperty("items")[0].GetProperty("id").GetGuid();

        using var readRequest = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/notifications/{notificationId}/read");
        readRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var read = await client.SendAsync(readRequest);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        var body = await read.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("read").GetBoolean());
    }
}
