using BusTicketPlatform.Identity.Api.Contracts;
using BusTicketPlatform.Identity.Api.ExceptionHandling;
using BusTicketPlatform.Identity.Application.Features.Registration.Register.Commands;
using BusTicketPlatform.Identity.Application.Features.Registration.VerifyEmail.Commands;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BusTicketPlatform.Identity.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting("registration")]
public sealed class AuthController(ISender sender) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new RegisterCommand(request.FullName, request.Email, request.Phone, request.Password, request.ConfirmPassword),
            cancellationToken);
        return Accepted(new OperationAccepted(result.OperationId, "ACCEPTED", null));
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(VerificationRequest request, CancellationToken cancellationToken)
    {
        var correlationId = (Guid)HttpContext.Items[ApiErrors.CorrelationKey]!;
        var result = await sender.Send(
            new VerifyEmailCommand(request.ChallengeId, request.Code, correlationId),
            cancellationToken);
        if (result.Succeeded)
        {
            return Ok(new VerificationSucceeded("VERIFIED"));
        }

        throw new ApiException(StatusCodes.Status400BadRequest, result.ErrorCode!);
    }
}
