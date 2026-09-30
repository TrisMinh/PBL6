using System.Text.Json.Nodes;
using Json.Schema;

namespace BusTicketPlatform.ContractTests;

public sealed class MessageSchemaTests
{
    [Fact]
    public void User_registered_sample_matches_platform_schema()
    {
        var schemaPath = Path.Combine(RepoRoot(), "docs", "contracts", "schemas", "platform-message.schema.json");
        var schema = JsonSchema.FromFile(schemaPath);
        var userId = Guid.CreateVersion7();
        var sample = new JsonObject
        {
            ["eventId"] = Guid.CreateVersion7().ToString(),
            ["eventType"] = "UserRegistered",
            ["version"] = 1,
            ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O"),
            ["producer"] = "identity-service",
            ["correlationId"] = Guid.CreateVersion7().ToString(),
            ["causationId"] = null,
            ["aggregateId"] = userId.ToString(),
            ["aggregateVersion"] = 1,
            ["tenantId"] = null,
            ["payload"] = new JsonObject
            {
                ["userId"] = userId.ToString(),
                ["verificationChannel"] = "EMAIL",
                ["registeredAt"] = DateTimeOffset.UtcNow.ToString("O")
            }
        };

        var result = schema.Evaluate(sample, new EvaluationOptions { OutputFormat = OutputFormat.List });
        Assert.True(result.IsValid);
    }

    [Fact]
    public void Invalid_sample_fails_schema_gate()
    {
        var schemaPath = Path.Combine(RepoRoot(), "docs", "contracts", "schemas", "platform-message.schema.json");
        var schema = JsonSchema.FromFile(schemaPath);
        var sample = new JsonObject { ["eventType"] = "UserRegistered" };
        var result = schema.Evaluate(sample, new EvaluationOptions { OutputFormat = OutputFormat.List });
        Assert.False(result.IsValid);
    }

    private static string RepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docs", "contracts", "schemas", "platform-message.schema.json")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("repository root was not found.");
    }
}
