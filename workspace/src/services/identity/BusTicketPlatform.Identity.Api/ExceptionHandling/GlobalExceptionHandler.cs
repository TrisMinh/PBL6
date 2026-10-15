using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;

namespace BusTicketPlatform.Identity.Api.ExceptionHandling;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var error = Map(exception);
        if (error.StatusCode == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception with correlation ID {CorrelationId}",
                ApiErrors.GetCorrelationId(httpContext));
        }

        await WriteAsync(
            httpContext,
            error.StatusCode,
            error.Code,
            error.Message,
            cancellationToken);
        return true;
    }

    public static Task WriteStatusAsync(HttpContext context, CancellationToken cancellationToken)
    {
        var error = MapStatusCode(context.Response.StatusCode);
        return WriteAsync(context, error.StatusCode, error.Code, error.Message, cancellationToken);
    }

    public static bool CanHandleStatusCode(int statusCode) => statusCode is
        StatusCodes.Status400BadRequest or
        StatusCodes.Status401Unauthorized or
        StatusCodes.Status403Forbidden or
        StatusCodes.Status404NotFound or
        StatusCodes.Status409Conflict or
        StatusCodes.Status429TooManyRequests or
        StatusCodes.Status500InternalServerError;

    public static ErrorEnvelope CreateError(HttpContext context, string code, string message)
    {
        SetCorrelationHeader(context);
        return ApiErrors.Create(context, code, message);
    }

    private static ErrorDescriptor Map(Exception exception) => exception switch
    {
        ValidationException => MapStatusCode(StatusCodes.Status400BadRequest, "VALIDATION_ERROR"),
        BadHttpRequestException => MapStatusCode(StatusCodes.Status400BadRequest),
        UnauthorizedAccessException => MapStatusCode(StatusCodes.Status401Unauthorized),
        KeyNotFoundException => MapStatusCode(StatusCodes.Status404NotFound),
        ApiException apiException => MapStatusCode(
            apiException.StatusCode,
            apiException.ErrorCode,
            apiException.PublicMessage),
        _ => MapStatusCode(StatusCodes.Status500InternalServerError)
    };

    private static ErrorDescriptor MapStatusCode(
        int statusCode,
        string? errorCode = null,
        string? message = null) => statusCode switch
        {
            StatusCodes.Status400BadRequest => new(
                statusCode,
                errorCode ?? "BAD_REQUEST",
                message ?? VerificationMessage(errorCode) ?? "The request is invalid"),
            StatusCodes.Status401Unauthorized => new(
                statusCode,
                errorCode ?? "UNAUTHORIZED",
                message ?? "Authentication is required"),
            StatusCodes.Status403Forbidden => new(
                statusCode,
                errorCode ?? "FORBIDDEN",
                message ?? "You do not have permission to access this resource"),
            StatusCodes.Status404NotFound => new(
                statusCode,
                errorCode ?? "NOT_FOUND",
                message ?? "The requested resource was not found"),
            StatusCodes.Status409Conflict => new(
                statusCode,
                errorCode ?? "CONFLICT",
                message ?? "The request conflicts with the current resource state"),
            StatusCodes.Status429TooManyRequests => new(
                statusCode,
                errorCode ?? "RATE_LIMITED",
                message ?? "Too many requests"),
            _ => new(
                StatusCodes.Status500InternalServerError,
                "INTERNAL_ERROR",
                "An unexpected error occurred")
        };

    private static async Task WriteAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message,
        CancellationToken cancellationToken)
    {
        context.Response.StatusCode = statusCode;
        SetCorrelationHeader(context);
        await context.Response.WriteAsJsonAsync(
            ApiErrors.Create(context, code, message),
            cancellationToken);
    }

    private static void SetCorrelationHeader(HttpContext context)
    {
        context.Response.Headers["X-Correlation-ID"] = ApiErrors.GetCorrelationId(context).ToString();
    }

    private static string? VerificationMessage(string? errorCode) => errorCode switch
    {
        "VERIFICATION_EXPIRED" => "The verification challenge has expired",
        "VERIFICATION_INVALID" => "The verification challenge is invalid",
        _ => null
    };

    private sealed record ErrorDescriptor(int StatusCode, string Code, string Message);
}
