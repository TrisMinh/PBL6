using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Payment.Application;

public sealed record Actor(Guid UserId, Guid? OrganizationId, IReadOnlyList<string> RoleCodes)
{
    public bool Has(params string[] roles) => roles.Any(RoleCodes.Contains);
}

public sealed record OperationAccepted(Guid OperationId, string Status, string? StatusUrl = null);
public sealed record CreatePaymentRequest(string Provider, string Method, string ReturnUri);
public sealed record PaymentDto(Guid Id, Guid BookingId, string Status, long Amount, string Currency, string Provider, IReadOnlyDictionary<string, string>? ProviderAction, string? StatusUrl, long RowVersion);
public sealed record PaymentPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<PaymentDto> Items);
public sealed record CreateRefundRequest(string RefundReference, Guid PaymentId, Guid BookingId, long Amount, string Currency, string Reason);
public sealed record RefundDto(Guid Id, string RefundReference, Guid PaymentId, Guid BookingId, long Amount, string Currency, string Status, string Reason);
public sealed record RefundPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<RefundDto> Items);
public sealed record BookingQuote(Guid BookingId, Guid CustomerId, Guid OrganizationId, long Amount, string Currency, string PaymentChannel, decimal CommissionRate);
public sealed record BookingSettlementDto(Guid Id, Guid BookingId, Guid OrganizationId, Guid? PaymentId, string PaymentChannel, long GrossAmount, decimal CommissionRate, long CommissionAmount, long OperatorNet, string Currency, string CollectionStatus);
public sealed record SettlementPageDto(int Page, int Size, long TotalElements, int TotalPages, IReadOnlyList<BookingSettlementDto> Items);
public sealed record CreatePayoutRequest(Guid OrganizationId, DateOnly PeriodStart, DateOnly PeriodEnd, string Currency, long PayableAmount);
public sealed record OperatorPayoutDto(Guid Id, Guid OrganizationId, DateOnly PeriodStart, DateOnly PeriodEnd, string Currency, long PayableAmount, string Status, DateTimeOffset? TransferredAt);

public interface IPaymentRepository
{
    Task UpsertQuoteAsync(BookingQuote quote, CancellationToken cancellationToken);
    Task<BookingQuote?> GetQuoteAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<PaymentRecord?> GetByBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<PaymentRecord?> GetAsync(Guid paymentId, CancellationToken cancellationToken);
    Task<PaymentRecord?> GetByReferenceAsync(string logicalReference, CancellationToken cancellationToken);
    Task InsertPaymentAsync(PaymentRecord payment, CancellationToken cancellationToken);
    Task UpdatePaymentAsync(PaymentRecord payment, CancellationToken cancellationToken);
    Task<bool> TryInsertWebhookAsync(string provider, string eventId, string payloadHash, CancellationToken cancellationToken);
    Task MarkWebhookProcessedAsync(string provider, string eventId, CancellationToken cancellationToken);
    Task<IReadOnlyList<PaymentRecord>> ListByBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<PaymentRecord> Items, long Total)> SearchPaymentsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken);
    Task InsertRefundAsync(RefundRecord refund, CancellationToken cancellationToken);
    Task<RefundRecord?> GetRefundAsync(Guid refundId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<RefundRecord> Items, long Total)> SearchRefundsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken);
    Task InsertSettlementAsync(SettlementRecord settlement, CancellationToken cancellationToken);
    Task<(IReadOnlyList<SettlementRecord> Items, long Total)> ListSettlementsAsync(Guid? orgId, int page, int size, CancellationToken cancellationToken);
    Task<PayoutRecord> InsertPayoutAsync(PayoutRecord payout, CancellationToken cancellationToken);
}

public sealed record PaymentRecord(Guid Id, Guid BookingId, Guid CustomerId, Guid OrganizationId, string Provider, string LogicalReference, long Amount, string Currency, string Status, DateTimeOffset ExpiresAt, long RowVersion, string? ReturnUri);
public sealed record RefundRecord(Guid Id, Guid PaymentId, Guid BookingId, Guid RequestedBy, string RefundReference, long Amount, string Currency, string Reason, string Status);
public sealed record SettlementRecord(Guid Id, Guid BookingId, Guid OrganizationId, Guid? PaymentId, string PaymentChannel, long Gross, decimal Rate, long Commission, long Net, string Currency, string Status);
public sealed record PayoutRecord(Guid Id, Guid OrganizationId, DateOnly PeriodStart, DateOnly PeriodEnd, string Currency, long PayableAmount, string Status, DateTimeOffset? TransferredAt);

