using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Payment.Application;

namespace BusTicketPlatform.Payment.Infrastructure;

public sealed class SePayOrderLookup(HttpClient client, SePayOptions options) : ISePayOrderLookup
{
    public async Task<Result<IReadOnlyList<SePayNotification>>> FindCapturesAsync(string invoice, CancellationToken cancellationToken)
    {
        if (!options.IsConfigured) return Unavailable();
        var origin = options.Environment == "production" ? "https://pgapi.sepay.vn" : "https://pgapi-sandbox.sepay.vn";
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{origin}/v1/order/detail/{Uri.EscapeDataString(invoice)}");
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{options.MerchantId}:{options.SecretKey}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound) return Empty();
            if (!response.IsSuccessStatusCode) return Unavailable();
            using var document = JsonDocument.Parse(await response.Content.ReadAsByteArrayAsync(cancellationToken));
            return ReadCaptures(document.RootElement, invoice);
        }
        catch (Exception error) when (error is HttpRequestException or JsonException
            || error is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return Unavailable();
        }
    }

    private static Result<IReadOnlyList<SePayNotification>> ReadCaptures(JsonElement root, string invoice)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("data", out var order)
            || Read(order, "order_invoice_number") != invoice)
            return Unavailable();

        var status = Read(order, "order_status");
        if (status is "AUTHENTICATION_NOT_NEEDED" or "CANCELLED") return Empty();
        if (status != "CAPTURED" || !order.TryGetProperty("transactions", out var transactions)
            || transactions.ValueKind != JsonValueKind.Array)
            return Unavailable();

        var captures = new List<SePayNotification>();
        foreach (var transaction in transactions.EnumerateArray())
        {
            if (Read(transaction, "transaction_type") != "PAYMENT" || Read(transaction, "transaction_status") != "APPROVED") continue;
            var normalized = JsonSerializer.SerializeToElement(new { notification_type = "ORDER_PAID", order, transaction });
            var parsed = SePayIpn.Parse(normalized);
            if (!parsed.IsSuccess) return Unavailable();
            captures.Add(parsed.Value!);
        }

        return captures.Count == 0 ? Unavailable() : Result<IReadOnlyList<SePayNotification>>.Success(captures);
    }

    private static string Read(JsonElement obj, string field) =>
        obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()! : "";

    private static Result<IReadOnlyList<SePayNotification>> Empty() => Result<IReadOnlyList<SePayNotification>>.Success([]);
    private static Result<IReadOnlyList<SePayNotification>> Unavailable() => Result<IReadOnlyList<SePayNotification>>.Failure(SePayReconciliation.UpstreamError());
}
