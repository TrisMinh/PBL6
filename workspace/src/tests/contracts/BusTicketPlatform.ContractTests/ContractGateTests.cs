using System.Text.RegularExpressions;
using YamlDotNet.RepresentationModel;

namespace BusTicketPlatform.ContractTests;

public sealed class ContractGateTests
{
    [Fact]
    public void OpenApi_parses_and_operation_ids_are_unique()
    {
        var path = Path.Combine(RepoRoot(), "docs", "contracts", "openapi", "platform-mvp.openapi.yaml");
        var yaml = File.ReadAllText(path);
        Assert.Contains("openapi: 3.1", yaml);
        var ids = OperationIds(yaml);
        Assert.True(ids.Count >= 60, $"expected MVP operations, found {ids.Count}");
        Assert.Equal(ids.Count, ids.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void Duplicate_operation_id_fixture_fails_uniqueness()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "invalid-openapi.yaml");
        var ids = OperationIds(File.ReadAllText(path));
        Assert.NotEqual(ids.Count, ids.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void AsyncApi_has_twenty_send_operations()
    {
        var path = Path.Combine(RepoRoot(), "docs", "contracts", "asyncapi", "platform-mvp.asyncapi.yaml");
        var yaml = File.ReadAllText(path);
        Assert.Contains("asyncapi: 3.1.0", yaml);
        var stream = new YamlStream();
        stream.Load(new StringReader(yaml));
        var root = (YamlMappingNode)stream.Documents[0].RootNode;
        var operations = (YamlMappingNode)root.Children[new YamlScalarNode("operations")];
        Assert.Equal(20, operations.Children.Count);
        foreach (var operation in operations.Children)
        {
            var body = (YamlMappingNode)operation.Value;
            Assert.Equal("send", ((YamlScalarNode)body.Children[new YamlScalarNode("action")]).Value);
        }
    }

    [Fact]
    public void Sql_baselines_exist_per_service_without_cross_database_fk()
    {
        var database = Path.Combine(RepoRoot(), "docs", "database");
        var services = new[] { "identity", "transport", "booking", "payment", "notification", "reporting" };
        foreach (var service in services)
        {
            var sql = File.ReadAllText(Path.Combine(database, service, "001_initial.sql"));
            Assert.False(string.IsNullOrWhiteSpace(sql));
            foreach (var other in services.Where(s => s != service))
            {
                Assert.DoesNotContain($"references {other}.", sql, StringComparison.OrdinalIgnoreCase);
            }
        }

        Assert.Contains("outbox_messages", File.ReadAllText(Path.Combine(database, "_shared", "000_integration_tables.sql")));

        var identitySeed = File.ReadAllText(Path.Combine(database, "identity", "010_synthetic_seed.sql"));
        var transportSeed = File.ReadAllText(Path.Combine(database, "transport", "010_synthetic_seed.sql"));
        Assert.Contains("example.test", identitySeed);
        Assert.Contains("example.test", transportSeed);
        Assert.DoesNotContain("@gmail.com", identitySeed, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@gmail.com", transportSeed, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sql_baselines_do_not_use_destructive_or_cross_database_commands()
    {
        var database = Path.Combine(RepoRoot(), "docs", "database");
        foreach (var file in Directory.GetFiles(database, "*.sql", SearchOption.AllDirectories))
        {
            var sql = File.ReadAllText(file);
            Assert.DoesNotContain("drop database", sql, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("pg_terminate_backend", sql, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("dblink", sql, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("postgres_fdw", sql, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void Invalid_sql_fixture_contains_cross_database_fk()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "invalid-sql.sql");
        var sql = File.ReadAllText(path);
        Assert.Contains("references booking.", sql, StringComparison.OrdinalIgnoreCase);
    }

    private static List<string> OperationIds(string yaml)
    {
        return Regex.Matches(yaml, @"operationId:\s*([A-Za-z0-9_]+)")
            .Select(match => match.Groups[1].Value)
            .ToList();
    }

    private static string RepoRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docs", "contracts", "openapi", "platform-mvp.openapi.yaml")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("repository root was not found.");
    }
}
