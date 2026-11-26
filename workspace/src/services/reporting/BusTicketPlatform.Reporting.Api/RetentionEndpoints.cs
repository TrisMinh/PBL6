using System.IO.Compression;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.BuildingBlocks.Errors;
using Microsoft.AspNetCore.Authorization;

namespace BusTicketPlatform.Reporting.Api;

internal static class RetentionEndpoints
{
    public static void MapRetentionEndpoints(this WebApplication app)
    {
        var route = app.MapGroup("/api/v1/admin/retention")
            .RequireAuthorization(new AuthorizeAttribute { Roles = "PLATFORM_ADMIN" });
        route.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });

        route.MapGet("/status", (RetentionService service) =>
            Results.Ok(new { service.Settings, service.Active, History = service.History() }));

        route.MapGet("/preview", async (RetentionService service, CancellationToken cancellation) =>
            Results.Ok(await service.PreviewAsync(cancellation)));

        route.MapPut("/settings", (RetentionSettings settings, RetentionService service, HttpContext context) =>
        {
            if (settings.Days is < 30 or > 365 || settings.Hour is < 0 or > 23)
                return PlatformHttp.Error(PlatformErrors.Validation("Chọn từ 30 đến 365 ngày và giờ từ 0 đến 23."),
                    context.CorrelationId());
            service.SaveSettings(settings);
            return Results.Ok(settings);
        });

        route.MapPost("/runs", (RetentionService service, HttpContext context) => service.Enqueue() is Guid id
            ? Results.Accepted("/api/v1/admin/retention/status", new { id })
            : PlatformHttp.Error(PlatformErrors.ResourceConflict("Một lần lưu trữ đang chạy."), context.CorrelationId()));

        route.MapGet("/runs/{id:guid}/files/{name}", (Guid id, string name, RetentionService service) =>
            service.ArchivePath(id, name) is { } file && File.Exists(file)
                ? Results.File(file, "application/gzip", name)
                : Results.NotFound());

        route.MapGet("/runs/{id:guid}/download", async (Guid id, RetentionService service, CancellationToken token) =>
        {
            var run = service.GetRun(id);
            if (run is null || run.FinishedAt is null || run.Files.Length == 0) return Results.NotFound();
            var files = run.Files.Select(file => (file.Name, Path: service.ArchivePath(id, file.Name))).ToArray();
            if (files.Any(file => !File.Exists(file.Path))) return Results.NotFound();
            var temporary = Path.Combine(Path.GetDirectoryName(files[0].Path!)!,
                $"bundle-{Guid.NewGuid():N}.tmp");
            var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None,
                bufferSize: 65536, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
            try
            {
                await using (var zip = await ZipArchive.CreateAsync(output, ZipArchiveMode.Create,
                    leaveOpen: true, entryNameEncoding: null, cancellationToken: token))
                {
                    await using (var manifest = await zip.CreateEntry("manifest.json").OpenAsync(token))
                        await JsonSerializer.SerializeAsync(manifest, run, cancellationToken: token);
                    foreach (var file in files)
                    {
                        await using var csv = await zip.CreateEntry(file.Name, CompressionLevel.NoCompression).OpenAsync(token);
                        await using var source = File.OpenRead(file.Path!);
                        await source.CopyToAsync(csv, token);
                    }
                }
                output.Position = 0;
                return Results.File(output, "application/zip", $"pbl6-archive-{id:N}.zip");
            }
            catch
            {
                await output.DisposeAsync();
                throw;
            }
        });
    }
}
