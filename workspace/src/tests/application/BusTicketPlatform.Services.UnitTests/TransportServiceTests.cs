using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.Transport.Application;

namespace BusTicketPlatform.Services.UnitTests;

public sealed class TransportServiceTests
{
    [Fact]
    public async Task CreateOrganizationRejectsActorWithoutPlatformAdminRole()
    {
        var service = new TransportService(null!, null!, null!);
        var actor = new Actor(Guid.NewGuid(), null, ["CUSTOMER"]);
        var input = new OrganizationInput("ORG", "Test Operator", "ops@example.test", "0900000000", false, 0);

        var result = await service.CreateOrganizationAsync(actor, input, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.AccessDenied, result.Error?.Code);
    }

    [Fact]
    public async Task CreateOrganizationRejectsBlankCodeBeforeRepositoryAccess()
    {
        var service = new TransportService(null!, null!, null!);
        var actor = new Actor(Guid.NewGuid(), null, ["PLATFORM_ADMIN"]);
        var input = new OrganizationInput("  ", "Test Operator", "ops@example.test", "0900000000", false, 0);

        var result = await service.CreateOrganizationAsync(actor, input, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error?.Code);
    }
}
