using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.Transport.Infrastructure;
using Npgsql;
using NpgsqlTypes;

namespace BusTicketPlatform.Transport.Api;

public static class TransportOperatorMetadata
{
    private static readonly Dictionary<string, string> Tables = new() { ["buses"] = "buses", ["drivers"] = "driver_profiles", ["routes"] = "routes", ["organization"] = "organizations" };
    public static void MapOperatorMetadata(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operator/resource-metadata").RequireAuthorization();
        group.MapGet("/{kind}", async (HttpContext context, TransportDatabaseOptions options, string kind) =>
        {
            if (!Tables.ContainsKey(kind)) return Results.NotFound();
            var org = context.User.OrganizationId();
            if (org is null) return Results.Forbid();
            await using var db = new NpgsqlConnection(options.ConnectionString);
            await db.OpenAsync(context.RequestAborted);
            await using var cmd = new NpgsqlCommand("SELECT resource_id, data::text FROM operator_resource_metadata WHERE organization_id=@org AND resource_kind=@kind", db);
            cmd.Parameters.AddWithValue("org",org.Value); cmd.Parameters.AddWithValue("kind",kind);
            var result = new Dictionary<string, JsonElement>();
            await using var reader = await cmd.ExecuteReaderAsync(context.RequestAborted);
            while(await reader.ReadAsync(context.RequestAborted)) result[reader.GetGuid(0).ToString()] = JsonSerializer.Deserialize<JsonElement>(reader.GetString(1));
            return Results.Json(result);
        });
        group.MapPut("/{kind}/{id:guid}", async (HttpContext context, TransportDatabaseOptions options, string kind, Guid id, JsonElement body) =>
        {
            if (!Tables.TryGetValue(kind,out var table)) return Results.NotFound();
            var org = context.User.OrganizationId();
            if (org is null || !CanWrite(context)) return Results.Forbid();
            if (body.ValueKind != JsonValueKind.Object || body.GetRawText().Length > 131072) return Results.BadRequest();
            await using var db = new NpgsqlConnection(options.ConnectionString); await db.OpenAsync(context.RequestAborted);
            await using var cmd = new NpgsqlCommand($"INSERT INTO operator_resource_metadata(organization_id,resource_kind,resource_id,data) SELECT @org,@kind,@id,@data WHERE EXISTS(SELECT 1 FROM {table} WHERE id=@id AND {(kind=="organization"?"id":"organization_id")}=@org) ON CONFLICT(organization_id,resource_kind,resource_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",db);
            cmd.Parameters.AddWithValue("org",org.Value); cmd.Parameters.AddWithValue("kind",kind); cmd.Parameters.AddWithValue("id",id); cmd.Parameters.AddWithValue("data",NpgsqlDbType.Jsonb,body.GetRawText());
            return await cmd.ExecuteNonQueryAsync(context.RequestAborted) == 1 ? Results.Json(body) : Results.NotFound();
        });
        var files = endpoints.MapGroup("/api/v1/operator/driver-files").RequireAuthorization();
        files.MapPost("/", async (HttpContext context, TransportDatabaseOptions options) =>
        {
            var org = context.User.OrganizationId(); if(org is null || !CanWrite(context)) return Results.Forbid();
            if(context.Request.ContentLength is null or > 10485760 or < 1) return Results.BadRequest();
            var type=context.Request.ContentType ?? "";
            if(type is not("image/jpeg" or "image/png" or "application/pdf")) return Results.BadRequest();
            using var buffer=new MemoryStream(); await context.Request.Body.CopyToAsync(buffer,context.RequestAborted);
            if(buffer.Length is < 1 or > 10485760) return Results.BadRequest();
            var id=Guid.NewGuid(); var name=context.Request.Headers["X-File-Name"].ToString();
            if(name.Length is < 1 or > 255) return Results.BadRequest();
            await using var db=new NpgsqlConnection(options.ConnectionString); await db.OpenAsync(context.RequestAborted);
            await using var cmd=new NpgsqlCommand("INSERT INTO operator_driver_files(id,organization_id,name,content_type,content) VALUES(@id,@org,@name,@type,@data)",db);
            cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("org",org.Value);cmd.Parameters.AddWithValue("name",name);cmd.Parameters.AddWithValue("type",type);cmd.Parameters.AddWithValue("data",buffer.ToArray());
            await cmd.ExecuteNonQueryAsync(context.RequestAborted);
            return Results.Json(new {id,name,type,size=buffer.Length},statusCode:201);
        });
        files.MapGet("/{id:guid}", async (HttpContext context,TransportDatabaseOptions options,Guid id) =>
        {
            var org=context.User.OrganizationId();if(org is null)return Results.Forbid();
            await using var db=new NpgsqlConnection(options.ConnectionString);await db.OpenAsync(context.RequestAborted);
            await using var cmd=new NpgsqlCommand("SELECT content,content_type,name FROM operator_driver_files WHERE id=@id AND organization_id=@org",db);cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("org",org.Value);
            await using var reader=await cmd.ExecuteReaderAsync(context.RequestAborted);
            return await reader.ReadAsync(context.RequestAborted)?Results.File((byte[])reader[0],reader.GetString(1),reader.GetString(2)):Results.NotFound();
        });
        files.MapDelete("/{id:guid}", async (HttpContext context,TransportDatabaseOptions options,Guid id) =>
        {
            var org=context.User.OrganizationId();if(org is null||!CanWrite(context))return Results.Forbid();
            await using var db=new NpgsqlConnection(options.ConnectionString);await db.OpenAsync(context.RequestAborted);
            await using var cmd=new NpgsqlCommand("DELETE FROM operator_driver_files WHERE id=@id AND organization_id=@org",db);cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("org",org.Value);
            return await cmd.ExecuteNonQueryAsync(context.RequestAborted)==1?Results.NoContent():Results.NotFound();
        });
    }
    private static bool CanWrite(HttpContext context) => context.User.IsInRole("OPERATOR_ADMIN") || context.User.IsInRole("OPERATOR_SCHEDULER") || context.User.IsInRole("PLATFORM_ADMIN");
}
