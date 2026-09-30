using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;
using BusTicketPlatform.Identity.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[CollectionDefinition("IdentityApi", DisableParallelization = true)]
public sealed class IdentityApiCollection : ICollectionFixture<IdentityPostgresFixture>;

public sealed class IdentityPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("identity")
        .WithUsername("platform")
        .WithPassword("postgres")
        .Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        var connectionString = Container.GetConnectionString();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Smtp:Host", "");
            builder.UseSetting("Authentication:SigningKey", "local-dev-only-change-me-32bytes-min");
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IdentityDatabaseOptions>();
                services.AddSingleton(new IdentityDatabaseOptions { ConnectionString = connectionString });
            });
        });
    }

    public HttpClient CreateClient() => Factory.CreateClient();

    public IChallengeMailbox Mailbox => Factory.Services.GetRequiredService<IChallengeMailbox>();

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await Container.DisposeAsync();
    }
}

[Collection("IdentityApi")]
public sealed class IdentitySqlBaselineTests
{
    private readonly IdentityPostgresFixture _fixture;

    public IdentitySqlBaselineTests(IdentityPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Ready_succeeds_after_baseline_from_empty()
    {
        var client = _fixture.CreateClient();
        var first = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var second = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }
}

internal static class IdentityTestData
{
    internal static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    internal static (string Email, string Phone, string Password, string Name) NewUser()
    {
        var stamp = Guid.CreateVersion7().ToString("N");
        var phone = $"+849{System.Security.Cryptography.RandomNumberGenerator.GetInt32(10000000, 99999999)}";
        return ($"user.{stamp}@example.test", phone, "CorrectHorse1", "Seed Customer");
    }

    internal static string IdempotencyKey() => Guid.CreateVersion7().ToString("N");

    internal static async Task<(HttpResponseMessage Response, JsonElement Body)> SendAsync(
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
