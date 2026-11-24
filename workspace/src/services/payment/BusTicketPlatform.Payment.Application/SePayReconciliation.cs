using System.Security.Cryptography;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Payment.Application;

public interface ISePayOrderLookup
{
    Task<Result<IReadOnlyList<SePayNotification>>> FindCapturesAsync(string invoice, CancellationToken cancellationToken);
}

public sealed class SePayReconciliation(IPaymentRepository payments, ISePayPaymentStore store, ISePayOrderLookup lookup)
{
    public async Task<int> CheckDueAsync(CancellationToken cancellationToken)
    {
        const int batchSize = 10;
        var failures = 0;
        var due = await store.FindDueReconciliationsAsync(batchSize, cancellationToken);
        foreach (var paymentId in due)
        {
            var payment = await payments.GetAsync(paymentId, cancellationToken);
            if (payment is null || payment.Provider != "SEPAY") continue;
            var result = await ReconcileAsync(payment, Guid.CreateVersion7(), automatic: true, cancellationToken);
            if (!result.IsSuccess) failures++;
        }

        return failures;
    }

    public async Task<Result> CheckAsync(Guid customerId, Guid paymentId, Guid correlationId, CancellationToken cancellationToken)
    {
        var payment = await payments.GetAsync(paymentId, cancellationToken);
        if (payment is null || payment.CustomerId != customerId || payment.Provider != "SEPAY")
            return Result.Failure(PlatformErrors.NotFound());

        return await ReconcileAsync(payment, correlationId, automatic: false, cancellationToken);
    }

    private async Task<Result> ReconcileAsync(PaymentRecord payment, Guid correlationId, bool automatic,
        CancellationToken cancellationToken)
    {
        if (!CanCheck(payment.Status)) return Result.Success();
        if (!await store.TryStartReconciliationAsync(payment.Id, automatic, cancellationToken))
        {
            if (automatic) return Result.Success();
            var current = await payments.GetAsync(payment.Id, cancellationToken);
            if (current is not null && !CanCheck(current.Status)) return Result.Success();
            return Result.Failure(new AppError(ErrorCodes.RateLimited,
                "Please wait before checking this payment again.", StatusCodes.TooManyRequests));
        }

        var captures = await lookup.FindCapturesAsync(payment.LogicalReference, cancellationToken);
        if (!captures.IsSuccess) return Result.Failure(captures.Error!);
        if (captures.Value!.Any(capture => capture.Invoice != payment.LogicalReference
            || capture.Amount != payment.Amount || capture.Currency != payment.Currency))
            return Result.Failure(UpstreamError());

        foreach (var capture in captures.Value!)
        {
            var hash = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(capture)));
            var applied = await store.ApplySePayAsync(capture, hash, correlationId, cancellationToken);
            if (!applied.IsSuccess) return applied;
        }

        return Result.Success();
    }

    public static AppError UpstreamError() => new(ErrorCodes.UpstreamUnavailable,
        "SePay could not verify the payment at this time.", StatusCodes.ServiceUnavailable);

    private static bool CanCheck(string status) => status is "PENDING" or "PROCESSING" or "FAILED" or "CANCELLED";
}
