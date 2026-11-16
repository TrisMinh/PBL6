using System.Net;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class CustomerPreferencesTests(IdentityPostgresFixture fixture)
{
    [Fact]
    public async Task Preferences_persist_for_the_authenticated_owner_and_reject_active_content()
    {
        var client = fixture.CreateClient();
        var (email, phone, password, name) = IdentityTestData.NewUser();
        await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new { fullName = name, email, phone, password });
        var notice = fixture.Mailbox.LastFor(email)!;
        var verified = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code }, idempotency: IdentityTestData.IdempotencyKey());
        var bearer = verified.Body.GetProperty("accessToken").GetString();
        var denied = await client.GetAsync("/api/v1/users/me/preferences");
        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        var stored = await IdentityTestData.SendAsync(client, HttpMethod.Put, "/api/v1/users/me/preferences",
            new { province = "Đà Nẵng", avatar = "data:image/webp;base64,UklGRg==", journey = false, reminder = true, offers = true }, bearer: bearer);
        Assert.Equal(HttpStatusCode.OK, stored.Response.StatusCode);
        var loaded = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me/preferences", bearer: bearer);
        Assert.Equal("Đà Nẵng", loaded.Body.GetProperty("province").GetString());
        Assert.False(loaded.Body.GetProperty("journey").GetBoolean());
        Assert.True(loaded.Body.GetProperty("offers").GetBoolean());
        var invalid = await IdentityTestData.SendAsync(client, HttpMethod.Put, "/api/v1/users/me/preferences",
            new { province = "Đà Nẵng", avatar = "data:image/svg+xml,<svg onload='alert(1)'/>", journey = true, reminder = true, offers = false }, bearer: bearer);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.Response.StatusCode);
    }
}
