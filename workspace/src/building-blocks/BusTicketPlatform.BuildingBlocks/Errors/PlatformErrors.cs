namespace BusTicketPlatform.BuildingBlocks.Errors;

public static class PlatformErrors
{
    public static AppError Validation(string message, string? field = null)
    {
        IReadOnlyDictionary<string, object>? details = field is null
            ? null
            : new Dictionary<string, object> { ["field"] = field };
        return AppError.Validation(message, details);
    }

    public static AppError AuthenticationRequired() =>
        new(ErrorCodes.AuthenticationRequired, "Authentication is required.", StatusCodes.Unauthorized);

    public static AppError AccessDenied() =>
        new(ErrorCodes.AccessDenied, "Access is denied.", StatusCodes.Forbidden);

    public static AppError NotFound() => AppError.NotFound("The requested resource was not found.");

    public static AppError VersionConflict() =>
        new(ErrorCodes.VersionConflict, "The resource version does not match.", StatusCodes.Conflict);

    public static AppError IdempotencyKeyRequired() =>
        new(ErrorCodes.IdempotencyKeyRequired, "Idempotency-Key is required.", StatusCodes.BadRequest);

    public static AppError IdempotencyConflict() =>
        new(ErrorCodes.IdempotencyConflict, "The idempotency key was reused with a different payload.", StatusCodes.Conflict);

    public static AppError IdempotencyInProgress() =>
        new(ErrorCodes.IdempotencyInProgress, "The original request is still in progress.", StatusCodes.Conflict);

    public static AppError ScheduleConflict() =>
        new(ErrorCodes.ScheduleConflict, "The bus or driver schedule overlaps another trip.", StatusCodes.Conflict);

    public static AppError TripNotSellable() =>
        new(ErrorCodes.TripNotSellable, "The trip is not sellable.", StatusCodes.Unprocessable);

    public static AppError SeatUnavailable() =>
        new(ErrorCodes.SeatUnavailable, "One or more seats are not available.", StatusCodes.Conflict);

    public static AppError SeatHoldExpired() =>
        new(ErrorCodes.SeatHoldExpired, "The seat hold has expired.", StatusCodes.Gone);

    public static AppError PayLaterNotAllowed() =>
        new(ErrorCodes.PayLaterNotAllowed, "Pay later is not allowed for this operator.", StatusCodes.Unprocessable);

    public static AppError PreviewStale() =>
        new(ErrorCodes.PreviewStale, "The cancellation preview is no longer valid.", StatusCodes.Gone);

    public static AppError TicketAlreadyCheckedIn() =>
        new(ErrorCodes.TicketAlreadyCheckedIn, "The ticket has already been checked in.", StatusCodes.Conflict);

    public static AppError PriceMismatch() =>
        new(ErrorCodes.PriceMismatch, "The expected total does not match the server price.", StatusCodes.Unprocessable);

    public static AppError PaymentNotAllowed() =>
        new(ErrorCodes.PaymentNotAllowed, "Payment is not allowed for this booking.", StatusCodes.Unprocessable);

    public static AppError WebhookInvalid() =>
        new(ErrorCodes.WebhookInvalid, "The webhook could not be verified.", StatusCodes.BadRequest);
}
