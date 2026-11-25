using System.Net.Http.Headers;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace BusTicketPlatform.Reporting.Api;

public sealed class PowerBiEmbeddingOptions
{
    public bool Enabled { get; init; }
    public Guid TenantId { get; init; }
    public Guid ClientId { get; init; }
    public string? ClientSecret { get; init; }
    public Guid WorkspaceId { get; init; }
    public Guid ReportId { get; init; }
    public Guid DatasetId { get; init; }

    public bool IsConfigured => TenantId != Guid.Empty && ClientId != Guid.Empty &&
        !string.IsNullOrWhiteSpace(ClientSecret) && WorkspaceId != Guid.Empty &&
        ReportId != Guid.Empty && DatasetId != Guid.Empty;
}

public sealed record PowerBiEmbedSession(Guid ReportId, string EmbedUrl, string Token, DateTimeOffset Expiration);

public sealed class PowerBiEmbedding(IHttpClientFactory clients, IOptions<PowerBiEmbeddingOptions> options)
{
    public const string ClientName = "PowerBiEmbedding";
    private const string Api = "https://api.powerbi.com/v1.0/myorg";
    private const string Role = "BlueOperator";
    private readonly SemaphoreSlim tokenLock = new(1, 1);
    private string? accessToken;
    private DateTimeOffset refreshAccessTokenAt;

    public bool Enabled => options.Value.Enabled;

    public async Task<PowerBiEmbedSession> CreateSessionAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.IsConfigured || organizationId == Guid.Empty)
            throw new InvalidOperationException("Power BI configuration or organization is missing.");

        using var client = clients.CreateClient(ClientName);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", await GetAccessTokenAsync(client, settings, cancellationToken));

        var workspace = $"{Api}/groups/{settings.WorkspaceId:D}";
        var report = await client.GetFromJsonAsync<PowerBiReport>(
            $"{workspace}/reports/{settings.ReportId:D}", cancellationToken);
        var dataset = await client.GetFromJsonAsync<PowerBiDataset>(
            $"{workspace}/datasets/{settings.DatasetId:D}", cancellationToken);
        if (report?.Id != settings.ReportId || report.DatasetId != settings.DatasetId ||
            !Uri.TryCreate(report.EmbedUrl, UriKind.Absolute, out var embedUrl) ||
            embedUrl.Scheme != Uri.UriSchemeHttps || embedUrl.Host != "app.powerbi.com" ||
            !embedUrl.IsDefaultPort || embedUrl.UserInfo.Length != 0 || embedUrl.AbsolutePath != "/reportEmbed" ||
            dataset?.Id != settings.DatasetId || !dataset.IsEffectiveIdentityRolesRequired)
            throw new InvalidOperationException("The configured Power BI report must use the configured RLS model.");

        using var response = await client.PostAsJsonAsync($"{Api}/GenerateToken", new
        {
            datasets = new[] { new { id = settings.DatasetId } },
            reports = new[] { new { id = settings.ReportId, allowEdit = false } },
            identities = new[]
            {
                new { username = organizationId.ToString("D"), roles = new[] { Role }, datasets = new[] { settings.DatasetId } },
            },
            lifetimeInMinutes = 15,
        }, cancellationToken);
        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<PowerBiToken>(cancellationToken);
        if (string.IsNullOrWhiteSpace(token?.Token) || token.Expiration <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Power BI returned an unusable embed token.");

        return new PowerBiEmbedSession(settings.ReportId, embedUrl.AbsoluteUri, token.Token, token.Expiration);
    }

    private async Task<string> GetAccessTokenAsync(
        HttpClient client, PowerBiEmbeddingOptions settings, CancellationToken cancellationToken)
    {
        await tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (accessToken is not null && DateTimeOffset.UtcNow < refreshAccessTokenAt)
                return accessToken;

            using var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = settings.ClientId.ToString("D"),
                ["client_secret"] = settings.ClientSecret!,
                ["grant_type"] = "client_credentials",
                ["scope"] = "https://analysis.windows.net/powerbi/api/.default",
            });
            var login = $"https://login.microsoftonline.com/{settings.TenantId:D}/oauth2/v2.0/token";
            using var response = await client.PostAsync(login, form, cancellationToken);
            response.EnsureSuccessStatusCode();
            var token = await response.Content.ReadFromJsonAsync<EntraToken>(cancellationToken);
            if (string.IsNullOrWhiteSpace(token?.AccessToken) || token.ExpiresIn <= 0)
                throw new InvalidOperationException("Microsoft Entra returned an unusable access token.");

            refreshAccessTokenAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(0, token.ExpiresIn - 120));
            return accessToken = token.AccessToken;
        }
        finally
        {
            tokenLock.Release();
        }
    }

    private sealed record EntraToken(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
    private sealed record PowerBiReport(Guid Id, Guid DatasetId, string EmbedUrl);
    private sealed record PowerBiDataset(Guid Id, bool IsEffectiveIdentityRolesRequired);
    private sealed record PowerBiToken(string Token, DateTimeOffset Expiration);
}
