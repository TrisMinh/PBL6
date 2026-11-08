using BusTicketPlatform.Booking.Application;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.AuthBooking.UnitTests;

public sealed class AuthAndSeatHoldTests
{
    [Fact]
    public void PasswordPolicy_rejects_password_without_digit()
    {
        Assert.False(PasswordPolicy.IsSatisfied("OnlyLettersHere"));
    }

    [Fact]
    public async Task CreateHold_rejects_duplicate_seat_ids_before_repository_access()
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
    public async Task CreateHold_rejects_actor_without_customer_role()
    {
        var service = new BookingService(null!, null!, null!, new TicketQrOptions());
        var actor = new Actor(Guid.NewGuid(), null, ["DRIVER"]);
        var request = new CreateSeatHoldRequest([Guid.NewGuid()], Guid.NewGuid(), Guid.NewGuid());

        var result = await service.CreateHoldAsync(actor, Guid.NewGuid(), request, "unit-test-key", CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.AccessDenied, result.Error?.Code);
    }
}
