using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Services.UnitTests;

public sealed class PasswordPolicyTests
{
    [Fact]
    public void IsSatisfiedReturnsFalseWhenPasswordHasNoDigit()
    {
        Assert.False(PasswordPolicy.IsSatisfied("OnlyLettersHere"));
    }

    [Fact]
    public void IsSatisfiedReturnsTrueWhenPasswordHasAtLeastTenCharactersAndADigit()
    {
        Assert.True(PasswordPolicy.IsSatisfied("Customer123"));
    }
}
