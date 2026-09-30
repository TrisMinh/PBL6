namespace BusTicketPlatform.BuildingBlocks.Errors;

public static class ErrorMapper
{
    public static AppError FromUnknown(Exception _, Guid correlationId)
    {
        return AppError.Internal(correlationId.ToString());
    }

    public static AppError FromStatus(int statusCode, Guid correlationId)
    {
        return statusCode switch
        {
            400 => AppError.Validation("The request is invalid."),
            401 => new AppError(ErrorCodes.AuthenticationRequired, "Authentication is required.", 401),
            403 => new AppError(ErrorCodes.AccessDenied, "Access is denied.", 403),
            404 => AppError.NotFound("The requested resource was not found."),
            429 => new AppError(ErrorCodes.RateLimited, "Too many requests.", 429),
            503 => new AppError(ErrorCodes.UpstreamUnavailable, "A required dependency is unavailable.", 503),
            _ => AppError.Internal(correlationId.ToString())
        };
    }
}
