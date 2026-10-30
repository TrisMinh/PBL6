using System.Net;
using BusTicketPlatform.Reporting.Application;
using BusTicketPlatform.Reporting.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
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

    [Fact]
    public async Task Refund_updates_booking_and_revenue_projections_once()
    {
        Assert.Equal(HttpStatusCode.OK, (await _fixture.CreateClient().GetAsync("/ready")).StatusCode);
        var bookingId = Guid.CreateVersion7();
        await using var scope = _fixture.Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ReportingService>();
        var paidFact = new BookingFact(
            bookingId, "BK" + bookingId.ToString("N")[..10], Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            "Da Nang - Hue", DateTimeOffset.UtcNow.AddDays(1), "PAID", "PREPAID", 1, 150000, 0, 0, 150000, "VND", DateTimeOffset.UtcNow);
        await service.IngestAsync(paidFact, default);
        await service.IngestRefundAsync(bookingId, 50000, default);
        await service.IngestAsync(paidFact with { Status = "CANCELLED", RefundedAmount = 0, NetAmount = 150000 }, default);

        await using var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        await using var booking = new NpgsqlCommand("SELECT refunded_amount, net_amount FROM booking_projections WHERE booking_id = @id", connection);
        booking.Parameters.AddWithValue("id", bookingId);
        await using var reader = await booking.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(50000, reader.GetInt64(0));
        Assert.Equal(100000, reader.GetInt64(1));
        await reader.CloseAsync();

        await using var revenue = new NpgsqlCommand("SELECT refund_amount, net_revenue FROM revenue_projections WHERE organization_id_external = (SELECT organization_id_external FROM booking_projections WHERE booking_id = @id)", connection);
        revenue.Parameters.AddWithValue("id", bookingId);
        await using var revenueReader = await revenue.ExecuteReaderAsync();
        Assert.True(await revenueReader.ReadAsync());
        Assert.Equal(50000, revenueReader.GetInt64(0));
        Assert.Equal(100000, revenueReader.GetInt64(1));
    }

    [Fact]
    public async Task Reversed_report_range_is_rejected_before_querying_data()
    {
        await using var scope = _fixture.Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ReportingService>();
        var actor = new Actor(Guid.CreateVersion7(), null, ["PLATFORM_FINANCE"]);
        var result = await service.RevenueAsync(actor, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(-1), "Asia/Ho_Chi_Minh", default);
        Assert.False(result.IsSuccess);
        Assert.Equal("VALIDATION_ERROR", result.Error!.Code);
        Assert.Equal(400, result.Error.StatusCode);
    }
}
