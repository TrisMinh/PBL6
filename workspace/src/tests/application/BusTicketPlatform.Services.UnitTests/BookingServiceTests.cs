using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Errors;

namespace BusTicketPlatform.Services.UnitTests;

public sealed class BookingServiceTests
{
    [Fact]
    public async Task CreateHoldRejectsDuplicateSeatIdsBeforeRepositoryAccess()
    {
        var service = new BookingService(null!, null!, null!, new TicketQrOptions());
        var seatId = Guid.NewGuid();
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var request = new CreateSeatHoldRequest([seatId, seatId], Guid.NewGuid(), Guid.NewGuid());

        var result = await service.CreateHoldAsync(actor, Guid.NewGuid(), request, "unit-test-key", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }

    [Fact]
    public async Task CreateHoldRejectsActorWithoutCustomerRole()
    {
        var service = new BookingService(null!, null!, null!, new TicketQrOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["DRIVER"]);
        var request = new CreateSeatHoldRequest([Guid.NewGuid()], Guid.NewGuid(), Guid.NewGuid());

        var result = await service.CreateHoldAsync(actor, Guid.NewGuid(), request, "unit-test-key", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.AccessDenied, result.Error?.Code);
    }

    [Fact]
    public async Task CreateHoldRejectsRequestWithoutSeatsBeforeRepositoryAccess()
    {
        var service = new BookingService(null!, null!, null!, new TicketQrOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var request = new CreateSeatHoldRequest([], Guid.NewGuid(), Guid.NewGuid());

        var result = await service.CreateHoldAsync(actor, Guid.NewGuid(), request, "unit-test-key", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }

    [Fact]
    public async Task CreateHoldRejectsSamePickupAndDropoffStopsBeforeRepositoryAccess()
    {
        var service = new BookingService(null!, null!, null!, new TicketQrOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var stopId = Guid.NewGuid();
        var request = new CreateSeatHoldRequest([Guid.NewGuid()], stopId, stopId);

        var result = await service.CreateHoldAsync(actor, Guid.NewGuid(), request, "unit-test-key", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }
}
