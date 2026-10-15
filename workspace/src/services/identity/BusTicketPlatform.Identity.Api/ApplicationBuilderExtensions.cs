using BusTicketPlatform.Identity.Api.ExceptionHandling;

namespace BusTicketPlatform.Identity.Api;

public static class ApplicationBuilderExtensions
{
    public static WebApplication UseIdentityApi(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            var correlationId = context.Request.Headers.TryGetValue("X-Correlation-ID", out var value) &&
                                Guid.TryParse(value, out var supplied)
                ? supplied
                : Guid.NewGuid();
            context.Items[ApiErrors.CorrelationKey] = correlationId;
            context.Response.Headers["X-Correlation-ID"] = correlationId.ToString();
            await next();
        });
        app.UseExceptionHandler();
        app.UseStatusCodePages(async statusContext =>
        {
            if (GlobalExceptionHandler.CanHandleStatusCode(statusContext.HttpContext.Response.StatusCode))
            {
                await GlobalExceptionHandler.WriteStatusAsync(
                    statusContext.HttpContext,
                    statusContext.HttpContext.RequestAborted);
            }
        });
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseRateLimiter();
        app.MapControllers();
        return app;
    }
}
