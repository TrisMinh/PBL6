using BusTicketPlatform.Payment.Application;
using Npgsql;

namespace BusTicketPlatform.Payment.Infrastructure.Persistence;

public sealed class PaymentRepository(PaymentDatabaseOptions options) : IPaymentRepository
{
    public async Task UpsertQuoteAsync(BookingQuote quote, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await EnsureQuotesAsync(connection, cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO booking_quotes (booking_id, customer_id, organization_id, amount, currency, payment_channel, commission_rate, expires_at)
            VALUES (@id, @customer, @org, @amount, @currency, @channel, @rate, @expires)
            ON CONFLICT (booking_id) DO UPDATE SET amount = EXCLUDED.amount, currency = EXCLUDED.currency,
              commission_rate = EXCLUDED.commission_rate, expires_at = EXCLUDED.expires_at;
            """, connection);
        command.Parameters.AddWithValue("id", quote.BookingId);
        command.Parameters.AddWithValue("customer", quote.CustomerId);
        command.Parameters.AddWithValue("org", quote.OrganizationId);
        command.Parameters.AddWithValue("amount", quote.Amount);
        command.Parameters.AddWithValue("currency", quote.Currency);
        command.Parameters.AddWithValue("channel", quote.PaymentChannel);
        command.Parameters.AddWithValue("rate", quote.CommissionRate);
        command.Parameters.AddWithValue("expires", (object?)quote.ExpiresAt?.UtcDateTime ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<BookingQuote?> GetQuoteAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await EnsureQuotesAsync(connection, cancellationToken);
        await using var command = new NpgsqlCommand("SELECT booking_id, customer_id, organization_id, amount, currency, payment_channel, commission_rate, expires_at FROM booking_quotes WHERE booking_id = @id;", connection);
        command.Parameters.AddWithValue("id", bookingId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new BookingQuote(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetInt64(3), reader.GetString(4), reader.GetString(5), reader.GetDecimal(6),
                reader.IsDBNull(7) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)))
            : null;
    }

    public Task<PaymentRecord?> GetByBookingAsync(Guid bookingId, CancellationToken cancellationToken) =>
        QueryPayment("SELECT " + PaymentCols + " FROM payments WHERE booking_id_external = @id", bookingId, cancellationToken);

    public Task<PaymentRecord?> GetAsync(Guid paymentId, CancellationToken cancellationToken) =>
        QueryPayment("SELECT " + PaymentCols + " FROM payments WHERE id = @id", paymentId, cancellationToken);

    public Task<PaymentRecord?> GetByReferenceAsync(string logicalReference, CancellationToken cancellationToken) =>
        QueryPayment("SELECT " + PaymentCols + " FROM payments WHERE logical_reference = @ref", Guid.Empty, cancellationToken, logicalReference);

    public async Task InsertPaymentAsync(PaymentRecord payment, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO payments (
              id, booking_id_external, customer_id_external, organization_id_external, provider, logical_reference, amount, currency, status, expires_at, created_at, updated_at)
            VALUES (@id, @booking, @customer, @org, @provider, @ref, @amount, @currency, @status, @expires, NOW(), NOW());
            """, connection);
        command.Parameters.AddWithValue("id", payment.Id);
        command.Parameters.AddWithValue("booking", payment.BookingId);
        command.Parameters.AddWithValue("customer", payment.CustomerId);
        command.Parameters.AddWithValue("org", payment.OrganizationId);
        command.Parameters.AddWithValue("provider", payment.Provider);
        command.Parameters.AddWithValue("ref", payment.LogicalReference);
        command.Parameters.AddWithValue("amount", payment.Amount);
        command.Parameters.AddWithValue("currency", payment.Currency);
        command.Parameters.AddWithValue("status", payment.Status);
        command.Parameters.AddWithValue("expires", payment.ExpiresAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdatePaymentAsync(PaymentRecord payment, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE payments SET
              status = @status,
              succeeded_at = CASE WHEN @status = 'SUCCEEDED' THEN COALESCE(succeeded_at, NOW()) ELSE succeeded_at END,
              failed_at = CASE WHEN @status = 'FAILED' THEN NOW() WHEN @status = 'SUCCEEDED' THEN NULL ELSE failed_at END,
              cancelled_at = CASE WHEN @status = 'CANCELLED' THEN NOW() WHEN @status = 'SUCCEEDED' THEN NULL ELSE cancelled_at END,
              refunded_at = CASE WHEN @status = 'REFUNDED' THEN NOW() ELSE refunded_at END,
              updated_at = NOW(), row_version = row_version + 1
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", payment.Id);
        command.Parameters.AddWithValue("status", payment.Status);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> TryInsertWebhookAsync(string provider, string eventId, string payloadHash, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = await OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("""
                INSERT INTO webhook_receipts (id, provider, external_event_id, payload_hash, status, received_at)
                VALUES (gen_random_uuid(), @provider, @event, @hash, 'RECEIVED', NOW());
                """, connection);
            command.Parameters.AddWithValue("provider", provider);
            command.Parameters.AddWithValue("event", eventId);
            command.Parameters.AddWithValue("hash", payloadHash);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return true;
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            return false;
        }
    }

    public async Task MarkWebhookProcessedAsync(string provider, string eventId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE webhook_receipts
            SET status = 'PROCESSED', verified_at = COALESCE(verified_at, NOW()), processed_at = NOW()
            WHERE provider = @provider AND external_event_id = @event;
            """, connection);
        command.Parameters.AddWithValue("provider", provider);
        command.Parameters.AddWithValue("event", eventId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PaymentRecord>> ListByBookingAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        var item = await GetByBookingAsync(bookingId, cancellationToken);
        return item is null ? [] : [item];
    }

    public Task<(IReadOnlyList<PaymentRecord> Items, long Total)> SearchPaymentsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken) =>
        SearchAsync(PaymentCols, "payments p", orgId, page, size, ReadPayment, cancellationToken);

    public async Task InsertRefundAsync(RefundRecord refund, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO refunds (
              id, payment_id, booking_id_external, requested_by_external, refund_reference, amount, currency, reason_code,
              status, created_at, updated_at, succeeded_at)
            VALUES (@id, @payment, @booking, @by, @ref, @amount, @currency, @reason, @status, NOW(), NOW(), NOW());
            """, connection);
        command.Parameters.AddWithValue("id", refund.Id);
        command.Parameters.AddWithValue("payment", refund.PaymentId);
        command.Parameters.AddWithValue("booking", refund.BookingId);
        command.Parameters.AddWithValue("by", refund.RequestedBy);
        command.Parameters.AddWithValue("ref", refund.RefundReference);
        command.Parameters.AddWithValue("amount", refund.Amount);
        command.Parameters.AddWithValue("currency", refund.Currency);
        command.Parameters.AddWithValue("reason", refund.Reason);
        command.Parameters.AddWithValue("status", refund.Status);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<RefundRecord?> GetRefundAsync(Guid refundId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT id, payment_id, booking_id_external, requested_by_external, refund_reference, amount, currency, reason_code, status FROM refunds WHERE id = @id;", connection);
        command.Parameters.AddWithValue("id", refundId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadRefund(reader) : null;
    }

    public async Task<RefundRecord?> GetRefundByReferenceAsync(Guid paymentId, string refundReference, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT id, payment_id, booking_id_external, requested_by_external, refund_reference, amount, currency, reason_code, status FROM refunds WHERE payment_id = @payment AND refund_reference = @ref;", connection);
        command.Parameters.AddWithValue("payment", paymentId);
        command.Parameters.AddWithValue("ref", refundReference);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadRefund(reader) : null;
    }

    public async Task<long> SumSucceededRefundsAsync(Guid paymentId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE payment_id = @payment AND status = 'SUCCEEDED';", connection);
        command.Parameters.AddWithValue("payment", paymentId);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
    }

    public async Task<bool> TryApplyRefundAsync(PaymentRecord payment, RefundRecord refund, decimal commissionRate, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var paymentLock = new NpgsqlCommand("SELECT status, amount, currency, booking_id_external FROM payments WHERE id = @id FOR UPDATE;", connection, transaction))
        {
            paymentLock.Parameters.AddWithValue("id", payment.Id);
            await using var reader = await paymentLock.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)
                || reader.GetString(0) is not ("SUCCEEDED" or "PARTIALLY_REFUNDED")
                || reader.GetInt64(1) != payment.Amount
                || !string.Equals(reader.GetString(2), refund.Currency, StringComparison.OrdinalIgnoreCase)
                || reader.GetGuid(3) != refund.BookingId)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }
        }

