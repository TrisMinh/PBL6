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
    public void Phone_and_email_normalizers_match_contract()
    {
        Assert.True(IdentityNormalizer.IsPhone("+84901234567"));
        Assert.False(IdentityNormalizer.IsPhone("0901234567"));
        Assert.Equal("A@EXAMPLE.TEST", IdentityNormalizer.NormalizeEmail("a@example.test"));
    }
}
