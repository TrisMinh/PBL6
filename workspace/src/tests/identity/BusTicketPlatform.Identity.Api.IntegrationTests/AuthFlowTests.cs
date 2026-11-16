using System.Net;
using Npgsql;
using System.Net.Http.Json;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

[Collection("IdentityApi")]
public sealed class AuthFlowTests
{
    private readonly IdentityPostgresFixture _fixture;

    public AuthFlowTests(IdentityPostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Concurrent_pending_registrations_leave_one_claim_and_only_its_code_can_activate()
    {
        var client = _fixture.CreateClient(); var draft = IdentityTestData.NewUser();
        var attempts = Enumerable.Range(0, 4).Select(i => IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = "Concurrent " + i, email = draft.Email, phone = draft.Phone, password = draft.Password }));
        var responses = await Task.WhenAll(attempts);
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Accepted, response.Response.StatusCode));
        await using var connection = new NpgsqlConnection(_fixture.Container.GetConnectionString()); await connection.OpenAsync();
        await using var current = new NpgsqlCommand("""
            SELECT c.id FROM auth_challenges c JOIN users u ON u.id=c.user_id
            WHERE u.deleted_at IS NULL AND u.normalized_email=@email AND c.status='ACTIVE';
            """, connection);
        current.Parameters.AddWithValue("email", draft.Email.ToUpperInvariant());
        var challengeId = (Guid)(await current.ExecuteScalarAsync())!;
        await using var count = new NpgsqlCommand("SELECT count(*) FROM users WHERE normalized_email=@email AND deleted_at IS NULL", connection);
        count.Parameters.AddWithValue("email", draft.Email.ToUpperInvariant());
        Assert.Equal(1L, (long)(await count.ExecuteScalarAsync())!);
        // Verify all superseded IDs with any code; none may create a session.
        foreach (var response in responses.Where(r => r.Body.GetProperty("operationId").GetGuid() != challengeId))
        {
            var stale = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
                new { challengeId = response.Body.GetProperty("operationId").GetGuid(), code = "000000" }, idempotency: IdentityTestData.IdempotencyKey());
            Assert.Equal(HttpStatusCode.UnprocessableEntity, stale.Response.StatusCode);
        }
    }

    [Fact]
    public async Task Replacing_pending_registration_releases_both_conflicting_drafts_and_revokes_their_codes()
    {
        var client = _fixture.CreateClient(); var first = IdentityTestData.NewUser(); var second = IdentityTestData.NewUser();
        foreach (var draft in new[] { first, second })
        {
            var registered = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
                new { fullName = draft.Name, email = draft.Email, phone = draft.Phone, password = draft.Password });
            Assert.Equal(HttpStatusCode.Accepted, registered.Response.StatusCode);
        }
        var firstCode = _fixture.Mailbox.LastFor(first.Email)!; var secondCode = _fixture.Mailbox.LastFor(second.Email)!;
        var corrected = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = "Corrected Customer", email = first.Email, phone = second.Phone, password = "CorrectedPassword123" });
        Assert.Equal(HttpStatusCode.Accepted, corrected.Response.StatusCode);
        foreach (var old in new[] { firstCode, secondCode })
        {
            var stale = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
                new { challengeId = old.ChallengeId, code = old.Code }, idempotency: IdentityTestData.IdempotencyKey());
            Assert.Equal(HttpStatusCode.UnprocessableEntity, stale.Response.StatusCode);
        }
        var current = _fixture.Mailbox.LastFor(first.Email)!;
        var verified = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = current.ChallengeId, code = current.Code }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, verified.Response.StatusCode);
        var me = await IdentityTestData.SendAsync(client, HttpMethod.Get, "/api/v1/users/me", bearer: verified.Body.GetProperty("accessToken").GetString());
        Assert.Equal("Corrected Customer", me.Body.GetProperty("fullName").GetString());
        var login = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = first.Email, password = "CorrectedPassword123" });
        Assert.Equal(HttpStatusCode.OK, login.Response.StatusCode);
        // The old draft's other identifiers are no longer reserved.
        var released = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = first.Name, email = second.Email, phone = first.Phone, password = first.Password });
        Assert.Equal(HttpStatusCode.Accepted, released.Response.StatusCode);
    }

    [Fact]
    public async Task Same_pending_contact_details_use_latest_password_and_invalidate_old_verification()
    {
        var client = _fixture.CreateClient(); var draft = IdentityTestData.NewUser();
        await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = draft.Name, email = draft.Email, phone = draft.Phone, password = draft.Password });
        var old = _fixture.Mailbox.LastFor(draft.Email)!;
        var corrected = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/register",
            new { fullName = "Latest Name", email = draft.Email, phone = draft.Phone, password = "LatestPassword123" });
        Assert.Equal(HttpStatusCode.Accepted, corrected.Response.StatusCode);
        var stale = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = old.ChallengeId, code = old.Code }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, stale.Response.StatusCode);
        var current = _fixture.Mailbox.LastFor(draft.Email)!;
        var verified = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/verify",
            new { challengeId = current.ChallengeId, code = current.Code }, idempotency: IdentityTestData.IdempotencyKey());
        Assert.Equal(HttpStatusCode.OK, verified.Response.StatusCode);
        var oldPassword = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = draft.Email, password = draft.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, oldPassword.Response.StatusCode);
        var latest = await IdentityTestData.SendAsync(client, HttpMethod.Post, "/api/v1/auth/login",
            new { identifier = draft.Email, password = "LatestPassword123" });
        Assert.Equal(HttpStatusCode.OK, latest.Response.StatusCode);
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
