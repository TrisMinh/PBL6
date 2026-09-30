using BusTicketPlatform.BuildingBlocks.Errors;

namespace BusTicketPlatform.Identity.Application;

public static class IdentityErrors
{
    public static AppError Validation(string message, string? field = null)
    {
        IReadOnlyDictionary<string, object>? details = field is null
            ? null
            : new Dictionary<string, object> { ["field"] = field };
        return AppError.Validation(message, details);
    }

    public static AppError IdentityAlreadyUsed() =>
        new(ErrorCodes.IdentityAlreadyUsed, "That identity cannot be used.", StatusCodes.Conflict);

    public static AppError VerificationInvalid() =>
        new(ErrorCodes.VerificationInvalid, "The verification challenge is not valid.", StatusCodes.Unprocessable);

    public static AppError VerificationExpired() =>
        new(ErrorCodes.VerificationExpired, "The verification challenge has expired.", StatusCodes.Gone);

    public static AppError PasswordPolicy() =>
        new(ErrorCodes.PasswordPolicyViolation, "The password does not meet the policy.", StatusCodes.Unprocessable);

    public static AppError AccountLocked() =>
        new(ErrorCodes.AccountLocked, "The account is temporarily locked.", StatusCodes.Locked);

    public static AppError InvalidCredentials() =>
        new(ErrorCodes.InvalidCredentials, "The credentials are not valid.", StatusCodes.Unauthorized);

    public static AppError SessionInvalid() =>
        new(ErrorCodes.SessionInvalid, "The session is not valid.", StatusCodes.Unauthorized);

    public static AppError SessionReuse() =>
        new(ErrorCodes.SessionReuseDetected, "The session was reused and has been revoked.", StatusCodes.Unauthorized);

    public static AppError AuthenticationRequired() =>
        new(ErrorCodes.AuthenticationRequired, "Authentication is required.", StatusCodes.Unauthorized);

    public static AppError AccessDenied() =>
        new(ErrorCodes.AccessDenied, "Access is denied.", StatusCodes.Forbidden);

    public static AppError IdempotencyKeyRequired() =>
        new(ErrorCodes.IdempotencyKeyRequired, "Idempotency-Key is required.", StatusCodes.BadRequest);

    public static AppError IdempotencyConflict() =>
        new(ErrorCodes.IdempotencyConflict, "The idempotency key was reused with a different payload.", StatusCodes.Conflict);

    public static AppError IdempotencyInProgress() =>
        new(ErrorCodes.IdempotencyInProgress, "The original request is still in progress.", StatusCodes.Conflict);

    public static AppError VersionConflict() =>
        new(ErrorCodes.VersionConflict, "The resource version does not match.", StatusCodes.Conflict);

    public static AppError NotFound() => AppError.NotFound("The requested resource was not found.");
}
