namespace BusTicketPlatform.BuildingBlocks.Idempotency;

public interface IIdempotencyStore
{
    Task<IdempotencyOutcome> BeginAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        string requestHash,
        CancellationToken cancellationToken);

    Task CompleteAsync(
        string actorScope,
        string operation,
        string targetReference,
        string key,
        int status,
        string responseSnapshot,
        CancellationToken cancellationToken);
}

public abstract record IdempotencyOutcome
{
    public sealed record Started : IdempotencyOutcome;
    public sealed record Completed(int Status, string Snapshot) : IdempotencyOutcome;
    public sealed record InProgress : IdempotencyOutcome;
    public sealed record Conflict : IdempotencyOutcome;
}
