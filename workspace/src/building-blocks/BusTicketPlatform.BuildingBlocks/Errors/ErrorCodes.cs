namespace BusTicketPlatform.BuildingBlocks.Errors;

public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string AuthenticationRequired = "AUTHENTICATION_REQUIRED";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string AccessDenied = "ACCESS_DENIED";
    public const string ResourceNotFound = "RESOURCE_NOT_FOUND";
    public const string RateLimited = "RATE_LIMITED";
    public const string UpstreamUnavailable = "UPSTREAM_UNAVAILABLE";
    public const string VersionConflict = "VERSION_CONFLICT";
    public const string InternalError = "INTERNAL_ERROR";
    public const string IdentityAlreadyUsed = "IDENTITY_ALREADY_USED";
    public const string VerificationInvalid = "VERIFICATION_INVALID";
    public const string VerificationExpired = "VERIFICATION_EXPIRED";
    public const string PasswordPolicyViolation = "PASSWORD_POLICY_VIOLATION";
    public const string AccountLocked = "ACCOUNT_LOCKED";
    public const string SessionInvalid = "SESSION_INVALID";
    public const string SessionReuseDetected = "SESSION_REUSE_DETECTED";
    public const string IdempotencyKeyRequired = "IDEMPOTENCY_KEY_REQUIRED";
    public const string IdempotencyConflict = "IDEMPOTENCY_CONFLICT";
    public const string IdempotencyInProgress = "IDEMPOTENCY_IN_PROGRESS";
    public const string ScheduleConflict = "SCHEDULE_CONFLICT";
    public const string TripNotSellable = "TRIP_NOT_SELLABLE";
    public const string SeatUnavailable = "SEAT_UNAVAILABLE";
    public const string SeatHoldExpired = "SEAT_HOLD_EXPIRED";
    public const string PayLaterNotAllowed = "PAY_LATER_NOT_ALLOWED";
    public const string PreviewStale = "PREVIEW_STALE";
    public const string TicketAlreadyCheckedIn = "TICKET_ALREADY_CHECKED_IN";
    public const string PriceMismatch = "PRICE_MISMATCH";
    public const string PaymentNotAllowed = "PAYMENT_NOT_ALLOWED";
    public const string WebhookInvalid = "WEBHOOK_INVALID";
}
