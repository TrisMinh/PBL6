using System.Text.RegularExpressions;

namespace BusTicketPlatform.Identity.Domain;

public static partial class IdentityNormalizer
{
    [GeneratedRegex(@"^\+[1-9][0-9]{7,14}$")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"^0[35789][0-9]{8}$")]
    private static partial Regex VietnameseMobilePattern();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    public static string NormalizePhone(string phone)
    {
        var trimmed = phone.Trim();
        return VietnameseMobilePattern().IsMatch(trimmed) ? $"+84{trimmed[1..]}" : trimmed;
    }

    public static bool IsEmail(string value) => EmailPattern().IsMatch(value.Trim());

    public static bool IsPhone(string value)
    {
        var trimmed = value.Trim();
        return VietnameseMobilePattern().IsMatch(trimmed) || PhonePattern().IsMatch(trimmed);
    }

    public static bool IsFullName(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length is >= 2 and <= 150;
    }
}
