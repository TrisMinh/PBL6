using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using BusTicketPlatform.Identity.Application;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class PhoneVerificationTests(IdentityPostgresFixture fixture)
{
    [Fact]
    public async Task Customer_verifies_their_profile_number_and_refreshes_verified_claim()
    {
        var sms = new TestSms();
        await using var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Sms:Endpoint", "https://sms.example.test/send");
            builder.UseSetting("Sms:Token", "fixture-token");
            builder.ConfigureTestServices(services => services.AddHttpClient("phone-verification")
                .ConfigurePrimaryHttpMessageHandler(() => sms));
        });
        var client = factory.CreateClient();
        var (email, phone, password, fullName) = IdentityTestData.NewUser();
        var registered = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { email, phone, password, fullName });
        Assert.Equal(HttpStatusCode.Accepted, registered.Response.StatusCode);
        var mail = factory.Services.GetRequiredService<IChallengeMailbox>().LastFor(email)!;
        var signedIn = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = mail.ChallengeId, code = mail.Code }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, signedIn.Response.StatusCode);
        var bearer = signedIn.Body.GetProperty("accessToken").GetString();
        var refreshToken = signedIn.Body.GetProperty("refreshToken").GetString();

        const string endpoint = "/api/v1/users/me/phone-verification";
        var challenge = await IdentityTestData.SendAsync(client, HttpMethod.Post, endpoint, bearer: bearer);
        Assert.Equal(HttpStatusCode.Accepted, challenge.Response.StatusCode);
        Assert.Equal(phone, sms.Phone);
        var challengeId = challenge.Body.GetProperty("challengeId").GetGuid();
        var extra = await IdentityTestData.SendAsync(client, HttpMethod.Post, endpoint, bearer: bearer);
        Assert.Equal(HttpStatusCode.TooManyRequests, extra.Response.StatusCode);
        var wrongCode = sms.Code == "111111" ? "222222" : "111111";
        var denied = await IdentityTestData.SendAsync(client, HttpMethod.Post, endpoint + "/verify",
            new { challengeId, code = wrongCode }, bearer: bearer);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, denied.Response.StatusCode);
        var confirmed = await IdentityTestData.SendAsync(client, HttpMethod.Post, endpoint + "/verify",
            new { challengeId, code = sms.Code }, bearer: bearer);
        Assert.Equal(HttpStatusCode.NoContent, confirmed.Response.StatusCode);
        var replay = await IdentityTestData.SendAsync(client, HttpMethod.Post, endpoint + "/verify",
            new { challengeId, code = sms.Code }, bearer: bearer);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, replay.Response.StatusCode);
        var refreshed = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/refresh",
            new { refreshToken }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, refreshed.Response.StatusCode);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(refreshed.Body.GetProperty("accessToken").GetString()).Claims;
        Assert.Contains(claims, claim => claim.Type == "phone_key" && claim.Value.Length == 64);
        Assert.DoesNotContain(claims, claim => claim.Value == phone);
    }

    private sealed class TestSms : HttpMessageHandler
    {
        public string Phone { get; private set; } = "";
        public string Code { get; private set; } = "";

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
            Phone = body.RootElement.GetProperty("to").GetString()!;
            Code = Regex.Match(body.RootElement.GetProperty("message").GetString()!, "[0-9]{6}").Value;
            return new HttpResponseMessage(HttpStatusCode.Accepted);
        }
    }
}
