using System.Net;
using Npgsql;
using System.Net.Http.Json;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;
using Microsoft.Extensions.DependencyInjection;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class AuthFlowTests
{
    private readonly IdentityPostgresFixture _fixture;

    public AuthFlowTests(IdentityPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task New_driver_signs_in_with_initial_password_and_changes_it_in_session()
    {
        var client = _fixture.CreateClient();
        var users = _fixture.Factory.Services.GetRequiredService<IIdentityRepository>();
        var hasher = _fixture.Factory.Services.GetRequiredService<IPasswordHasher>();
        var ct = CancellationToken.None;
        var manager = IdentityTestData.NewUser();
        var managerId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await users.InsertUserAsync(new UserRecord(
            managerId, manager.Name, manager.Email, manager.Email.ToUpperInvariant(), manager.Phone,
            manager.Phone, hasher.Hash(manager.Password), UserStatuses.Active, now, 0, null, 0, 0, now), ct);
        await users.InsertMembershipAsync(new MembershipRecord(
            Guid.NewGuid(), managerId, organizationId, "ACTIVE", 0, ["OPERATOR_ADMIN"]), ct);
        await users.AssignRoleAsync(managerId, "OPERATOR_ADMIN", organizationId, ct);
        var managerLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = manager.Email, password = manager.Password });
        Assert.Equal(HttpStatusCode.OK, managerLogin.Response.StatusCode);

        var driver = IdentityTestData.NewUser();
        var firstPassword = "Blue7-" + Guid.NewGuid().ToString("N");
        var managerToken = managerLogin.Body.GetProperty("accessToken").GetString();
        var staffInput = new { fullName = "New Driver", email = driver.Email, phone = "0" + driver.Phone[3..],
            role = "DRIVER", initialPassword = firstPassword };
        var created = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/operator/staff",
            staffInput, bearer: managerToken);
        Assert.Equal(HttpStatusCode.Created, created.Response.StatusCode);
        Assert.DoesNotContain(firstPassword, created.Body.ToString());
        var retry = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/operator/staff",
            staffInput, bearer: managerToken);
        Assert.Equal(HttpStatusCode.Created, retry.Response.StatusCode);
        Assert.Equal(created.Body.GetProperty("userId").GetGuid(), retry.Body.GetProperty("userId").GetGuid());
        var driverLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = driver.Email, password = firstPassword });
        Assert.Equal(HttpStatusCode.OK, driverLogin.Response.StatusCode);
        var user = await users.FindByNormalizedEmailAsync(driver.Email.ToUpperInvariant(), ct);
        Assert.NotNull(user);
        Assert.Equal(staffInput.phone, user.Phone);
        Assert.NotEqual(firstPassword, user.PasswordHash);
        var membership = Assert.Single(await users.GetMembershipsForUserAsync(user!.Id, ct));
        Assert.Equal(organizationId, membership.OrganizationId);
        Assert.Contains("DRIVER", membership.RoleCodes);
        var driverToken = driverLogin.Body.GetProperty("accessToken").GetString();
        var driverDirectory = await IdentityTestData.SendAsync(client, HttpMethod.Get,
            "/api/v1/operator/staff?driverDirectory=true", bearer: driverToken);
        Assert.Equal(HttpStatusCode.Forbidden, driverDirectory.Response.StatusCode);
        var wrongPassword = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/users/me/password",
            new { currentPassword = "Incorrect15", newPassword = driver.Password }, bearer: driverToken);
        Assert.Equal(HttpStatusCode.BadRequest, wrongPassword.Response.StatusCode);
        var changed = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/users/me/password",
            new { currentPassword = firstPassword, newPassword = driver.Password }, bearer: driverToken);
        Assert.Equal(HttpStatusCode.NoContent, changed.Response.StatusCode);
        var oldSession = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me", bearer: driverToken);
        Assert.Equal(HttpStatusCode.Unauthorized, oldSession.Response.StatusCode);
        var reuse = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/operator/staff",
            staffInput, bearer: managerToken);
        Assert.Equal(HttpStatusCode.Conflict, reuse.Response.StatusCode);
        var oldLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = driver.Email, password = firstPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.Response.StatusCode);
        var newLogin = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = driver.Email, password = driver.Password });
        Assert.Equal(HttpStatusCode.OK, newLogin.Response.StatusCode);
        var newDriverToken = newLogin.Body.GetProperty("accessToken").GetString();
        var reissuePath = $"/api/v1/operator/staff/{membership.Id}/driver-password";
        var forbidden = await IdentityTestData.SendAsync(client, HttpMethod.Post, reissuePath, bearer: newDriverToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.Response.StatusCode);
        var managerMembership = Assert.Single(await users.GetMembershipsForUserAsync(managerId, ct));
        var forbiddenManagerReset = await IdentityTestData.SendAsync(client, HttpMethod.Post,
            $"/api/v1/operator/staff/{managerMembership.Id}/driver-password", bearer: managerToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenManagerReset.Response.StatusCode);
        var unknownMembership = await IdentityTestData.SendAsync(client, HttpMethod.Post,
            $"/api/v1/operator/staff/{Guid.NewGuid()}/driver-password", bearer: managerToken);
        Assert.Equal(HttpStatusCode.NotFound, unknownMembership.Response.StatusCode);

        var reissued = await IdentityTestData.SendAsync(client, HttpMethod.Post, reissuePath, bearer: managerToken);
        Assert.Equal(HttpStatusCode.OK, reissued.Response.StatusCode);
        Assert.True(reissued.Response.Headers.CacheControl?.NoStore);
        Assert.Equal(driver.Email, reissued.Body.GetProperty("email").GetString());
        var reissuedPassword = reissued.Body.GetProperty("password").GetString()!;
        Assert.True(PasswordPolicy.IsSatisfied(reissuedPassword));
        var revokedDriver = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me", bearer: newDriverToken);
        Assert.Equal(HttpStatusCode.Unauthorized, revokedDriver.Response.StatusCode);
        var rejectedOldPassword = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = driver.Email, password = driver.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, rejectedOldPassword.Response.StatusCode);
        var loginWithReissued = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = driver.Email, password = reissuedPassword });
        Assert.Equal(HttpStatusCode.OK, loginWithReissued.Response.StatusCode);
    }

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
    [Trait("Category", "SecurityAudit")]
    public async Task Security_logged_out_access_token_cannot_read_profile()
    {
        var client = _fixture.CreateClient();
        var (email, phone, password, name) = IdentityTestData.NewUser();
        await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = name, email, phone, password });
        var notice = _fixture.Mailbox.LastFor(email)!;
        var verified = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, verified.Response.StatusCode);
        var access = verified.Body.GetProperty("accessToken").GetString();
        var logout = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/logout",
            bearer: access, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.NoContent, logout.Response.StatusCode);
        var profile = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me", bearer: access);
        Assert.Equal(HttpStatusCode.Unauthorized, profile.Response.StatusCode);
    }

    [Fact]
    public async Task Register_rejects_duplicate_active_identity_and_weak_passwords()
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
        var notice = _fixture.Mailbox.LastFor(email)!;
        var verified = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, verified.Response.StatusCode);

        var differentIdentity = IdentityTestData.NewUser();
        var duplicateEmail = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email,
            phone = differentIdentity.Phone,
            password
        });
        var duplicatePhone = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = name,
            email = differentIdentity.Email,
            phone,
            password
        });
        Assert.Equal(HttpStatusCode.Accepted, first.Response.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateEmail.Response.StatusCode);
        Assert.Equal("IDENTITY_ALREADY_USED", duplicateEmail.Body.GetProperty("error").GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, duplicatePhone.Response.StatusCode);
        Assert.Equal("IDENTITY_ALREADY_USED", duplicatePhone.Body.GetProperty("error").GetProperty("code").GetString());

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
    public async Task Expired_verification_challenge_is_rejected_and_account_stays_pending()
    {
        var client = _fixture.CreateClient();
        var pending = IdentityTestData.NewUser();
        var registered = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = pending.Name,
            email = pending.Email,
            phone = pending.Phone,
            password = pending.Password
        });
        Assert.Equal(HttpStatusCode.Accepted, registered.Response.StatusCode);
        var notice = _fixture.Mailbox.LastFor(pending.Email);
        Assert.NotNull(notice);

        await using (var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString()))
        {
            await connection.OpenAsync();
            await using var expire = new NpgsqlCommand(
                "UPDATE auth_challenges SET expires_at = created_at + INTERVAL '1 millisecond' WHERE id = @id",
                connection);
            expire.Parameters.AddWithValue("id", notice.ChallengeId);
            Assert.Equal(1, await expire.ExecuteNonQueryAsync());
        }

        var verified = await IdentityTestData.SendAsync(
            client,
            HttpMethod.Post,
            "/api/v1/auth/verify",
            new { challengeId = notice.ChallengeId, code = notice.Code },
            idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.Gone, verified.Response.StatusCode);
        Assert.Equal("VERIFICATION_EXPIRED", verified.Body.GetProperty("error").GetProperty("code").GetString());

        var login = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login", new
        {
            identifier = pending.Email,
            password = pending.Password
        });
        Assert.Equal(HttpStatusCode.Unauthorized, login.Response.StatusCode);
    }

    [Fact]
    public async Task Resend_and_forgot_password_are_rate_limited_per_identity()
    {
        var client = _fixture.CreateClient();
        var pending = IdentityTestData.NewUser();
        var registered = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register", new
        {
            fullName = pending.Name,
            email = pending.Email,
            phone = pending.Phone,
            password = pending.Password
        });
        Assert.Equal(HttpStatusCode.Accepted, registered.Response.StatusCode);

        HttpResponseMessage? resendResponse = null;
        System.Text.Json.JsonElement resendBody = default;
        for (var attempt = 1; attempt <= 6; attempt++)
        {
            var resend = await IdentityTestData.SendAsync(
                client,
                HttpMethod.Post,
                "/api/v1/auth/resend-verification",
                new { email = pending.Email },
                idempotency: IdentityTestData.IdempotencyKey());
            resendResponse = resend.Response;
            resendBody = resend.Body;
        }

        Assert.NotNull(resendResponse);
        Assert.Equal(HttpStatusCode.TooManyRequests, resendResponse.StatusCode);
        Assert.True(resendResponse.Headers.TryGetValues("Retry-After", out var resendRetry));
        Assert.Equal("900", Assert.Single(resendRetry));
        Assert.Equal("RATE_LIMITED", resendBody.GetProperty("error").GetProperty("code").GetString());

        var unknownEmail = $"missing.{Guid.CreateVersion7():N}@example.test";
        HttpResponseMessage? forgotResponse = null;
        System.Text.Json.JsonElement forgotBody = default;
        for (var attempt = 1; attempt <= 6; attempt++)
        {
            var forgot = await IdentityTestData.SendAsync(
                client,
                HttpMethod.Post,
                "/api/v1/auth/forgot-password",
                new { email = unknownEmail },
                idempotency: IdentityTestData.IdempotencyKey());
            forgotResponse = forgot.Response;
            forgotBody = forgot.Body;
        }

        Assert.NotNull(forgotResponse);
        Assert.Equal(HttpStatusCode.TooManyRequests, forgotResponse.StatusCode);
        Assert.True(forgotResponse.Headers.TryGetValues("Retry-After", out var forgotRetry));
        Assert.Equal("900", Assert.Single(forgotRetry));
        Assert.Equal("RATE_LIMITED", forgotBody.GetProperty("error").GetProperty("code").GetString());
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
