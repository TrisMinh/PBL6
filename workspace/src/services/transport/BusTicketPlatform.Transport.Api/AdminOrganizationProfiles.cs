using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using BusTicketPlatform.Transport.Infrastructure;
using Npgsql;
using NpgsqlTypes;

namespace BusTicketPlatform.Transport.Api;
public sealed record AdminOrganizationProfile(string Name, string ContactEmail, string ContactPhone, string Status, string? LegalName, string? TaxId, string? Address, string? ContactName, long ExpectedVersion);
public static class AdminOrganizationProfiles
{
    public static void MapAdminOrganizationProfiles(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/admin/organizations").RequireAuthorization();
        group.MapGet("/{id:guid}/profile", async (Guid id, HttpContext context, TransportDatabaseOptions options) => {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            await using var db = new NpgsqlConnection(options.ConnectionString); await db.OpenAsync(context.RequestAborted);
            return await Read(db, id, context.RequestAborted);
        });
        group.MapPatch("/{id:guid}/profile", async (Guid id, AdminOrganizationProfile body, HttpContext context, TransportDatabaseOptions options) => {
            if (!context.User.IsInRole("PLATFORM_ADMIN")) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(body.Name) || body.Name.Length > 120 || !System.Net.Mail.MailAddress.TryCreate(body.ContactEmail, out _) || !System.Text.RegularExpressions.Regex.IsMatch(body.ContactPhone,"^[0-9]{10,15}$") || body.Status is not("active" or "inactive")) return Results.BadRequest();
            if ((body.LegalName?.Length ?? 0) > 160 || (body.TaxId?.Length ?? 0) > 30 || (body.Address?.Length ?? 0) > 240 || (body.ContactName?.Length ?? 0) > 120) return Results.BadRequest();
            await using var db = new NpgsqlConnection(options.ConnectionString); await db.OpenAsync(context.RequestAborted);
            await using var transaction = await db.BeginTransactionAsync(context.RequestAborted);
            await using (var update = new NpgsqlCommand("UPDATE organizations SET name=@name,support_email=@email,support_phone=@phone,status=@status,row_version=row_version+1,updated_at=now() WHERE id=@id AND row_version=@version",db,transaction)) {
                update.Parameters.AddWithValue("id",id); update.Parameters.AddWithValue("version",body.ExpectedVersion); update.Parameters.AddWithValue("name",body.Name.Trim()); update.Parameters.AddWithValue("email",body.ContactEmail); update.Parameters.AddWithValue("phone",body.ContactPhone); update.Parameters.AddWithValue("status",body.Status.ToUpperInvariant());
                if (await update.ExecuteNonQueryAsync(context.RequestAborted) != 1) return Results.Conflict();
            }
            await using (var metadata = new NpgsqlCommand("INSERT INTO operator_resource_metadata(organization_id,resource_kind,resource_id,data) VALUES(@id,'organization',@id,@data) ON CONFLICT(organization_id,resource_kind,resource_id) DO UPDATE SET data=operator_resource_metadata.data || EXCLUDED.data,updated_at=now()",db,transaction)) {
                metadata.Parameters.AddWithValue("id",id); metadata.Parameters.AddWithValue("data",NpgsqlDbType.Jsonb,JsonSerializer.Serialize(new { legalName=body.LegalName,taxId=body.TaxId,address=body.Address,contactName=body.ContactName })); await metadata.ExecuteNonQueryAsync(context.RequestAborted);
            }
            await transaction.CommitAsync(context.RequestAborted);
            return await Read(db,id,context.RequestAborted);
        });
    }
    private static async Task<IResult> Read(NpgsqlConnection db, Guid id, CancellationToken cancellation) {
        await using var command = new NpgsqlCommand("SELECT o.id,o.name,o.support_email,o.support_phone,o.status,o.row_version,o.created_at,o.updated_at,COALESCE(m.data,'{}'::jsonb)::text FROM organizations o LEFT JOIN operator_resource_metadata m ON m.organization_id=o.id AND m.resource_kind='organization' AND m.resource_id=o.id WHERE o.id=@id",db); command.Parameters.AddWithValue("id",id);
        await using var reader=await command.ExecuteReaderAsync(cancellation); if(!await reader.ReadAsync(cancellation))return Results.NotFound();
        var metadata=JsonSerializer.Deserialize<Dictionary<string,JsonElement>>(reader.GetString(8))!;
        object? Field(string key)=>metadata.TryGetValue(key,out var value)?value:null;
        return Results.Json(new { id=reader.GetGuid(0),name=reader.GetString(1),contactEmail=reader.IsDBNull(2)?null:reader.GetString(2),contactPhone=reader.IsDBNull(3)?null:reader.GetString(3),status=reader.GetString(4),rowVersion=reader.GetInt64(5),createdAt=reader.GetDateTime(6),updatedAt=reader.GetDateTime(7),legalName=Field("legalName"),taxId=Field("taxId"),address=Field("address"),contactName=Field("contactName") });
    }
}
