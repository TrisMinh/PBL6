using System.Net;
using BusTicketPlatform.BuildingBlocks.Correlation;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

public sealed class IdentityHealthTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public IdentityHealthTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/live")]
    [InlineData("/health")]
    [InlineData("/startup")]
    public async Task Process_health_does_not_require_database(string path)
    {
        var response = await _client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains(CorrelationDefaults.HeaderName));
    }

    [Fact]
    public async Task Ready_fails_when_database_is_not_configured()
    {
        var response = await _client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }
}
