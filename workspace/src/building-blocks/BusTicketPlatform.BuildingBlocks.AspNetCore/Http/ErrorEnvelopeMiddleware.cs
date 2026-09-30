using System.Net.Mime;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Http;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Correlation;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BusTicketPlatform.BuildingBlocks.AspNetCore.Http;

public sealed class ErrorEnvelopeMiddleware(RequestDelegate next, ILogger<ErrorEnvelopeMiddleware> logger, IWebHostEnvironment environment)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);

            if (!context.Response.HasStarted && context.Response.StatusCode >= 400 && IsEmptyJsonResponse(context))
            {
                var correlationId = context.GetCorrelationId();
                var error = ErrorMapper.FromStatus(context.Response.StatusCode, correlationId);
                await WriteEnvelope(context, error, correlationId);
            }
        }
        catch (Exception exception)
        {
            if (context.Response.HasStarted)
            {
                throw;
            }

            logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            var correlationId = context.GetCorrelationId();
            var error = exception is Microsoft.AspNetCore.Http.BadHttpRequestException
                ? AppError.Validation("The request body is invalid.")
                : ErrorMapper.FromUnknown(exception, correlationId);
            if (environment.IsDevelopment())
            {
                var details = new Dictionary<string, object>(error.Details ?? new Dictionary<string, object>())
                {
                    ["exception"] = exception.GetType().Name,
                    ["detail"] = exception.Message
                };
                error = error with { Details = details };
            }

            await WriteEnvelope(context, error, correlationId);
        }
    }

    private static bool IsEmptyJsonResponse(HttpContext context)
    {
        return context.Response.ContentLength is null or 0
            && string.IsNullOrEmpty(context.Response.ContentType);
    }

    public static Task WriteEnvelope(HttpContext context, AppError error, Guid correlationId)
    {
        context.Response.Clear();
        context.Response.StatusCode = error.StatusCode;
        context.Response.ContentType = MediaTypeNames.Application.Json;
        var envelope = ErrorEnvelope.From(error, correlationId);
        return context.Response.WriteAsJsonAsync(envelope, JsonOptions);
    }
}
