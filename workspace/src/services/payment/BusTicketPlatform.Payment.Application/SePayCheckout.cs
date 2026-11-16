using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace BusTicketPlatform.Payment.Application;

public sealed class SePayOptions
{
    public string MerchantId { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string IpnSecretKey { get; set; } = "";
    public string Environment { get; set; } = "sandbox";
    public string CustomerOrigin { get; set; } = "http://localhost:5173";
    public string[] Methods { get; set; } = ["BANK_TRANSFER"];
    public string CheckoutUrl => Environment == "production"
        ? "https://pay.sepay.vn/v1/checkout/init" : "https://pay-sandbox.sepay.vn/v1/checkout/init";
    public bool IsConfigured => Environment is "sandbox" or "production"
        && !string.IsNullOrWhiteSpace(MerchantId) && !string.IsNullOrWhiteSpace(SecretKey)
        && !string.IsNullOrWhiteSpace(IpnSecretKey)
        && Uri.TryCreate(CustomerOrigin, UriKind.Absolute, out var uri)
        && (uri.Scheme == "https" || Environment == "sandbox" && uri.IsLoopback && uri.Scheme == "http");
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
        // Sandbox local checkout returns to the same browser origin that owns the session.
        if (options.Environment == "sandbox" && Uri.TryCreate(payment.ReturnUri, UriKind.Absolute, out var local)
            && local.Scheme is "http" or "https" && local.IsLoopback && local.UserInfo.Length == 0)
            origin = local.GetLeftPart(UriPartial.Authority);
        var callback = origin + "/payment/sepay/return?bookingId=" + payment.BookingId;
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

    public static bool Authenticate(string configured, string supplied) => !string.IsNullOrWhiteSpace(configured)
        && CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(configured)), SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
}
