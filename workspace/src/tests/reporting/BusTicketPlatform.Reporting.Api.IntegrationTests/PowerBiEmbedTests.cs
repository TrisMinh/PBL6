using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Reporting.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Reporting.Api.IntegrationTests;

[Collection("ReportingApi")]
public sealed class PowerBiEmbedTests(ReportingPostgresFixture fixture)
{
    private const string Path = "/api/v1/reports/power-bi/embed";

    [Fact]
    public async Task Issue_view_only_tokens_for_active_organization_and_reject_unscoped_access()
    {
        var upstream = new PowerBiUpstream();
        using var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("PowerBi:Enabled", "true");
            builder.UseSetting("PowerBi:TenantId", Guid.NewGuid().ToString());
            builder.UseSetting("PowerBi:ClientId", Guid.NewGuid().ToString());
            builder.UseSetting("PowerBi:ClientSecret", "test-only");
            builder.UseSetting("PowerBi:WorkspaceId", Guid.NewGuid().ToString());
            builder.UseSetting("PowerBi:ReportId", upstream.ReportId.ToString());
            builder.UseSetting("PowerBi:DatasetId", upstream.DatasetId.ToString());
            builder.ConfigureTestServices(services => services
                .AddHttpClient(PowerBiEmbedding.ClientName)
                .ConfigurePrimaryHttpMessageHandler(() => upstream));
        });
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync(Path, null)).StatusCode);

        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var user = Guid.NewGuid();
        void SignIn(Guid? organization, string? role) => client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwt.Mint(user, ["PLATFORM_FINANCE"], organization,
                role is null ? null : [role]));

        SignIn(null, null);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(Path, null)).StatusCode);
        SignIn(first, "OPERATOR_SCHEDULER");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(Path, null)).StatusCode);

        SignIn(first, "OPERATOR_FINANCE");
        using var response = await client.PostAsJsonAsync($"{Path}?organizationId={second}", new { organizationId = second });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var session = await response.Content.ReadFromJsonAsync<PowerBiEmbedSession>();
        Assert.Equal(upstream.ReportId, session!.ReportId);
        Assert.Equal("test-embed-token", session.Token);

        SignIn(second, "OPERATOR_ADMIN");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(Path, null)).StatusCode);
        Assert.Equal(new[] { first.ToString(), second.ToString() }, upstream.Identities);
        Assert.Equal(1, upstream.TokenRequests);

        upstream.RequiresRole = false;
        using var rejected = await client.PostAsync(Path, null);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, rejected.StatusCode);
        Assert.Equal(2, upstream.Identities.Count);
    }

    [Fact]
    public async Task Disabled_embedding_retains_existing_portal_fallback()
    {
        using var client = fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwt.Mint(Guid.NewGuid(), [], Guid.NewGuid(), ["OPERATOR_ADMIN"]));
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync(Path, null)).StatusCode);
    }

    private sealed class PowerBiUpstream : HttpMessageHandler
    {
        public Guid ReportId { get; } = Guid.NewGuid();
        public Guid DatasetId { get; } = Guid.NewGuid();
        public List<string> Identities { get; } = [];
        public int TokenRequests { get; private set; }
        public bool RequiresRole { get; set; } = true;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var uri = request.RequestUri!;
            if (uri.Host == "login.microsoftonline.com")
            {
                TokenRequests++;
                return Json(new { access_token = "test-entra-token", expires_in = 3600 });
            }

            Assert.Equal(new AuthenticationHeaderValue("Bearer", "test-entra-token"), request.Headers.Authorization);
            if (uri.AbsolutePath.EndsWith($"/reports/{ReportId}"))
                return Json(new { id = ReportId, datasetId = DatasetId, embedUrl = $"https://app.powerbi.com/reportEmbed?reportId={ReportId}" });
            if (uri.AbsolutePath.EndsWith($"/datasets/{DatasetId}"))
                return Json(new { id = DatasetId, isEffectiveIdentityRolesRequired = RequiresRole });

            Assert.EndsWith("/GenerateToken", uri.AbsolutePath);
            var body = await request.Content!.ReadFromJsonAsync<JsonElement>(cancellationToken);
            var report = body.GetProperty("reports").EnumerateArray().Single();
            Assert.False(report.GetProperty("allowEdit").GetBoolean());
            Assert.Equal(ReportId, report.GetProperty("id").GetGuid());
            var identity = body.GetProperty("identities").EnumerateArray().Single();
            Assert.Equal(DatasetId, identity.GetProperty("datasets").EnumerateArray().Single().GetGuid());
            Assert.Equal("BlueOperator", identity.GetProperty("roles").EnumerateArray().Single().GetString());
            Identities.Add(identity.GetProperty("username").GetString()!);
            return Json(new { token = "test-embed-token", expiration = DateTimeOffset.UtcNow.AddMinutes(15) });
        }

        private static HttpResponseMessage Json<T>(T body) => new(HttpStatusCode.OK) { Content = JsonContent.Create(body) };
    }
}
