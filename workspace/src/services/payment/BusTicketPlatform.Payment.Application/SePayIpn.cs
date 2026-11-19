using System.Globalization;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Payment.Application;

public sealed record SePayNotification(string Invoice, string TransactionId, string Type, long Amount, string Currency);

public interface ISePayPaymentStore
{
    Task<bool> TryStartReconciliationAsync(Guid paymentId, CancellationToken cancellationToken);
    // Receipt, payment, settlement and downstream outbox event commit together.
    Task<Result> ApplySePayAsync(SePayNotification notification, string payloadHash, Guid correlationId, CancellationToken cancellationToken);
    Task<bool> QueueSePayRefundAsync(PaymentRecord payment, string reference, long amount, string reason, Guid requestedBy, CancellationToken cancellationToken);
}

public static class SePayIpn
{
    public static Result<SePayNotification> Parse(JsonElement body)
    {
        string Read(JsonElement obj, string name) => obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(name, out var value) ? value.ToString() : "";
        JsonElement Child(string name) => body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out var value) ? value : default;
        var order = Child("order");
        var transaction = Child("transaction");
        var type = Read(body, "notification_type");
        var invoice = Read(order, "order_invoice_number");
        var id = Read(transaction, "id");
        var currency = Read(order, "order_currency");
        if (type is not ("ORDER_PAID" or "TRANSACTION_VOID") || invoice.Length is < 1 or > 120
            || id.Length is < 1 or > 160 || currency != "VND"
            || !decimal.TryParse(Read(order, "order_amount"), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)
            || amount <= 0 || amount > long.MaxValue || amount != decimal.Truncate(amount)
            || !decimal.TryParse(Read(transaction, "transaction_amount"), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var txnAmount)
            || txnAmount != amount || Read(transaction, "transaction_currency") != currency
            || type == "ORDER_PAID" && (Read(order, "order_status") != "CAPTURED"
                || Read(transaction, "transaction_status") != "APPROVED" || Read(transaction, "transaction_type") != "PAYMENT"))
            return Result<SePayNotification>.Failure(PlatformErrors.WebhookInvalid());
        return Result<SePayNotification>.Success(new SePayNotification(invoice, id, type, (long)amount, currency));
    }
}
