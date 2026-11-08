using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Payment.Application;

namespace BusTicketPlatform.Services.UnitTests;

public sealed class PaymentServiceTests
{
    [Fact]
    public async Task CreateRejectsUnsupportedProviderBeforeRepositoryAccess()
    {
        var service = new PaymentService(null!, null!, null!, new VnPayOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var request = new CreatePaymentRequest("UNSUPPORTED", "VNPAY_QR", "https://example.test/return");

        var result = await service.CreateAsync(actor, Guid.NewGuid(), request, Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }

    [Fact]
    public async Task CreateRejectsUnsupportedPaymentMethodBeforeRepositoryAccess()
    {
        var service = new PaymentService(null!, null!, null!, new VnPayOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var request = new CreatePaymentRequest("VNPAY_SANDBOX", "CASH", "https://example.test/return");

        var result = await service.CreateAsync(actor, Guid.NewGuid(), request, Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }
}
