namespace BusTicketPlatform.Identity.Application.Abstractions.Persistence;

public interface IUserRoleRepository
{
    Task AssignCustomerAsync(Guid userId, CancellationToken cancellationToken);
}
