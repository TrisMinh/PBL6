using System.Net;
using System.Net.Http.Headers;

namespace BusTicketPlatform.Reporting.Api.IntegrationTests;

[Collection("ReportingApi")]
[Trait("Category", "SecurityAudit")]
public sealed class SecurityAuditTests(ReportingPostgresFixture fixture)
{
    [Fact]
    public async Task Projection_write_route_is_not_exposed()
    {
        var client = fixture.CreateClient();
        var response = await client.PostAsync("/internal/projections/bookings", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Operator_without_organization_cannot_read_platform_reports()
    {
        var client = fixture.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/reports/bookings?from={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-1).ToString("O"))}&to={Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(4).ToString("O"))}&timezone=UTC");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestJwt.Mint(Guid.CreateVersion7(), ["OPERATOR_FINANCE"]));
        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"Tenantless operator returned {(int)response.StatusCode}: {body}");
    }

}
