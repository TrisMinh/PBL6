namespace BusTicketPlatform.BuildingBlocks.Errors;

public sealed record AppError(
    string Code,
    string Message,
    int StatusCode,
    IReadOnlyDictionary<string, object>? Details = null)
{
    public static AppError Validation(string message, IReadOnlyDictionary<string, object>? details = null) =>
        new(ErrorCodes.ValidationError, message, StatusCodes.BadRequest, details);

    public static AppError NotFound(string message) =>
        new(ErrorCodes.ResourceNotFound, message, StatusCodes.NotFound);

    public static AppError Internal(string correlationId) =>
        new(
            ErrorCodes.InternalError,
            "An unexpected error occurred.",
            StatusCodes.InternalServerError,
            new Dictionary<string, object> { ["correlationId"] = correlationId });
}

public static class StatusCodes
{
    public const int BadRequest = 400;
    public const int Unauthorized = 401;
    public const int Forbidden = 403;
    public const int NotFound = 404;
    public const int Conflict = 409;
    public const int Gone = 410;
    public const int Unprocessable = 422;
    public const int Locked = 423;
    public const int TooManyRequests = 429;
    public const int InternalServerError = 500;
    public const int ServiceUnavailable = 503;
}
