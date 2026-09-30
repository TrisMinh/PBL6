using System.Net;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class SecurityAndAdminTests
{
    private readonly IdentityPostgresFixture _fixture;

    public SecurityAndAdminTests(IdentityPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Login_lockout_and_customer_cannot_call_admin()
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

        HttpStatusCode last = HttpStatusCode.OK;
        for (var i = 0; i < AuthService.LockoutThreshold; i++)
        {
            var failed = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new
            {
                identifier = email,
                password = "WrongPassword1"
            });
            last = failed.Response.StatusCode;
        }

        Assert.Equal(HttpStatusCode.Locked, last);

        var locked = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new
        {
            identifier = email,
            password
        });
        Assert.Equal(HttpStatusCode.Locked, locked.Response.StatusCode);
        Assert.Equal("ACCOUNT_LOCKED", locked.Body.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public async Task Admin_can_manage_user_status_but_not_self()
    {
        var client = _fixture.CreateClient();
        var customer = IdentityTestData.NewUser();
        await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = customer.Name,
            email = customer.Email,
            phone = customer.Phone,
            password = customer.Password
        });
        var notice = _fixture.Mailbox.LastFor(customer.Email)!;
        var verified = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code },
            idempotency: IdentityTestData.IdempotencyKey());
        var customerId = Guid.Parse(verified.Body.GetProperty("user").GetProperty("id").GetString()!);
        var customerAccess = verified.Body.GetProperty("accessToken").GetString();

        var forbidden = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/admin/users", bearer: customerAccess);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.Response.StatusCode);

        var admin = IdentityTestData.NewUser();
        var adminRegister = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = "Platform Admin",
            email = admin.Email,
            phone = admin.Phone,
            password = admin.Password
        });
        Assert.Equal(HttpStatusCode.Accepted, adminRegister.Response.StatusCode);
        var adminChallengeId = adminRegister.Body.GetProperty("operationId").GetGuid();
        var adminNotice = _fixture.Mailbox.ByChallenge(adminChallengeId) ?? _fixture.Mailbox.LastFor(admin.Email);
        Assert.NotNull(adminNotice);
        var adminVerified = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = adminNotice.ChallengeId, code = adminNotice.Code },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.True(adminVerified.Response.IsSuccessStatusCode, adminVerified.Body.ToString());
        var adminId = Guid.Parse(adminVerified.Body.GetProperty("user").GetProperty("id").GetString()!);

        var users = _fixture.Factory.Services.GetRequiredService<IIdentityRepository>();
        await users.AssignRoleAsync(adminId, RoleCodes.PlatformAdmin, null, CancellationToken.None);

        var adminLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new
        {
            identifier = admin.Email,
            password = admin.Password
        });
        Assert.True(adminLogin.Response.IsSuccessStatusCode, adminLogin.Body.ToString());
        var adminAccess = adminLogin.Body.GetProperty("accessToken").GetString();

        var listed = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/admin/users?page=0&size=20", bearer: adminAccess);
        Assert.Equal(HttpStatusCode.OK, listed.Response.StatusCode);

        var locked = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Patch,
            $"/api/v1/admin/users/{customerId}/status",
            new { status = "LOCKED", reason = "abuse review", expectedVersion = 1 },
            bearer: adminAccess);
        Assert.Equal(HttpStatusCode.OK, locked.Response.StatusCode);
        Assert.Equal("LOCKED", locked.Body.GetProperty("status").GetString());

        var self = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Patch,
            $"/api/v1/admin/users/{adminId}/status",
            new { status = "DISABLED", reason = "self disable", expectedVersion = 1 },
            bearer: adminAccess);
        Assert.Equal(HttpStatusCode.Forbidden, self.Response.StatusCode);

        var orgId = Guid.CreateVersion7();
        var member = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            $"/api/v1/admin/organizations/{orgId}/members",
            new
            {
                userId = customerId,
                roleCodes = new[] { "OPERATOR_ADMIN" },
                status = "ACTIVE",
                reason = "onboard operator",
                expectedVersion = 0
            },
            bearer: adminAccess,
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.Created, member.Response.StatusCode);
    }
}
