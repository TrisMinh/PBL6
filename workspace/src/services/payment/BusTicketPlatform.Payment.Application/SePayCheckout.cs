using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BusTicketPlatform.Payment.Application;

public sealed class SePayOptions
{
    public string MerchantId { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string IpnSecretKey { get; set; } = "";
    public string Environment { get; set; } = "sandbox";
    public string CustomerOrigin { get; set; } = "http://localhost:5173";
    public bool AutomaticReconciliationEnabled { get; set; } = true;
    public string[] Methods { get; set; } = ["BANK_TRANSFER"];
    public string CheckoutUrl => Environment == "production"
        ? "https://pay.sepay.vn/v1/checkout/init" : "https://pay-sandbox.sepay.vn/v1/checkout/init";
    public bool IsConfigured => Environment is "sandbox" or "production"
        && !string.IsNullOrWhiteSpace(MerchantId) && !string.IsNullOrWhiteSpace(SecretKey)
        && !string.IsNullOrWhiteSpace(IpnSecretKey)
        && Uri.TryCreate(CustomerOrigin, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && !uri.IsLoopback;
}

public static class SePayCheckout
{
    // SePay specifies this exact order, raw values, comma separators and base64 HMAC-SHA256.
    private static readonly string[] SignedFields = ["order_amount", "merchant", "currency", "operation",
        "order_description", "order_invoice_number", "customer_id", "payment_method", "success_url", "error_url", "cancel_url"];

    public static string Sign(IReadOnlyDictionary<string, string> fields, string secret)
    {
        var canonical = string.Join(",", SignedFields.Where(key => fields.TryGetValue(key, out var value)
            && !string.IsNullOrEmpty(value) && value != "0").Select(key => key + "=" + fields[key]));
        return Convert.ToBase64String(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(canonical)));
    }

    public static Dictionary<string, string> BuildAction(SePayOptions options, PaymentRecord payment, string method)
    {
        var origin = options.CustomerOrigin.TrimEnd('/');
        var callback = origin + "/payment/sepay/return?bookingId=" + payment.BookingId;
        // SePay requires public callback URLs. A signed public bridge returns the browser to its original local session.
        if (options.Environment == "sandbox" && Uri.TryCreate(payment.ReturnUri, UriKind.Absolute, out var local)
            && IsLocalOrigin(local))
        {
            var state = JsonSerializer.SerializeToUtf8Bytes(new LocalReturnState(payment.BookingId, local.GetLeftPart(UriPartial.Authority), payment.ExpiresAt.AddHours(24).ToUnixTimeSeconds()));
            var payload = Encode(state);
            var signature = HMACSHA256.HashData(Encoding.UTF8.GetBytes(options.SecretKey), Encoding.UTF8.GetBytes("BLUE_SEPAY_LOCAL_RETURN:" + payload));
            callback = origin + "/integrations/payments/sepay/browser-return?state=" + payload + "." + Encode(signature);
        }
        var fields = new Dictionary<string, string>
        {
            ["order_amount"] = payment.Amount.ToString(CultureInfo.InvariantCulture),
            ["merchant"] = options.MerchantId,
            ["currency"] = payment.Currency,
            ["operation"] = "PURCHASE",
            ["order_description"] = "BLUE booking " + payment.BookingId.ToString("N")[..8],
            ["order_invoice_number"] = payment.LogicalReference,
            ["customer_id"] = payment.CustomerId.ToString(),
            ["payment_method"] = method,
            ["success_url"] = callback,
            ["error_url"] = callback,
            ["cancel_url"] = callback,
            ["lang"] = "vi"
        };
        fields["signature"] = Sign(fields, options.SecretKey);
        // Transport metadata is excluded from the posted, signed form.
        fields["type"] = "FORM_POST";
        fields["actionUrl"] = options.CheckoutUrl;
        return fields;
    }

    private sealed record LocalReturnState(Guid BookingId, string Origin, long Expiry);
    private static bool IsLocalOrigin(Uri uri) => uri.Scheme is "http" or "https" && uri.IsLoopback && uri.UserInfo.Length == 0;
    private static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] Decode(string value) => Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));
    public static bool TryReadLocalReturn(SePayOptions options, string? token, out string target)
    {
        target = "";
        if (options.Environment != "sandbox" || string.IsNullOrWhiteSpace(options.SecretKey) || string.IsNullOrWhiteSpace(token) || token.Length > 2048) return false;
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 2) return false;
            var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(options.SecretKey), Encoding.UTF8.GetBytes("BLUE_SEPAY_LOCAL_RETURN:" + parts[0]));
            if (!CryptographicOperations.FixedTimeEquals(expected, Decode(parts[1]))) return false;
            var state = JsonSerializer.Deserialize<LocalReturnState>(Decode(parts[0]));
            if (state is null || state.BookingId == Guid.Empty || state.Expiry <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                || !Uri.TryCreate(state.Origin, UriKind.Absolute, out var local) || !IsLocalOrigin(local)
                || state.Origin != local.GetLeftPart(UriPartial.Authority)) return false;
            target = state.Origin + "/payment/sepay/return?bookingId=" + state.BookingId;
            return true;
        }
        catch (Exception error) when (error is FormatException or JsonException or ArgumentException) { return false; }
    }

    public static bool Authenticate(string configured, string supplied) => !string.IsNullOrWhiteSpace(configured)
        && CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(configured)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
}
