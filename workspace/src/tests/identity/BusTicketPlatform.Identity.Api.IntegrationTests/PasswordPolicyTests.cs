using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Api.IntegrationTests;

public sealed class PasswordPolicyTests
{
    [Theory]
    [InlineData("CorrectHorse1", true)]
    [InlineData("short", false)]
    [InlineData("12345678901", false)]
    [InlineData("NoDigitsHere", false)]
    public void Password_policy_requires_length_letter_and_digit(string password, bool expected)
    {
        Assert.Equal(expected, PasswordPolicy.IsSatisfied(password));
    }

    [Fact]
    public void Phone_and_email_normalizers_accept_local_and_e164_phone_formats()
    {
        Assert.True(IdentityNormalizer.IsPhone("+84901234567"));
        Assert.True(IdentityNormalizer.IsPhone("0901234567"));
        Assert.Equal("+84901234567", IdentityNormalizer.NormalizePhone("0901234567"));
        Assert.Equal("+84901234567", IdentityNormalizer.NormalizePhone("+84901234567"));
        Assert.False(IdentityNormalizer.IsPhone("0201234567"));
        Assert.Equal("A@EXAMPLE.TEST", IdentityNormalizer.NormalizeEmail("a@example.test"));
    }
}
