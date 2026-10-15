using BusTicketPlatform.Identity.Domain.Users;

namespace BusTicketPlatform.Identity.Application.Abstractions.Persistence;

public sealed record RegistrationMatch(Guid Id, string Status, string NormalizedEmail, string NormalizedPhone);

public interface IUserRepository
{
    Task<IReadOnlyList<RegistrationMatch>> FindRegistrationMatchesAsync(
        string normalizedEmail,
        string normalizedPhone,
        CancellationToken cancellationToken);

    void Add(UserAccount user);
    Task<UserAccount?> FindAsync(Guid userId, CancellationToken cancellationToken);
    Task ActivateAsync(Guid userId, DateTime verifiedAt, CancellationToken cancellationToken);
    Task<bool> SaveChangesAsync(CancellationToken cancellationToken);
}