        long refunded;
        await using (var total = new NpgsqlCommand("SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE payment_id = @id AND status = 'SUCCEEDED';", connection, transaction))
        {
            total.Parameters.AddWithValue("id", payment.Id);
            refunded = Convert.ToInt64(await total.ExecuteScalarAsync(cancellationToken));
        }

        if (refund.Amount <= 0 || refunded + refund.Amount > payment.Amount)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        await using (var insert = new NpgsqlCommand("""
            INSERT INTO refunds (id, payment_id, booking_id_external, requested_by_external, refund_reference, amount, currency, reason_code,
              status, created_at, updated_at, succeeded_at)
            VALUES (@id, @payment, @booking, @by, @ref, @amount, @currency, @reason, 'SUCCEEDED', NOW(), NOW(), NOW());
            """, connection, transaction))
        {
            insert.Parameters.AddWithValue("id", refund.Id);
            insert.Parameters.AddWithValue("payment", refund.PaymentId);
            insert.Parameters.AddWithValue("booking", refund.BookingId);
            insert.Parameters.AddWithValue("by", refund.RequestedBy);
            insert.Parameters.AddWithValue("ref", refund.RefundReference);
            insert.Parameters.AddWithValue("amount", refund.Amount);
            insert.Parameters.AddWithValue("currency", refund.Currency);
            insert.Parameters.AddWithValue("reason", refund.Reason);
            try { await insert.ExecuteNonQueryAsync(cancellationToken); }
            catch (PostgresException exception) when (exception.SqlState == "23505")
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }
        }

        var remaining = payment.Amount - refunded - refund.Amount;
        var status = remaining == 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";
        await using (var updatePayment = new NpgsqlCommand("""
            UPDATE payments SET status = @status, refunded_at = CASE WHEN @status = 'REFUNDED' THEN NOW() ELSE NULL END,
              updated_at = NOW(), row_version = row_version + 1 WHERE id = @id;
            """, connection, transaction))
        {
            updatePayment.Parameters.AddWithValue("id", payment.Id);
            updatePayment.Parameters.AddWithValue("status", status);
            await updatePayment.ExecuteNonQueryAsync(cancellationToken);
        }

        var commission = (long)decimal.Round(remaining * commissionRate, 0, MidpointRounding.AwayFromZero);
        await using (var updateSettlement = new NpgsqlCommand("""
            UPDATE booking_settlements SET gross_amount = @remaining, commission_amount = @commission,
              operator_net = @remaining - @commission, collection_status = @status, updated_at = NOW(), row_version = row_version + 1
            WHERE payment_id = @payment;
            """, connection, transaction))
        {
            updateSettlement.Parameters.AddWithValue("payment", payment.Id);
            updateSettlement.Parameters.AddWithValue("remaining", remaining);
            updateSettlement.Parameters.AddWithValue("commission", commission);
            updateSettlement.Parameters.AddWithValue("status", remaining == 0 ? "REFUNDED" : "COLLECTED");
            await updateSettlement.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public Task<(IReadOnlyList<RefundRecord> Items, long Total)> SearchRefundsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken) =>
        SearchAsync("r.id, r.payment_id, r.booking_id_external, r.requested_by_external, r.refund_reference, r.amount, r.currency, r.reason_code, r.status", "refunds r JOIN payments p ON p.id = r.payment_id", orgId, page, size, ReadRefund, cancellationToken);

    public async Task InsertSettlementAsync(SettlementRecord settlement, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO booking_settlements (
              id, booking_id_external, organization_id_external, payment_id, payment_channel, gross_amount, commission_rate,
              commission_amount, operator_net, currency, collection_status, created_at, updated_at)
            VALUES (@id, @booking, @org, @payment, @channel, @gross, @rate, @commission, @net, @currency, @status, NOW(), NOW())
            ON CONFLICT (booking_id_external) DO NOTHING;
            """, connection);
        command.Parameters.AddWithValue("id", settlement.Id);
        command.Parameters.AddWithValue("booking", settlement.BookingId);
        command.Parameters.AddWithValue("org", settlement.OrganizationId);
        command.Parameters.AddWithValue("payment", (object?)settlement.PaymentId ?? DBNull.Value);
        command.Parameters.AddWithValue("channel", settlement.PaymentChannel);
        command.Parameters.AddWithValue("gross", settlement.Gross);
        command.Parameters.AddWithValue("rate", settlement.Rate);
        command.Parameters.AddWithValue("commission", settlement.Commission);
        command.Parameters.AddWithValue("net", settlement.Net);
        command.Parameters.AddWithValue("currency", settlement.Currency);
        command.Parameters.AddWithValue("status", settlement.Status);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public Task<(IReadOnlyList<SettlementRecord> Items, long Total)> ListSettlementsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken) =>
        SearchAsync("id, booking_id_external, organization_id_external, payment_id, payment_channel, gross_amount, commission_rate, commission_amount, operator_net, currency, collection_status", "booking_settlements s", orgId, page, size, ReadSettlement, cancellationToken);

    public async Task<PayoutRecord> InsertPayoutAsync(PayoutRecord payout, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO operator_payouts (
              id, organization_id_external, period_start, period_end, currency, payable_amount, status, created_at, updated_at)
            VALUES (@id, @org, @start, @end, @currency, @amount, @status, NOW(), NOW());
            """, connection);
        command.Parameters.AddWithValue("id", payout.Id);
        command.Parameters.AddWithValue("org", payout.OrganizationId);
        command.Parameters.AddWithValue("start", payout.PeriodStart);
        command.Parameters.AddWithValue("end", payout.PeriodEnd);
        command.Parameters.AddWithValue("currency", payout.Currency);
        command.Parameters.AddWithValue("amount", payout.PayableAmount);
        command.Parameters.AddWithValue("status", payout.Status);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return payout;
    }

    private const string PaymentCols = "id, booking_id_external, customer_id_external, organization_id_external, provider, logical_reference, amount, currency, status, expires_at, row_version";

    private async Task<PaymentRecord?> QueryPayment(string sql, Guid id, CancellationToken cancellationToken, string? reference = null)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("ref", (object?)reference ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadPayment(reader) : null;
    }

    private async Task<(IReadOnlyList<T> Items, long Total)> SearchAsync<T>(string cols, string from, Guid? orgId, int page, int size, Func<NpgsqlDataReader, T> map, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        var orgFilter = orgId is not null && from.Contains("booking_settlements", StringComparison.Ordinal)
            ? " WHERE organization_id_external = @org"
            : orgId is not null && from.Contains("payments p", StringComparison.Ordinal)
                ? " WHERE p.organization_id_external = @org"
            : "";

        await using var count = new NpgsqlCommand($"SELECT COUNT(*) FROM {from}{orgFilter}", connection);
        count.Parameters.AddWithValue("org", (object?)orgId ?? DBNull.Value);
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
        await using var select = new NpgsqlCommand($"SELECT {cols} FROM {from}{orgFilter} OFFSET @offset LIMIT @limit", connection);
        select.Parameters.AddWithValue("org", (object?)orgId ?? DBNull.Value);
        select.Parameters.AddWithValue("offset", page * Math.Max(size, 1));
        select.Parameters.AddWithValue("limit", size <= 0 ? 20 : size);
        await using var reader = await select.ExecuteReaderAsync(cancellationToken);
        var items = new List<T>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(map(reader));
        }

        return (items, total);
    }

    private static PaymentRecord ReadPayment(NpgsqlDataReader reader) =>
        new(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3), reader.GetString(4), reader.GetString(5), reader.GetInt64(6), reader.GetString(7), reader.GetString(8), new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(9), DateTimeKind.Utc)), reader.GetInt64(10), null);

    private static RefundRecord ReadRefund(NpgsqlDataReader reader) =>
        new(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3), reader.GetString(4), reader.GetInt64(5), reader.GetString(6), reader.GetString(7), reader.GetString(8));

    private static SettlementRecord ReadSettlement(NpgsqlDataReader reader) =>
        new(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.GetString(4), reader.GetInt64(5), reader.GetDecimal(6), reader.GetInt64(7), reader.GetInt64(8), reader.GetString(9), reader.GetString(10));

    private static async Task EnsureQuotesAsync(NpgsqlConnection connection, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS booking_quotes (
              booking_id uuid PRIMARY KEY,
              customer_id uuid NOT NULL,
              organization_id uuid NOT NULL,
              amount bigint NOT NULL,
              currency char(3) NOT NULL,
              payment_channel varchar(20) NOT NULL,
              commission_rate numeric(5,4) NOT NULL,
              expires_at timestamptz
            );
            ALTER TABLE booking_quotes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
            """, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
