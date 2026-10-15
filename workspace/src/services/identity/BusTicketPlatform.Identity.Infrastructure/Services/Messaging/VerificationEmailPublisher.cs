using BusTicketPlatform.Identity.Application.Abstractions.Messaging;
using MassTransit;
using Microsoft.Extensions.Options;

namespace BusTicketPlatform.Identity.Infrastructure.Services.Messaging;

public sealed class VerificationEmailPublisher(
    ISendEndpointProvider sendEndpointProvider,
    IOptions<RabbitMqOptions> options) : IVerificationEmailPublisher
{
    public async Task PublishAsync(VerificationEmail message, CancellationToken cancellationToken)
    {
        var endpoint = await sendEndpointProvider.GetSendEndpoint(new Uri($"queue:{options.Value.Queue}"));
        await endpoint.Send(message, context => context.MessageId = message.ChallengeId, cancellationToken);
    }
}
