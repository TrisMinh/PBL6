using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace BusTicketPlatform.Payment.Application;

public sealed class VnPayOptions
{
    public const string SectionName = "Payment";

    public string CheckoutBaseUrl { get; set; } = "http://localhost:8099/checkout";
    public string TmnCode { get; set; } = "LOCALDEV";
    public string HashSecret { get; set; } = "local-dev-only-vnpay-hash-secret-32b";
    public string DefaultClientIp { get; set; } = "127.0.0.1";
    public decimal DefaultCommissionRate { get; set; } = 0.10m;
}

public static class VnPayCheckout
{
    public static bool IsSupportedMethod(string method) =>
        method is "VNPAY_QR" or "ATM_CARD" or "BANK_ACCOUNT" or "VNPAY";

    public static string BuildCheckoutUrl(
        VnPayOptions options,
        string txnRef,
        long amountVnd,
        string orderInfo,
        string returnUri,
        DateTimeOffset now,
        string? clientIp = null)
    {
        var fields = UnsignedFields(options, txnRef, amountVnd, orderInfo, returnUri, now, clientIp);
        fields["vnp_SecureHash"] = Sign(options.HashSecret, fields);
        var query = string.Join("&", fields.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value)}"));
        var baseUrl = options.CheckoutBaseUrl.TrimEnd('/');
        return $"{baseUrl}?{query}";
    }

    public static Dictionary<string, string> UnsignedFields(
        VnPayOptions options,
        string txnRef,
        long amountVnd,
        string orderInfo,
        string returnUri,
        DateTimeOffset now,
        string? clientIp)
    {
        var local = ToVietnam(now);
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = options.TmnCode,
            ["vnp_Amount"] = (amountVnd * 100).ToString(CultureInfo.InvariantCulture),
            ["vnp_CreateDate"] = local.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_IpAddr"] = string.IsNullOrWhiteSpace(clientIp) ? options.DefaultClientIp : clientIp,
            ["vnp_Locale"] = "vn",
            ["vnp_OrderInfo"] = orderInfo,
            ["vnp_OrderType"] = "other",
            ["vnp_ReturnUrl"] = returnUri,
            ["vnp_TxnRef"] = txnRef
        };
    }

    public static string Sign(string secret, IReadOnlyDictionary<string, string> fields)
    {
        var data = string.Join("&", fields
            .Where(pair => pair.Key.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase)
                && !IsHashField(pair.Key)
                && !string.IsNullOrEmpty(pair.Value))
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{WebUtility.UrlEncode(pair.Key)}={WebUtility.UrlEncode(pair.Value)}"));
        var key = Encoding.UTF8.GetBytes(secret);
        var bytes = HMACSHA512.HashData(key, Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static bool Verify(string secret, IReadOnlyDictionary<string, string> fields)
    {
        if (!fields.TryGetValue("vnp_SecureHash", out var provided) || string.IsNullOrWhiteSpace(provided))
        {
            return false;
        }

        var expected = Sign(secret, fields);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected.ToUpperInvariant()),
            Encoding.UTF8.GetBytes(provided.Trim().ToUpperInvariant()));
    }

    private static DateTimeOffset ToVietnam(DateTimeOffset now)
    {
        foreach (var id in new[] { "SE Asia Standard Time", "Asia/Ho_Chi_Minh" })
        {
            try
            {
                return TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(id));
            }
            catch (TimeZoneNotFoundException)
            {
            }
        }

        return now.ToOffset(TimeSpan.FromHours(7));
    }

    private static bool IsHashField(string key) =>
        key.Equals("vnp_SecureHash", StringComparison.OrdinalIgnoreCase)
        || key.Equals("vnp_SecureHashType", StringComparison.OrdinalIgnoreCase);
}
