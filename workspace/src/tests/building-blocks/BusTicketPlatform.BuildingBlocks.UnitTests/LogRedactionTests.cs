using BusTicketPlatform.BuildingBlocks.Logging;
using BusTicketPlatform.BuildingBlocks.Telemetry;

namespace BusTicketPlatform.BuildingBlocks.UnitTests;

public sealed class LogRedactionTests
{
    [Fact]
    public void Redacts_password_email_and_token_keys()
    {
        var redacted = LogRedaction.Redact(new Dictionary<string, object?>
        {
            ["userId"] = "01990a00-0000-7000-8000-000000000002",
            ["email"] = "seed.customer@example.test",
            ["password"] = "secret-value",
            ["accessToken"] = "jwt-value"
        });

        Assert.Equal("01990a00-0000-7000-8000-000000000002", redacted["userId"]);
        Assert.Equal(LogRedaction.MaskValue, redacted["email"]);
        Assert.Equal(LogRedaction.MaskValue, redacted["password"]);
        Assert.Equal(LogRedaction.MaskValue, redacted["accessToken"]);
    }

    [Fact]
    public void Telemetry_tag_names_are_stable()
    {
        Assert.Equal("correlation.id", TelemetryConventions.CorrelationTag);
        Assert.Equal("busticket", TelemetryConventions.ServiceNamespace);
    }
}
