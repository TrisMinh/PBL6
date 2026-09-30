using System.Net;
using BusTicketPlatform.Reporting.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace BusTicketPlatform.Reporting.Api.IntegrationTests;

[CollectionDefinition("ReportingApi", DisableParallelization = true)]
public sealed class ReportingApiCollection : ICollectionFixture<ReportingPostgresFixture>;

public sealed class ReportingPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder().WithImage("postgres:17-alpine").WithDatabase("reporting").WithUsername("platform").WithPassword("postgres").Build();
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public async Task InitializeAsync()
    {
        await Container.StartAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ReportingDatabaseOptions>();
                services.AddSingleton(new ReportingDatabaseOptions { ConnectionString = Container.GetConnectionString() });
            });
        });
    }
    public HttpClient CreateClient() => Factory.CreateClient();
    public async Task DisposeAsync() { await Factory.DisposeAsync(); await Container.DisposeAsync(); }
}

[Collection("ReportingApi")]
public sealed class ReportingHealthTests
{
    private readonly ReportingPostgresFixture _fixture;
    public ReportingHealthTests(ReportingPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Ready_succeeds() =>
        Assert.Equal(HttpStatusCode.OK, (await _fixture.CreateClient().GetAsync("/ready")).StatusCode);
}
