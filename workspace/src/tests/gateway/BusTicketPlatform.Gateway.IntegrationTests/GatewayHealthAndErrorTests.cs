using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Correlation;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BusTicketPlatform.Gateway.IntegrationTests;

public sealed class GatewayHealthAndErrorTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public GatewayHealthAndErrorTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/live")]
    [InlineData("/health")]
    [InlineData("/ready")]
    public async Task Liveness_is_ok_without_backends(string path)
    {
        var response = await _client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains(CorrelationDefaults.HeaderName));
    }

    [Fact]
    public async Task Missing_route_returns_error_envelope_with_generated_correlation()
    {
        var response = await _client.GetAsync("/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var envelope = await response.Content.ReadFromJsonAsync<Envelope>(Json);
        Assert.NotNull(envelope);
        Assert.Equal("RESOURCE_NOT_FOUND", envelope.Error.Code);
        Assert.NotEqual(Guid.Empty, envelope.Error.CorrelationId);
        Assert.Equal(
            envelope.Error.CorrelationId.ToString(),
            response.Headers.GetValues(CorrelationDefaults.HeaderName).Single());
    }

    [Fact]
    public async Task Incoming_correlation_id_is_echoed()
    {
        var correlationId = Guid.CreateVersion7();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/does-not-exist");
        request.Headers.Add(CorrelationDefaults.HeaderName, correlationId.ToString());

        var response = await _client.SendAsync(request);
        var envelope = await response.Content.ReadFromJsonAsync<Envelope>(Json);

        Assert.Equal(correlationId, envelope!.Error.CorrelationId);
        Assert.Equal(correlationId.ToString(), response.Headers.GetValues(CorrelationDefaults.HeaderName).Single());
    }

    private sealed record Envelope(ErrorBody Error);
    private sealed record ErrorBody(string Code, string Message, Guid CorrelationId);
}