public interface IPaymentEvents
{
    Task PaymentSucceededAsync(PaymentRecord payment, Guid correlationId, CancellationToken cancellationToken);
    Task RefundSucceededAsync(RefundRecord refund, Guid correlationId, CancellationToken cancellationToken);
}

public sealed class PaymentService(IPaymentRepository store, IPaymentEvents events, IIdGenerator ids, VnPayOptions vnpay)
{
    public Task RegisterQuoteAsync(BookingQuote quote, CancellationToken cancellationToken) =>
        store.UpsertQuoteAsync(quote, cancellationToken);

    public Task IngestBookingCreatedAsync(
        Guid bookingId,
        Guid customerId,
        Guid organizationId,
        long amount,
        string currency,
        string paymentChannel,
        decimal? commissionRate,
        CancellationToken cancellationToken)
    {
        if (bookingId == Guid.Empty || customerId == Guid.Empty || !string.Equals(paymentChannel, "PREPAID", StringComparison.OrdinalIgnoreCase) || amount <= 0)
        {
            return Task.CompletedTask;
        }

        return store.UpsertQuoteAsync(
            new BookingQuote(
                bookingId,
                customerId,
                organizationId,
                amount,
                string.IsNullOrWhiteSpace(currency) ? "VND" : currency,
                "PREPAID",
                commissionRate is > 0 and <= 1 ? commissionRate.Value : vnpay.DefaultCommissionRate),
            cancellationToken);
    }

    public async Task<Result<PaymentDto>> CreateAsync(Actor actor, Guid bookingId, CreatePaymentRequest request, Guid correlationId, CancellationToken cancellationToken)
    {
        if (request.Provider != "VNPAY_SANDBOX")
        {
            return Result<PaymentDto>.Failure(PlatformErrors.Validation("Unsupported provider.", "provider"));
        }

        if (!VnPayCheckout.IsSupportedMethod(request.Method))
        {
            return Result<PaymentDto>.Failure(PlatformErrors.Validation("Unsupported method.", "method"));
        }

        if (!Uri.TryCreate(request.ReturnUri, UriKind.Absolute, out _))
        {
            return Result<PaymentDto>.Failure(PlatformErrors.Validation("Return URI is invalid.", "returnUri"));
        }

        var quote = await WaitForQuoteAsync(bookingId, cancellationToken);
        if (quote is null || quote.CustomerId != actor.UserId)
        {
            return Result<PaymentDto>.Failure(PlatformErrors.NotFound());
        }

        if (quote.PaymentChannel != "PREPAID")
        {
            return Result<PaymentDto>.Failure(PlatformErrors.PaymentNotAllowed());
        }

        var existing = await store.GetByBookingAsync(bookingId, cancellationToken);
        if (existing is not null)
        {
            return Result<PaymentDto>.Success(Map(existing, request.ReturnUri));
        }

        var payment = new PaymentRecord(
            ids.NewUuidV7(),
            bookingId,
            actor.UserId,
            quote.OrganizationId,
            request.Provider,
            "PAY-" + ids.NewUuidV7().ToString("N")[^16..].ToUpperInvariant(),
            quote.Amount,
            quote.Currency,
            "PROCESSING",
            DateTimeOffset.UtcNow.AddMinutes(15),
            0,
            request.ReturnUri);
        await store.InsertPaymentAsync(payment, cancellationToken);
        _ = correlationId;
        return Result<PaymentDto>.Success(Map(payment, request.ReturnUri));
    }

