using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BusTicketPlatform.Reporting.Application;

namespace BusTicketPlatform.Reporting.Api.IntegrationTests;

[Collection("ReportingApi")]
[Trait("Category", "SecurityAudit")]
public sealed class SecurityAuditTests(ReportingPostgresFixture fixture)
{
    [Fact]
    public async Task Anonymous_clients_cannot_inject_reporting_projections()
    {
        var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/internal/projections/bookings", Fact(Guid.CreateVersion7()));
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"Anonymous projection write returned {(int)response.StatusCode}");
    }

    [Fact]
    public async Task Operator_without_organization_cannot_read_platform_reports()
    {
        var client = fixture.CreateClient();
        // Fixtures enter through the current internal ingestion endpoint; databases are disposable.
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/internal/projections/bookings", Fact(Guid.CreateVersion7()))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/internal/projections/bookings", Fact(Guid.CreateVersion7()))).StatusCode);
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/reports/bookings?from={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-1).ToString("O"))}&to={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(4).ToString("O"))}&timezone=UTC");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(Guid.CreateVersion7(), ["OPERATOR_FINANCE"]));
        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"Tenantless operator returned {(int)response.StatusCode}: {body}");
    }

    private static BookingFact Fact(Guid organization) => new(Guid.CreateVersion7(), "AUD" + Guid.NewGuid().ToString("N")[..12], organization,
        Guid.CreateVersion7(), Guid.CreateVersion7(), "Audit route", DateTimeOffset.UtcNow.AddDays(1), "PAID",
        "PREPAID", 1, 150000, 0, 0, 150000, "VND", DateTimeOffset.UtcNow);
}
