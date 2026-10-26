namespace BusTicketPlatform.Identity.Api.ExceptionHandling;

public sealed class ApiException(int statusCode, string errorCode, string? publicMessage = null)
    : Exception(publicMessage ?? errorCode)
{
    public int StatusCode { get; } = statusCode;
    public string ErrorCode { get; } = errorCode;
    public string? PublicMessage { get; } = publicMessage;
}
