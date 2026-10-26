using BusTicketPlatform.Identity.Application.Abstractions.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Repositories;

public sealed class UserRoleRepository(IdentityDbContext dbContext) : IUserRoleRepository
{
    public async Task AssignCustomerAsync(Guid userId, CancellationToken cancellationToken)
    {
        var roleId = await dbContext.Roles
            .Where(role => role.Code == "CUSTOMER")
            .Select(role => role.Id)
            .SingleAsync(cancellationToken);
        dbContext.UserRoles.Add(new UserRole(Guid.NewGuid(), userId, roleId, DateTime.UtcNow));
    }
}
