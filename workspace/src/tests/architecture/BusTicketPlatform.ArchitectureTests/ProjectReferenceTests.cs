using System.Xml.Linq;

namespace BusTicketPlatform.ArchitectureTests;

public sealed class ProjectReferenceTests
{
    [Fact]
    public void Workspace_pins_net10_and_projects_do_not_override_it()
    {
        var root = FindWorkspaceRoot();
        var props = File.ReadAllText(Path.Combine(root, "Directory.Build.props"));
        Assert.Contains("<TargetFramework>net10.0</TargetFramework>", props);

        foreach (var project in CsprojFiles())
        {
            var text = File.ReadAllText(project);
            Assert.DoesNotContain("net8.0", text);
            Assert.DoesNotContain("net9.0", text);
            if (text.Contains("<TargetFramework>", StringComparison.Ordinal))
            {
                Assert.Contains("<TargetFramework>net10.0</TargetFramework>", text);
            }
        }
    }

    [Fact]
    public void Services_do_not_project_reference_other_services()
    {
        var servicesRoot = Path.Combine(FindWorkspaceRoot(), "src", "services");
        foreach (var project in Directory.GetFiles(servicesRoot, "*.csproj", SearchOption.AllDirectories))
        {
            var owner = ServiceName(project);
            var xml = XDocument.Load(project);
            var refs = xml.Descendants("ProjectReference")
                .Select(e => e.Attribute("Include")?.Value)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToArray();

            foreach (var reference in refs)
            {
                var normalized = reference!.Replace('\\', '/');
                if (!normalized.Contains("/services/", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                Assert.Contains($"/{owner}/", normalized, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    [Fact]
    public void Package_versions_are_centralized()
    {
        foreach (var project in CsprojFiles())
        {
            var xml = XDocument.Load(project);
            var versions = xml.Descendants("PackageReference")
                .Select(e => e.Attribute("Version")?.Value)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToArray();

            Assert.True(versions.Length == 0, $"{project} pins PackageReference Version; use Directory.Packages.props.");
        }
    }

    private static IEnumerable<string> CsprojFiles()
    {
        return Directory.GetFiles(FindWorkspaceRoot(), "*.csproj", SearchOption.AllDirectories);
    }

    private static string ServiceName(string projectPath)
    {
        var servicesRoot = Path.Combine(FindWorkspaceRoot(), "src", "services") + Path.DirectorySeparatorChar;
        var relative = Path.GetRelativePath(servicesRoot, projectPath);
        return relative.Split(Path.DirectorySeparatorChar)[0];
    }

    private static string FindWorkspaceRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "BusTicketPlatform.sln")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("workspace root with BusTicketPlatform.sln was not found.");
    }
}