    public async Task<Result<IReadOnlyList<PaymentDto>>> ListBookingAsync(Actor actor, Guid bookingId, CancellationToken cancellationToken)
    {
        var items = await store.ListByBookingAsync(bookingId, cancellationToken);
        if (items.Count > 0 && items[0].CustomerId != actor.UserId && !actor.Has("PLATFORM_ADMIN", "OPERATOR_FINANCE"))
        {
            return Result<IReadOnlyList<PaymentDto>>.Failure(PlatformErrors.AccessDenied());
        }

        return Result<IReadOnlyList<PaymentDto>>.Success(items.Select(item => Map(item, null)).ToArray());
    }

    public async Task<Result<PaymentDto>> GetAsync(Actor actor, Guid paymentId, CancellationToken cancellationToken)
    {
        var payment = await store.GetAsync(paymentId, cancellationToken);
        if (payment is null || (payment.CustomerId != actor.UserId && !actor.Has("PLATFORM_ADMIN", "OPERATOR_FINANCE")))
        {
            return Result<PaymentDto>.Failure(PlatformErrors.NotFound());
        }

        return Result<PaymentDto>.Success(Map(payment, null));
    }

    public async Task<Result<OperationAccepted>> CancelAsync(Actor actor, Guid paymentId, CancellationToken cancellationToken)
    {
        var payment = await store.GetAsync(paymentId, cancellationToken);
        if (payment is null || payment.CustomerId != actor.UserId)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.NotFound());
        }

        if (payment.Status is "SUCCEEDED" or "REFUNDED")
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.PaymentNotAllowed());
        }

        await store.UpdatePaymentAsync(payment with { Status = "CANCELLED" }, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(paymentId, "ACCEPTED"));
    }

    public async Task<Result> HandleWebhookAsync(string provider, IReadOnlyDictionary<string, object> body, Guid correlationId, CancellationToken cancellationToken)
    {
        if (!string.Equals(provider, "vnpay-sandbox", StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure(PlatformErrors.WebhookInvalid());
        }

        if (Read(body, "vnp_SecureHash") is { Length: > 0 } && !VnPayCheckout.Verify(vnpay.HashSecret, ToStringMap(body)))
        {
            return Result.Failure(PlatformErrors.WebhookInvalid());
        }

        var tmn = Read(body, "vnp_TmnCode");
        if (!string.IsNullOrWhiteSpace(tmn) && !string.Equals(tmn, vnpay.TmnCode, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure(PlatformErrors.WebhookInvalid());
        }

        var eventId = Read(body, "externalEventId") ?? Read(body, "vnp_TransactionNo") ?? Read(body, "vnp_TxnRef") ?? Read(body, "txnRef") ?? Guid.CreateVersion7().ToString("N");
        var reference = Read(body, "logicalReference");
        if (string.IsNullOrWhiteSpace(reference) || reference.Equals("null", StringComparison.OrdinalIgnoreCase))
        {
            reference = Read(body, "vnp_TxnRef") ?? Read(body, "txnRef");
        }
        var inserted = await store.TryInsertWebhookAsync("VNPAY_SANDBOX", eventId, eventId, cancellationToken);
        if (!inserted)
        {
            return Result.Success();
        }

        PaymentRecord? payment = null;
        if (Guid.TryParse(reference, out var paymentId))
        {
            payment = await store.GetAsync(paymentId, cancellationToken);
        }

        payment ??= reference is null ? null : await store.GetByReferenceAsync(reference, cancellationToken);
        if (payment is null)
        {
            return Result.Failure(PlatformErrors.NotFound());
        }

        var amountRaw = Read(body, "vnp_Amount");
        if (long.TryParse(amountRaw, out var providerAmount) && providerAmount > 0 && providerAmount != payment.Amount * 100)
        {
            return Result.Failure(PlatformErrors.WebhookInvalid());
        }

        var success = IsTruthy(Read(body, "success")) || Read(body, "vnp_ResponseCode") is "00";
        if (success && payment.Status != "SUCCEEDED")
        {
            var updated = payment with { Status = "SUCCEEDED" };
            await store.UpdatePaymentAsync(updated, cancellationToken);
            var quote = await store.GetQuoteAsync(payment.BookingId, cancellationToken);
            if (quote is not null)
            {
                var commission = (long)decimal.Round(payment.Amount * quote.CommissionRate, 0, MidpointRounding.AwayFromZero);
                await store.InsertSettlementAsync(new SettlementRecord(ids.NewUuidV7(), payment.BookingId, payment.OrganizationId, payment.Id, "PREPAID", payment.Amount, quote.CommissionRate, commission, payment.Amount - commission, payment.Currency, "COLLECTED"), cancellationToken);
            }

            await events.PaymentSucceededAsync(updated, correlationId, cancellationToken);
        }
        else if (!success)
        {
            await store.UpdatePaymentAsync(payment with { Status = "FAILED" }, cancellationToken);
        }

        await store.MarkWebhookProcessedAsync("VNPAY_SANDBOX", eventId, cancellationToken);
        return Result.Success();
    }

    public async Task<Result<OperationAccepted>> CreateRefundAsync(Actor actor, CreateRefundRequest request, CancellationToken cancellationToken)
    {
        var payment = await store.GetAsync(request.PaymentId, cancellationToken);
        if (payment is null)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.NotFound());
        }

        var refund = new RefundRecord(ids.NewUuidV7(), request.PaymentId, request.BookingId, actor.UserId, request.RefundReference, request.Amount, request.Currency, request.Reason, "SUCCEEDED");
        await store.InsertRefundAsync(refund, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(refund.Id, "ACCEPTED"));
    }

    public async Task<Result<RefundDto>> GetRefundAsync(Actor actor, Guid refundId, CancellationToken cancellationToken)
    {
        var refund = await store.GetRefundAsync(refundId, cancellationToken);
        return refund is null ? Result<RefundDto>.Failure(PlatformErrors.NotFound()) : Result<RefundDto>.Success(Map(refund));
    }

    public async Task<Result<PaymentPageDto>> SearchPaymentsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        if (!actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE", "OPERATOR_FINANCE", "OPERATOR_ADMIN"))
        {
            return Result<PaymentPageDto>.Failure(PlatformErrors.AccessDenied());
        }

        var org = actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE") ? (Guid?)null : actor.OrganizationId;
        var (items, total) = await store.SearchPaymentsAsync(org, page, size, cancellationToken);
        return Result<PaymentPageDto>.Success(new PaymentPageDto(page, size, total, Pages(total, size), items.Select(item => Map(item, null)).ToArray()));
    }

    public async Task<Result<RefundPageDto>> SearchRefundsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        if (!actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE", "OPERATOR_FINANCE", "OPERATOR_ADMIN"))
        {
            return Result<RefundPageDto>.Failure(PlatformErrors.AccessDenied());
        }

        var org = actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE") ? (Guid?)null : actor.OrganizationId;
        var (items, total) = await store.SearchRefundsAsync(org, page, size, cancellationToken);
        return Result<RefundPageDto>.Success(new RefundPageDto(page, size, total, Pages(total, size), items.Select(Map).ToArray()));
    }

    public async Task<Result<SettlementPageDto>> ListSettlementsAsync(Actor actor, bool platform, int page, int size, CancellationToken cancellationToken)
    {
        if (platform && !actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE"))
        {
            return Result<SettlementPageDto>.Failure(PlatformErrors.AccessDenied());
        }

        var org = platform ? (Guid?)null : actor.OrganizationId;
        var (items, total) = await store.ListSettlementsAsync(org, page, size, cancellationToken);
        return Result<SettlementPageDto>.Success(new SettlementPageDto(page, size, total, Pages(total, size), items.Select(Map).ToArray()));
    }

    public async Task ApplyRefundRequestedAsync(
        Guid bookingId,
        Guid paymentId,
        long amount,
        string currency,
        string reason,
        CancellationToken cancellationToken)
    {
        var payment = paymentId != Guid.Empty
            ? await store.GetAsync(paymentId, cancellationToken)
            : await store.GetByBookingAsync(bookingId, cancellationToken);
        if (payment is null || payment.Status != "SUCCEEDED")
        {
            return;
        }

        var refundAmount = amount > 0 ? Math.Min(amount, payment.Amount) : payment.Amount;
        if (refundAmount <= 0)
        {
            return;
        }

        var refund = new RefundRecord(
            ids.NewUuidV7(),
            payment.Id,
            payment.BookingId,
            Guid.Empty,
            "REF-" + ids.NewUuidV7().ToString("N")[^12..],
            refundAmount,
            string.IsNullOrWhiteSpace(currency) ? payment.Currency : currency,
            string.IsNullOrWhiteSpace(reason) ? "BOOKING_CANCELLED" : reason,
            "SUCCEEDED");
        await store.InsertRefundAsync(refund, cancellationToken);
        if (refundAmount >= payment.Amount)
        {
            await store.UpdatePaymentAsync(payment with { Status = "REFUNDED" }, cancellationToken);
        }

        await events.RefundSucceededAsync(refund, Guid.Empty, cancellationToken);
    }

    public async Task<Result<OperatorPayoutDto>> CreatePayoutAsync(Actor actor, CreatePayoutRequest request, CancellationToken cancellationToken)
    {
        if (!actor.Has("PLATFORM_ADMIN", "PLATFORM_FINANCE"))
        {
            return Result<OperatorPayoutDto>.Failure(PlatformErrors.AccessDenied());
        }

        var payout = await store.InsertPayoutAsync(new PayoutRecord(ids.NewUuidV7(), request.OrganizationId, request.PeriodStart, request.PeriodEnd, request.Currency, request.PayableAmount, "PENDING", null), cancellationToken);
        return Result<OperatorPayoutDto>.Success(Map(payout));
    }

    private async Task<BookingQuote?> WaitForQuoteAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 15; attempt++)
        {
            var quote = await store.GetQuoteAsync(bookingId, cancellationToken);
            if (quote is not null)
            {
                return quote;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(200), cancellationToken);
        }

        return await store.GetQuoteAsync(bookingId, cancellationToken);
    }

    private PaymentDto Map(PaymentRecord payment, string? returnUri)
    {
        var ret = returnUri ?? payment.ReturnUri;
        Dictionary<string, string>? action = null;
        if (!string.IsNullOrWhiteSpace(ret) && payment.Status is "PENDING" or "PROCESSING")
        {
            action = new Dictionary<string, string>
            {
                ["type"] = "REDIRECT",
                ["redirectUri"] = VnPayCheckout.BuildCheckoutUrl(
                    vnpay,
                    payment.LogicalReference,
                    payment.Amount,
                    "Booking " + payment.BookingId.ToString("N")[..8],
                    ret,
                    DateTimeOffset.UtcNow)
            };
        }

        return new PaymentDto(
            payment.Id,
            payment.BookingId,
            payment.Status,
            payment.Amount,
            payment.Currency,
            payment.Provider,
            action,
            "/api/v1/payments/" + payment.Id,
            payment.RowVersion);
    }

    private static RefundDto Map(RefundRecord refund) =>
        new(refund.Id, refund.RefundReference, refund.PaymentId, refund.BookingId, refund.Amount, refund.Currency, refund.Status, refund.Reason);

    private static BookingSettlementDto Map(SettlementRecord item) =>
        new(item.Id, item.BookingId, item.OrganizationId, item.PaymentId, item.PaymentChannel, item.Gross, item.Rate, item.Commission, item.Net, item.Currency, item.Status);

    private static OperatorPayoutDto Map(PayoutRecord item) =>
        new(item.Id, item.OrganizationId, item.PeriodStart, item.PeriodEnd, item.Currency, item.PayableAmount, item.Status, item.TransferredAt);

    private static bool IsTruthy(string? value) =>
        value is not null && (value.Equals("true", StringComparison.OrdinalIgnoreCase) || value is "1" or "00");

    private static string? Read(IReadOnlyDictionary<string, object> body, string key) =>
        body.TryGetValue(key, out var value) ? value?.ToString()?.Trim('"') : null;

    private static Dictionary<string, string> ToStringMap(IReadOnlyDictionary<string, object> body)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in body)
        {
            if (pair.Value is not null)
            {
                map[pair.Key] = pair.Value.ToString()?.Trim('"') ?? "";
            }
        }

        return map;
    }

    private static int Pages(long total, int size) => size <= 0 ? 0 : (int)((total + size - 1) / size);
}
