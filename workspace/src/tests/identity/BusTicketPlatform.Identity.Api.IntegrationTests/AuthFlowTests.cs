using System.Net;
using System.Net.Http.Json;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class AuthFlowTests
{
    private readonly IdentityPostgresFixture _fixture;

    public AuthFlowTests(IdentityPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Register_verify_login_refresh_logout_and_profile()
    {
        var client = _fixture.CreateClient();
        var (email, phone, password, name) = IdentityTestData.NewUser();

        var register = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email,
            phone,
            password
        });
        Assert.Equal(HttpStatusCode.Accepted, register.Response.StatusCode);

        var notice = _fixture.Mailbox.LastFor(email);
        Assert.NotNull(notice);

        var verified = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, verified.Response.StatusCode);
        var access = verified.Body.GetProperty("accessToken").GetString();
        var refresh = verified.Body.GetProperty("refreshToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(access));
        Assert.Equal("Bearer", verified.Body.GetProperty("tokenType").GetString());
        Assert.Equal(900, verified.Body.GetProperty("expiresIn").GetInt32());

        var me = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me", bearer: access);
        Assert.Equal(HttpStatusCode.OK, me.Response.StatusCode);
        Assert.Equal(email, me.Body.GetProperty("email").GetString());
        Assert.Contains(RoleCodes.Customer, me.Body.GetProperty("roles").EnumerateArray().Select(x => x.GetString()));

        var rotated = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/refresh",
            new { refreshToken = refresh },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, rotated.Response.StatusCode);
        var nextRefresh = rotated.Body.GetProperty("refreshToken").GetString();
        Assert.NotEqual(refresh, nextRefresh);

        var reuse = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/refresh",
            new { refreshToken = refresh },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.Response.StatusCode);
        Assert.Equal("SESSION_REUSE_DETECTED", reuse.Body.GetProperty("error").GetProperty("code").GetString());

        var familyDead = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/refresh",
            new { refreshToken = nextRefresh },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.Unauthorized, familyDead.Response.StatusCode);

        var login = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new
        {
            identifier = email,
            password
        });
        Assert.Equal(HttpStatusCode.OK, login.Response.StatusCode);
        var loginAccess = login.Body.GetProperty("accessToken").GetString();

        var patched = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Patch,
            "/api/v1/users/me",
            new { fullName = "Updated Customer", expectedVersion = 1 },
            bearer: loginAccess);
        Assert.Equal(HttpStatusCode.OK, patched.Response.StatusCode);
        Assert.Equal("Updated Customer", patched.Body.GetProperty("fullName").GetString());

        var logout = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/logout",
            bearer: loginAccess,
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.NoContent, logout.Response.StatusCode);
    }

    [Fact]
    public async Task Register_is_enumeration_safe_and_rejects_weak_passwords()
    {
        var client = _fixture.CreateClient();
        var (email, phone, password, name) = IdentityTestData.NewUser();
        var first = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email,
            phone,
            password
        });
        var duplicate = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email,
            phone,
            password
        });
        Assert.Equal(HttpStatusCode.Accepted, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, duplicate.Response.StatusCode);

        var weakUser = IdentityTestData.NewUser();
        var weak = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email = weakUser.Email,
            phone = weakUser.Phone,
            password = "short"
        });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, weak.Response.StatusCode);
        Assert.Equal("PASSWORD_POLICY_VIOLATION", weak.Body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Forgot_and_reset_password_revokes_old_password()
    {
        var client = _fixture.CreateClient();
        var (email, phone, password, name) = IdentityTestData.NewUser();
        await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new { fullName = name, email, phone, password });
        var notice = _fixture.Mailbox.LastFor(email)!;
        await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code },
            idempotency: IdentityTestData.IdempotencyKey());

        var unknown = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/forgot-password",
            new { email = "missing@example.test" },
            idempotency: IdentityTestData.IdempotencyKey());
        var known = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/forgot-password",
            new { email },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.Accepted, unknown.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, known.Response.StatusCode);

        var resetNotice = _fixture.Mailbox.LastFor(email)!;
        var reset = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/reset-password",
            new { challengeId = resetNotice.ChallengeId, code = resetNotice.Code, newPassword = "CorrectHorse2" },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.NoContent, reset.Response.StatusCode);

        var oldLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new { identifier = email, password });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.Response.StatusCode);

        var newLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new { identifier = email, password = "CorrectHorse2" });
        Assert.Equal(HttpStatusCode.OK, newLogin.Response.StatusCode);
    }
}
