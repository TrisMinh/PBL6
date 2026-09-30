using BusTicketPlatform.Identity.Application;
using Microsoft.AspNetCore.Mvc;

namespace BusTicketPlatform.Identity.Api;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/v1");
        var auth = api.MapGroup("/auth").AllowAnonymous();
        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/verify", VerifyAsync);
        auth.MapPost("/resend-verification", ResendAsync);
        auth.MapPost("/login", LoginAsync);
        auth.MapPost("/refresh", RefreshAsync);
        auth.MapPost("/logout", LogoutAsync).RequireAuthorization();
        auth.MapPost("/forgot-password", ForgotAsync);
        auth.MapPost("/reset-password", ResetAsync);

        var me = api.MapGroup("/users/me").RequireAuthorization();
        me.MapGet("/", GetMeAsync);
        me.MapPatch("/", UpdateMeAsync);

        var admin = api.MapGroup("/admin").RequireAuthorization();
        admin.MapGet("/users", ListUsersAsync);
        admin.MapGet("/users/{userId:guid}", GetUserAsync);
        admin.MapPatch("/users/{userId:guid}/status", ChangeStatusAsync);
        admin.MapPut("/users/{userId:guid}/roles", ReplaceRolesAsync);
        admin.MapGet("/organizations/{organizationId:guid}/members", ListMembersAsync);
        admin.MapPost("/organizations/{organizationId:guid}/members", AddMemberAsync);
        admin.MapPatch("/organizations/{organizationId:guid}/members/{membershipId:guid}", ChangeMemberAsync);
        return app;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest body,
        AuthService auth,
        HttpContext http)
    {
        var result = await auth.RegisterAsync(
            new RegisterCommand(body.FullName, body.Email, body.Phone, body.Password),
            http.CorrelationId(),
            http.RequestAborted);
        return result.ToHttp(http.CorrelationId(), StatusCodes.Status202Accepted);
    }

    private static Task<IResult> VerifyAsync(VerificationRequest body, AuthService auth, IIdempotencyStore store, HttpContext http) =>
        http.WithIdempotency(store, "verifyRegistration", body.ChallengeId.ToString(), HttpResults.HashPayload(body), async () =>
        {
            var result = await auth.VerifyAsync(new VerifyCommand(body.ChallengeId, body.Code), http.CorrelationId(), http.RequestAborted);
            return result.IsSuccess ? (200, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });

    private static Task<IResult> ResendAsync(EmailRequest body, AuthService auth, IIdempotencyStore store, HttpContext http) =>
        http.WithIdempotency(store, "resendVerification", body.Email, HttpResults.HashPayload(body), async () =>
        {
            var result = await auth.ResendVerificationAsync(new EmailCommand(body.Email), http.CorrelationId(), http.RequestAborted);
            return result.IsSuccess ? (202, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });

    private static async Task<IResult> LoginAsync(LoginRequest body, AuthService auth, HttpContext http)
    {
        var result = await auth.LoginAsync(new LoginCommand(body.Identifier, body.Password), http.CorrelationId(), http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static Task<IResult> RefreshAsync(RefreshRequest? body, AuthService auth, IIdempotencyStore store, HttpContext http)
    {
        var token = body?.RefreshToken;
        return http.WithIdempotency(store, "refreshSession", token ?? "cookie", HttpResults.HashPayload(token), async () =>
        {
            var result = await auth.RefreshAsync(token, http.CorrelationId(), http.RequestAborted);
            return result.IsSuccess ? (200, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });
    }

    private static Task<IResult> LogoutAsync(AuthService auth, IIdempotencyStore store, HttpContext http)
    {
        var userId = http.User.UserId();
        var sessionId = http.User.SessionId();
        if (userId is null || sessionId is null)
        {
            return Task.FromResult(HttpResults.Error(IdentityErrors.AuthenticationRequired(), http.CorrelationId()));
        }

        return http.WithIdempotency(store, "logout", sessionId.Value.ToString(), sessionId.Value.ToString(), async () =>
        {
            var result = await auth.LogoutAsync(sessionId.Value, userId.Value, http.CorrelationId(), http.RequestAborted);
            return result.IsSuccess ? (204, (object?)null) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });
    }

    private static Task<IResult> ForgotAsync(EmailRequest body, AuthService auth, IIdempotencyStore store, HttpContext http) =>
        http.WithIdempotency(store, "forgotPassword", body.Email, HttpResults.HashPayload(body), async () =>
        {
            var result = await auth.ForgotPasswordAsync(new EmailCommand(body.Email), http.CorrelationId(), http.RequestAborted);
            return result.IsSuccess ? (202, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });

    private static Task<IResult> ResetAsync(ResetPasswordRequest body, AuthService auth, IIdempotencyStore store, HttpContext http) =>
        http.WithIdempotency(store, "resetPassword", body.ChallengeId.ToString(), HttpResults.HashPayload(body), async () =>
        {
            var result = await auth.ResetPasswordAsync(
                new ResetPasswordCommand(body.ChallengeId, body.Code, body.NewPassword),
                http.CorrelationId(),
                http.RequestAborted);
            return result.IsSuccess ? (204, (object?)null) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });

    private static async Task<IResult> GetMeAsync(ProfileService profiles, HttpContext http)
    {
        var userId = http.User.UserId();
        if (userId is null)
        {
            return HttpResults.Error(IdentityErrors.AuthenticationRequired(), http.CorrelationId());
        }

        var result = await profiles.GetAsync(userId.Value, http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static async Task<IResult> UpdateMeAsync(UpdateProfileRequest body, ProfileService profiles, HttpContext http)
    {
        var userId = http.User.UserId();
        if (userId is null)
        {
            return HttpResults.Error(IdentityErrors.AuthenticationRequired(), http.CorrelationId());
        }

        var result = await profiles.UpdateAsync(
            new UpdateProfileCommand(userId.Value, body.FullName, body.Email, body.Phone, body.ExpectedVersion),
            http.CorrelationId(),
            http.RequestAborted);
        if (!result.IsSuccess)
        {
            return HttpResults.Error(result.Error!, http.CorrelationId());
        }

        return result.Value.Accepted
            ? Results.Json(new AcceptedResponse(userId.Value, "ACCEPTED"), statusCode: StatusCodes.Status202Accepted)
            : Results.Json(result.Value.Profile);
    }

    private static async Task<IResult> ListUsersAsync(AdminIdentityService admin, HttpContext http, [FromQuery] int page = 0, [FromQuery] int size = 20)
    {
        if (!http.User.IsPlatformAdmin())
        {
            return HttpResults.Error(IdentityErrors.AccessDenied(), http.CorrelationId());
        }

        var result = await admin.ListUsersAsync(page, size, http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static async Task<IResult> GetUserAsync(Guid userId, AdminIdentityService admin, HttpContext http)
    {
        if (!http.User.IsPlatformAdmin())
        {
            return HttpResults.Error(IdentityErrors.AccessDenied(), http.CorrelationId());
        }

        var result = await admin.GetUserAsync(userId, http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static async Task<IResult> ChangeStatusAsync(Guid userId, VersionedStatusRequest body, AdminIdentityService admin, HttpContext http)
    {
        if (!TryAdmin(http, out var actorId, out var denied))
        {
            return denied!;
        }

        var result = await admin.ChangeStatusAsync(
            new ChangeStatusCommand(actorId, userId, body.Status, body.Reason, body.ExpectedVersion),
            http.CorrelationId(),
            http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static async Task<IResult> ReplaceRolesAsync(Guid userId, ReplaceRolesRequest body, AdminIdentityService admin, HttpContext http)
    {
        if (!TryAdmin(http, out var actorId, out var denied))
        {
            return denied!;
        }

        var result = await admin.ReplaceRolesAsync(
            new ReplaceRolesCommand(actorId, userId, body.RoleCodes, body.Reason, body.ExpectedVersion),
            http.CorrelationId(),
            http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static async Task<IResult> ListMembersAsync(Guid organizationId, AdminIdentityService admin, HttpContext http)
    {
        if (!http.User.IsPlatformAdmin())
        {
            return HttpResults.Error(IdentityErrors.AccessDenied(), http.CorrelationId());
        }

        var result = await admin.ListMembershipsAsync(organizationId, http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static Task<IResult> AddMemberAsync(Guid organizationId, MembershipInput body, AdminIdentityService admin, IIdempotencyStore store, HttpContext http)
    {
        if (!TryAdmin(http, out var actorId, out var denied))
        {
            return Task.FromResult(denied!);
        }

        return http.WithIdempotency(store, "addMembership", organizationId.ToString(), HttpResults.HashPayload(body), async () =>
        {
            var result = await admin.AddMembershipAsync(
                new MembershipCommand(actorId, organizationId, body.UserId, body.RoleCodes, body.Status, body.Reason, body.ExpectedVersion),
                http.CorrelationId(),
                http.RequestAborted);
            return result.IsSuccess ? (201, (object?)result.Value) : (result.Error!.StatusCode, ErrorEnvelopeBody(result.Error, http));
        });
    }

    private static async Task<IResult> ChangeMemberAsync(
        Guid organizationId,
        Guid membershipId,
        MembershipInput body,
        AdminIdentityService admin,
        HttpContext http)
    {
        if (!TryAdmin(http, out var actorId, out var denied))
        {
            return denied!;
        }

        var result = await admin.ChangeMembershipAsync(
            new MembershipCommand(actorId, organizationId, body.UserId, body.RoleCodes, body.Status, body.Reason, body.ExpectedVersion, membershipId),
            http.CorrelationId(),
            http.RequestAborted);
        return result.ToHttp(http.CorrelationId());
    }

    private static bool TryAdmin(HttpContext http, out Guid actorId, out IResult? error)
    {
        actorId = default;
        if (!http.User.IsPlatformAdmin())
        {
            error = HttpResults.Error(IdentityErrors.AccessDenied(), http.CorrelationId());
            return false;
        }

        var userId = http.User.UserId();
        if (userId is null)
        {
            error = HttpResults.Error(IdentityErrors.AuthenticationRequired(), http.CorrelationId());
            return false;
        }

        actorId = userId.Value;
        error = null;
        return true;
    }

    private static object ErrorEnvelopeBody(BusTicketPlatform.BuildingBlocks.Errors.AppError error, HttpContext http) =>
        BusTicketPlatform.BuildingBlocks.Http.ErrorEnvelope.From(error, http.CorrelationId());
}
