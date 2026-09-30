using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BusTicketPlatform.Gateway.IntegrationTests;

public sealed class GatewayClientSurfaceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public GatewayClientSurfaceTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Cors_preflight_allows_browser_clients()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", "http://localhost:5173");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type,idempotency-key,x-correlation-id");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:5173", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        var allowed = string.Join(",", response.Headers.GetValues("Access-Control-Allow-Headers")).ToLowerInvariant();
        Assert.Contains("authorization", allowed);
        Assert.Contains("idempotency-key", allowed);
    }

    [Fact]
    public async Task OpenApi_contract_is_published_for_clients()
    {
        var response = await _client.GetAsync("/openapi.yaml");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("openapi: 3.1", body);
        Assert.Contains("/auth/login", body);
        Assert.Contains("/trips", body);
    }

    [Fact]
    public void Gateway_routes_cover_every_openapi_path()
    {
        var openApi = File.ReadAllText(Path.Combine(RepoRoot(), "docs", "contracts", "openapi", "platform-mvp.openapi.yaml"));
        var paths = Regex.Matches(openApi, @"^  (/[A-Za-z0-9_{}/-]+):", RegexOptions.Multiline)
            .Select(match => match.Groups[1].Value)
            .Where(path => !path.Contains("{$ref", StringComparison.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        Assert.True(paths.Length >= 60, $"expected MVP paths, found {paths.Length}");

        var settings = JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoRoot(), "workspace", "src", "gateway", "BusTicketPlatform.Gateway", "appsettings.json")));
        var templates = settings.RootElement
            .GetProperty("ReverseProxy")
            .GetProperty("Routes")
            .EnumerateObject()
            .Select(route => (
                Template: route.Value.GetProperty("Match").GetProperty("Path").GetString()!,
                Order: route.Value.TryGetProperty("Order", out var order) ? order.GetInt32() : 0))
            .OrderBy(route => route.Order)
            .ToArray();

        foreach (var path in paths)
        {
            var requestPath = path.StartsWith("/integrations/", StringComparison.Ordinal) ? path : "/api/v1" + path;
            var sample = Sample(requestPath);
            var match = templates.FirstOrDefault(route => Matches(route.Template, sample));
            Assert.False(string.IsNullOrEmpty(match.Template), $"No Gateway route for {path} (as {sample}).");
        }
    }

    [Fact]
    public void Seat_and_manifest_routes_beat_transport_catchall()
    {
        Assert.Equal("booking", ClusterFor("/api/v1/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/seats"));
        Assert.Equal("transport", ClusterFor("/api/v1/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        Assert.Equal("booking", ClusterFor("/api/v1/operator/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/manifest"));
        Assert.Equal("transport", ClusterFor("/api/v1/operator/trips"));
        Assert.Equal("payment", ClusterFor("/api/v1/bookings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/payments"));
        Assert.Equal("booking", ClusterFor("/api/v1/bookings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        Assert.Equal("identity", ClusterFor("/api/v1/admin/organizations/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/members"));
        Assert.Equal("transport", ClusterFor("/api/v1/admin/organizations"));
    }

    private static string ClusterFor(string path)
    {
        var settings = JsonDocument.Parse(File.ReadAllText(Path.Combine(RepoRoot(), "workspace", "src", "gateway", "BusTicketPlatform.Gateway", "appsettings.json")));
        var match = settings.RootElement
            .GetProperty("ReverseProxy")
            .GetProperty("Routes")
            .EnumerateObject()
            .Select(route => (
                Cluster: route.Value.GetProperty("ClusterId").GetString()!,
                Template: route.Value.GetProperty("Match").GetProperty("Path").GetString()!,
                Order: route.Value.TryGetProperty("Order", out var order) ? order.GetInt32() : 0))
            .OrderBy(route => route.Order)
            .First(route => Matches(route.Template, path));
        return match.Cluster;
    }

    private static string Sample(string template) =>
        Regex.Replace(template, "\\{[^}]+\\}", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static bool Matches(string template, string path)
    {
        var pattern = "^";
        for (var i = 0; i < template.Length; i++)
        {
            if (template[i] != '{')
            {
                pattern += Regex.Escape(template[i].ToString());
                continue;
            }

            var end = template.IndexOf('}', i);
            var name = template[(i + 1)..end];
            pattern += name.StartsWith("**", StringComparison.Ordinal) ? ".*" : "[^/]+";
            i = end;
        }

        pattern += "$";
        return Regex.IsMatch(path, pattern);
    }

    private static string RepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docs", "contracts", "openapi", "platform-mvp.openapi.yaml")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("repository root was not found.");
    }
}
