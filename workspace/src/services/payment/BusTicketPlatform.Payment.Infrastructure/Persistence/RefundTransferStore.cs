using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Payment.Application;
using Npgsql;

namespace BusTicketPlatform.Payment.Infrastructure.Persistence;

public sealed partial class PaymentRepository
{
    public async Task<Result<OperationAccepted>> RecordRefundTransferAsync(RefundRecord refund, Guid actorId,
        string reference, Guid correlationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var paymentLock = new NpgsqlCommand("SELECT provider FROM payments WHERE id = @id FOR UPDATE", connection, tx))
        {
            paymentLock.Parameters.AddWithValue("id", refund.PaymentId);
            if (await paymentLock.ExecuteScalarAsync(cancellationToken) is not "SEPAY")
                return Result<OperationAccepted>.Failure(PlatformErrors.PaymentNotAllowed());
        }

        // Read after acquiring the payment lock so concurrent requests see the committed refund state.
        await using (var current = new NpgsqlCommand("SELECT status, transfer_reference FROM refunds WHERE id = @id", connection, tx))
        {
            current.Parameters.AddWithValue("id", refund.Id);
            await using var row = await current.ExecuteReaderAsync(cancellationToken);
            if (!await row.ReadAsync(cancellationToken))
                return Result<OperationAccepted>.Failure(PlatformErrors.NotFound());
            if (row.GetString(0) == "SUCCEEDED" && !row.IsDBNull(1) && row.GetString(1) == reference)
                return Result<OperationAccepted>.Success(new OperationAccepted(refund.Id, "SUCCEEDED"));
            if (row.GetString(0) is not ("REQUESTED" or "PROCESSING"))
                return Result<OperationAccepted>.Failure(PlatformErrors.InvalidStateTransition());
        }

        await using (var complete = new NpgsqlCommand("""
            UPDATE refunds SET status = 'SUCCEEDED', transfer_reference = @reference, transfer_recorded_by = @actor,
              succeeded_at = NOW(), updated_at = NOW(), row_version = row_version + 1 WHERE id = @id
            """, connection, tx))
        {
            complete.Parameters.AddWithValue("id", refund.Id);
            complete.Parameters.AddWithValue("reference", reference);
            complete.Parameters.AddWithValue("actor", actorId);
            try { await complete.ExecuteNonQueryAsync(cancellationToken); }
            catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.UniqueViolation && error.ConstraintName == "uq_refunds_transfer_reference")
            {
                return Result<OperationAccepted>.Failure(PlatformErrors.ResourceConflict("This transfer reference is already recorded."));
            }
        }

        var message = new EventMessage(Guid.CreateVersion7(), "RefundSucceeded", 1, DateTimeOffset.UtcNow, "payment", correlationId,
            refund.Id, JsonSerializer.SerializeToElement(new { bookingId = refund.BookingId, paymentId = refund.PaymentId, refundId = refund.Id, refundReference = refund.RefundReference, amount = refund.Amount, currency = refund.Currency }));
        await using var record = new NpgsqlCommand("""
            WITH totals AS (
              SELECT p.id, p.amount - COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'SUCCEEDED'), 0)::bigint AS remaining,
                COUNT(*) FILTER (WHERE r.status IN ('REQUESTED', 'PROCESSING')) AS pending
              FROM payments p JOIN refunds r ON r.payment_id = p.id WHERE p.id = @payment GROUP BY p.id
            ), updated_payment AS (
              UPDATE payments p SET status = CASE WHEN t.remaining = 0 THEN 'REFUNDED'
                WHEN t.pending > 0 THEN 'REFUND_PENDING' ELSE 'PARTIALLY_REFUNDED' END,
                refunded_at = CASE WHEN t.remaining = 0 THEN NOW() END, updated_at = NOW(), row_version = row_version + 1
              FROM totals t WHERE p.id = t.id RETURNING p.id
            ), updated_settlement AS (
              UPDATE booking_settlements s SET gross_amount = t.remaining,
                commission_amount = ROUND(t.remaining * s.commission_rate)::bigint,
                operator_net = t.remaining - ROUND(t.remaining * s.commission_rate)::bigint,
                collection_status = CASE WHEN t.remaining = 0 THEN 'REFUNDED' ELSE 'COLLECTED' END,
                updated_at = NOW(), row_version = row_version + 1
              FROM totals t WHERE s.payment_id = t.id
            )
            INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
            SELECT @event, 'RefundSucceeded', 1, @id, CAST(@payload AS jsonb), @correlation, NOW(), 0 FROM updated_payment
            """, connection, tx);
        record.Parameters.AddWithValue("payment", refund.PaymentId);
        record.Parameters.AddWithValue("id", refund.Id);
        record.Parameters.AddWithValue("event", message.EventId);
        record.Parameters.AddWithValue("payload", JsonSerializer.Serialize(message, EventMessageJson.Options));
        record.Parameters.AddWithValue("correlation", correlationId);
        await record.ExecuteNonQueryAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(refund.Id, "SUCCEEDED"));
    }
}
