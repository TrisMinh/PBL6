using BusTicketPlatform.Identity.Application.Abstractions.Persistence;
using BusTicketPlatform.Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(IdentityDbContext dbContext) : IUserRepository
{
    public async Task<IReadOnlyList<RegistrationMatch>> FindRegistrationMatchesAsync(
        string normalizedEmail,
        string normalizedPhone,
        CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .AsNoTracking()
            .Where(user => user.NormalizedEmail == normalizedEmail || user.NormalizedPhone == normalizedPhone)
            .Select(user => new RegistrationMatch(user.Id, user.Status, user.NormalizedEmail, user.NormalizedPhone))
            .ToListAsync(cancellationToken);
    }

    public void Add(UserAccount user) => dbContext.Users.Add(user);

    public Task<UserAccount?> FindAsync(Guid userId, CancellationToken cancellationToken) =>
        dbContext.Users
            .SingleOrDefaultAsync(user => user.Id == userId, cancellationToken);

    public async Task ActivateAsync(Guid userId, DateTime verifiedAt, CancellationToken cancellationToken)
    {
        var user = dbContext.Users.Local.SingleOrDefault(candidate => candidate.Id == userId)
            ?? await dbContext.Users.SingleAsync(candidate => candidate.Id == userId, cancellationToken);
        user.Activate(verifiedAt);
    }

    public async Task<bool> SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }
}
