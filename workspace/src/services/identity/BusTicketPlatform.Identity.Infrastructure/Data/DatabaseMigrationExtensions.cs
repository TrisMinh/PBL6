using BusTicketPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BusTicketPlatform.Identity.Infrastructure.Data;

public static class DatabaseMigrationExtensions
{
    public static async Task MigrateIdentityDatabaseAsync(
        this IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var initialMigration = dbContext.GetService<IMigrationsAssembly>().Migrations.Keys
            .Single(migration => migration.EndsWith("_InitialIdentitySchema", StringComparison.Ordinal));
        await BaselineLegacyDatabaseAsync(dbContext, initialMigration, cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);
    }

    private static async Task BaselineLegacyDatabaseAsync(
        IdentityDbContext dbContext,
        string initialMigration,
        CancellationToken cancellationToken)
    {
        var historyRepository = dbContext.GetService<IHistoryRepository>();
        if (await historyRepository.ExistsAsync(cancellationToken) &&
            (await historyRepository.GetAppliedMigrationsAsync(cancellationToken))
            .Any(migration => migration.MigrationId == initialMigration))
        {
            return;
        }

        if (!await ExistsAsync(
                dbContext,
                "select to_regclass('public.users') is not null",
                cancellationToken))
        {
            return;
        }

        var hasLegacyHistory = await ExistsAsync(
            dbContext,
            "select to_regclass('public.schema_migrations') is not null",
            cancellationToken);
        var legacyMigrationApplied = hasLegacyHistory && await ExistsAsync(
            dbContext,
            "select exists (select 1 from schema_migrations where name = '001_initial.sql')",
            cancellationToken);
        if (!legacyMigrationApplied)
        {
            throw new InvalidOperationException(
                "Identity database contains tables but has no recognized migration history");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await dbContext.Database.ExecuteSqlRawAsync(
            historyRepository.GetCreateIfNotExistsScript(),
            cancellationToken);
        await dbContext.Database.ExecuteSqlRawAsync(
            historyRepository.GetInsertScript(new HistoryRow(initialMigration, "10.0.4")),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> ExistsAsync(
        IdentityDbContext dbContext,
        string commandText,
        CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        return (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
    }
}
