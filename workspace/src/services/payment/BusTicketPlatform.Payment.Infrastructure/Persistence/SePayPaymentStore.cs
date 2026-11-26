using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Payment.Application;
using Npgsql;

namespace BusTicketPlatform.Payment.Infrastructure.Persistence;

public sealed partial class PaymentRepository
{
    private const string ReconciliationStatuses =
        "provider = 'SEPAY' AND status IN ('PENDING', 'PROCESSING', 'FAILED', 'CANCELLED')";

    private const string AutomaticReconciliationDue = """
        created_at <= NOW() - INTERVAL '1 minute'
        AND expires_at > NOW() - INTERVAL '1 day'
        AND (sepay_checked_at IS NULL OR sepay_checked_at <= NOW() - CASE
            WHEN expires_at > NOW() THEN INTERVAL '1 minute'
            WHEN expires_at > NOW() - INTERVAL '1 hour' THEN INTERVAL '10 minutes'
            ELSE INTERVAL '4 hours'
        END)
        """;

    public async Task<IReadOnlyList<Guid>> FindDueReconciliationsAsync(int limit, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand($"""
            SELECT id FROM payments
            WHERE archived_at IS NULL AND {ReconciliationStatuses} AND {AutomaticReconciliationDue}
            ORDER BY (expires_at <= NOW()), CASE WHEN expires_at > NOW() THEN expires_at END,
                     COALESCE(sepay_checked_at, created_at), id
            LIMIT @limit
            """, connection);
        command.Parameters.AddWithValue("limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var due = new List<Guid>(limit);
        while (await reader.ReadAsync(cancellationToken))
            due.Add(reader.GetGuid(0));
        return due;
    }

    public async Task<bool> TryStartReconciliationAsync(Guid paymentId, bool automatic, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        var due = automatic ? AutomaticReconciliationDue
            : "(sepay_checked_at IS NULL OR sepay_checked_at <= NOW() - INTERVAL '30 seconds')";
        await using var command = new NpgsqlCommand($"""
            UPDATE payments SET sepay_checked_at = NOW()
            WHERE id = @id AND archived_at IS NULL AND {ReconciliationStatuses} AND {due};
            """, connection);
        command.Parameters.AddWithValue("id", paymentId);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<Result> ApplySePayAsync(SePayNotification notification, string payloadHash, Guid correlationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var transactionLock = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext(@txn))", connection, tx))
        {
            transactionLock.Parameters.AddWithValue("txn", notification.TransactionId);
            await transactionLock.ExecuteScalarAsync(cancellationToken);
        }
        PaymentRecord payment;
        await using (var command = new NpgsqlCommand("SELECT " + PaymentCols + " FROM payments WHERE logical_reference = @ref FOR UPDATE", connection, tx))
        {
            command.Parameters.AddWithValue("ref", notification.Invoice);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return Result.Failure(PlatformErrors.NotFound());
            payment = ReadPayment(reader);
        }
        if (payment.Provider != "SEPAY" || payment.Amount != notification.Amount || payment.Currency != notification.Currency)
            return Result.Failure(PlatformErrors.WebhookInvalid());

        await using (var bookingLock = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext(@booking))", connection, tx))
        {
            bookingLock.Parameters.AddWithValue("booking", payment.BookingId.ToString());
            await bookingLock.ExecuteScalarAsync(cancellationToken);
        }
        // A transaction cannot pay two invoices, even with a valid merchant IPN credential.
        await using (var bound = new NpgsqlCommand("SELECT 1 FROM webhook_receipts WHERE provider = 'SEPAY' AND provider_transaction_id = @txn AND payment_id <> @payment LIMIT 1", connection, tx))
        {
            bound.Parameters.AddWithValue("txn", notification.TransactionId);
            bound.Parameters.AddWithValue("payment", payment.Id);
            if (await bound.ExecuteScalarAsync(cancellationToken) is not null) return Result.Failure(PlatformErrors.WebhookInvalid());
        }
        var receipt = payment.LogicalReference + ":" + notification.Type + ":" + notification.TransactionId;
        // Bounded independent of provider identifier length (receipt column is varchar(180)).
        receipt = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(receipt)));
        await using (var insert = new NpgsqlCommand("""
            INSERT INTO webhook_receipts (id, provider, external_event_id, payment_id, provider_transaction_id, payload_hash, signature_valid,
                status, received_at, verified_at, processed_at)
            VALUES (gen_random_uuid(), 'SEPAY', @event, @payment, @txn, @hash, true, 'PROCESSED', NOW(), NOW(), NOW())
            ON CONFLICT (provider, external_event_id) DO NOTHING;
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("event", receipt);
            insert.Parameters.AddWithValue("payment", payment.Id);
            insert.Parameters.AddWithValue("txn", notification.TransactionId);
            insert.Parameters.AddWithValue("hash", payloadHash);
            if (await insert.ExecuteNonQueryAsync(cancellationToken) == 0) return Result.Success();
        }
        if (notification.Type == "ORDER_PAID" && payment.Status is not ("SUCCEEDED" or "REFUND_PENDING" or "PARTIALLY_REFUNDED" or "REFUNDED"))
        {
            await using var otherCapture = new NpgsqlCommand("SELECT 1 FROM payments WHERE booking_id_external = @booking AND id <> @id AND status IN ('SUCCEEDED','PARTIALLY_REFUNDED') LIMIT 1", connection, tx);
            otherCapture.Parameters.AddWithValue("booking", payment.BookingId);
            otherCapture.Parameters.AddWithValue("id", payment.Id);
            var alreadyCaptured = await otherCapture.ExecuteScalarAsync(cancellationToken) is not null;
            var late = alreadyCaptured || payment.ExpiresAt <= DateTimeOffset.UtcNow || payment.Status is "CANCELLED" or "FAILED";
            await using (var update = new NpgsqlCommand("""
                UPDATE payments SET status = @status, provider_order_reference = @txn, succeeded_at = NOW(),
                    failed_at = NULL, cancelled_at = NULL, updated_at = NOW(), row_version = row_version + 1 WHERE id = @id;
                INSERT INTO booking_settlements (id, booking_id_external, organization_id_external, payment_id, payment_channel,
                    gross_amount, commission_rate, commission_amount, operator_net, currency, collection_status, created_at, updated_at)
                SELECT gen_random_uuid(), p.booking_id_external, p.organization_id_external, p.id, 'PREPAID', p.amount,
                    q.commission_rate, ROUND(p.amount * q.commission_rate), p.amount - ROUND(p.amount * q.commission_rate),
                    p.currency, 'COLLECTED', NOW(), NOW() FROM payments p JOIN booking_quotes q ON q.booking_id = p.booking_id_external
                WHERE p.id = @id ON CONFLICT (booking_id_external) DO NOTHING;
                """, connection, tx))
            {
                update.Parameters.AddWithValue("id", payment.Id);
                update.Parameters.AddWithValue("txn", notification.TransactionId);
                update.Parameters.AddWithValue("status", late ? "REFUND_PENDING" : "SUCCEEDED");
                await update.ExecuteNonQueryAsync(cancellationToken);
            }
            if (late)
                await QueueRefund(connection, tx, payment, "LATE-" + payment.Id.ToString("N"), payment.Amount, "LATE_PROVIDER_SUCCESS", Guid.Empty, cancellationToken);
            else
            {
                var message = new EventMessage(Guid.CreateVersion7(), "PaymentSucceeded", 1, DateTimeOffset.UtcNow, "payment", correlationId,
                    payment.Id, JsonSerializer.SerializeToElement(new { bookingId = payment.BookingId, paymentId = payment.Id, amount = payment.Amount, currency = payment.Currency }));
                await using var outbox = new NpgsqlCommand("""
                    INSERT INTO outbox_messages (id, message_type, schema_version, aggregate_id, payload, correlation_id, occurred_at, attempt_count)
                    VALUES (@id, 'PaymentSucceeded', 1, @aggregate, CAST(@payload AS jsonb), @correlation, NOW(), 0);
                    """, connection, tx);
                outbox.Parameters.AddWithValue("id", message.EventId);
                outbox.Parameters.AddWithValue("aggregate", payment.Id);
                outbox.Parameters.AddWithValue("correlation", correlationId);
                outbox.Parameters.AddWithValue("payload", JsonSerializer.Serialize(message, EventMessageJson.Options));
                await outbox.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        else if (notification.Type == "TRANSACTION_VOID" && payment.Status is "PENDING" or "PROCESSING")
        {
            await using var cancel = new NpgsqlCommand("UPDATE payments SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW(), row_version = row_version + 1 WHERE id = @id", connection, tx);
            cancel.Parameters.AddWithValue("id", payment.Id);
            await cancel.ExecuteNonQueryAsync(cancellationToken);
        }
        else
        {
            // A void after capture or a second capture needs operator reconciliation, never silently revoke issued tickets.
            await using var reconciliation = new NpgsqlCommand("""
                INSERT INTO reconciliation_cases (id, payment_id, provider, discrepancy_key, discrepancy_type, status, severity, details, opened_at)
                VALUES (gen_random_uuid(), @payment, 'SEPAY', @key, @type, 'OPEN', 'HIGH', CAST(@details AS jsonb), NOW())
                ON CONFLICT DO NOTHING;
                """, connection, tx);
            reconciliation.Parameters.AddWithValue("payment", payment.Id);
            reconciliation.Parameters.AddWithValue("key", receipt);
            reconciliation.Parameters.AddWithValue("type", notification.Type == "TRANSACTION_VOID" ? "VOID_AFTER_CAPTURE" : "ADDITIONAL_CAPTURE");
            reconciliation.Parameters.AddWithValue("details", JsonSerializer.Serialize(notification));
            await reconciliation.ExecuteNonQueryAsync(cancellationToken);
        }
        await tx.CommitAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<bool> QueueSePayRefundAsync(PaymentRecord payment, string reference, long amount, string reason, Guid requestedBy, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var locked = new NpgsqlCommand("SELECT id FROM payments WHERE id = @id AND archived_at IS NULL FOR UPDATE", connection, tx))
        {
            locked.Parameters.AddWithValue("id", payment.Id);
            if (await locked.ExecuteScalarAsync(cancellationToken) is null) return false;
        }
        var applied = await QueueRefund(connection, tx, payment, reference, amount, reason, requestedBy, cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return applied;
    }

    private static async Task<bool> QueueRefund(NpgsqlConnection connection, NpgsqlTransaction tx, PaymentRecord payment,
        string reference, long amount, string reason, Guid requestedBy, CancellationToken cancellationToken)
    {
        await using (var existing = new NpgsqlCommand("SELECT amount FROM refunds WHERE payment_id = @id AND refund_reference = @ref", connection, tx))
        {
            existing.Parameters.AddWithValue("id", payment.Id);
            existing.Parameters.AddWithValue("ref", reference);
            var value = await existing.ExecuteScalarAsync(cancellationToken);
            if (value is not null) return Convert.ToInt64(value) == amount;
        }
        await using var command = new NpgsqlCommand("""
            WITH inserted AS (INSERT INTO refunds (id, payment_id, booking_id_external, requested_by_external, refund_reference, amount, currency,
                reason_code, status, created_at, updated_at)
            SELECT gen_random_uuid(), @payment, @booking, @by, @reference, @amount, @currency, @reason, 'REQUESTED', NOW(), NOW()
            WHERE @amount > 0 AND @amount <= (SELECT amount FROM payments WHERE id = @payment) -
                COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = @payment AND status IN ('REQUESTED','PROCESSING','SUCCEEDED')), 0)
            ON CONFLICT (payment_id, refund_reference) DO NOTHING RETURNING id)
            UPDATE payments SET status = 'REFUND_PENDING', updated_at = NOW(), row_version = row_version + 1
            WHERE id = @payment AND status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUND_PENDING') AND EXISTS (SELECT 1 FROM inserted);
            """, connection, tx);
        command.Parameters.AddWithValue("payment", payment.Id);
        command.Parameters.AddWithValue("booking", payment.BookingId);
        command.Parameters.AddWithValue("by", requestedBy);
        command.Parameters.AddWithValue("reference", reference);
        command.Parameters.AddWithValue("amount", amount);
        command.Parameters.AddWithValue("currency", payment.Currency);
        command.Parameters.AddWithValue("reason", reason);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }
}
