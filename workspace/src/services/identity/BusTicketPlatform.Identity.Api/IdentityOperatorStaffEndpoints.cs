using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.Identity.Application;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Api;
public sealed record OperatorStaffInput(string FullName,string Email,string Phone,string? Role,string? InitialPassword);
public sealed record OperatorStaffUpdate(string Role,string Status,long ExpectedVersion);
public static class IdentityOperatorStaffEndpoints
{
 public static void MapOperatorStaff(this IEndpointRouteBuilder endpoints)
 {
  var group=endpoints.MapGroup("/api/v1/operator/staff").RequireAuthorization();
  group.MapGet("/", async (HttpContext ctx, IIdentityRepository store, bool? driverDirectory) =>
  {
   var org = ctx.User.OrganizationId();
   var administrator = Allowed(ctx);
   var dispatcher = ctx.User.FindAll("org_role").Any(role => role.Value is "OPERATOR_OPERATIONS" or "OPERATOR_SCHEDULER");
   if (org is null || (!administrator && !(driverDirectory == true && dispatcher)))
    return Results.Forbid();

   var members = await store.ListMembershipsAsync(org.Value, ctx.RequestAborted);
   var items = new List<object>();
   foreach (var member in members)
   {
    if (driverDirectory == true && !member.RoleCodes.Contains("DRIVER")) continue;
    var user = await store.FindByIdAsync(member.UserId, ctx.RequestAborted);
    if (user is not null)
     items.Add(new { id = member.Id, userId = member.UserId, user.FullName, user.Email, user.Phone,
         member.Status, member.RoleCodes, member.RowVersion, user.CreatedAt });
   }
   return Results.Json(items);
  });
  group.MapPatch("/{id:guid}",async(HttpContext ctx,IIdentityRepository store,Guid id,OperatorStaffUpdate body)=>{
   var org=ctx.User.OrganizationId();if(org is null||!Allowed(ctx))return Results.Forbid();
   if(body.Role is not("DRIVER" or "OPERATOR_SCHEDULER" or "OPERATOR_ADMIN" or "OPERATOR_FINANCE" or "OPERATOR_OPERATIONS")||body.Status is not("ACTIVE" or "SUSPENDED"))return Results.BadRequest();
   var members=await store.ListMembershipsAsync(org.Value,ctx.RequestAborted);var m=members.FirstOrDefault(m=>m.Id==id);if(m is null)return Results.NotFound();
   if(m.RowVersion!=body.ExpectedVersion)return Results.Conflict();
   if(m.RoleCodes.Contains("OPERATOR_ADMIN")&&(body.Role!="OPERATOR_ADMIN"||body.Status!="ACTIVE")&&members.Count(m=>m.Status=="ACTIVE"&&m.RoleCodes.Contains("OPERATOR_ADMIN"))<=1)return Results.Conflict(new{message="Cần giữ ít nhất một quản trị viên đang hoạt động."});
   var changed=m with {Status=body.Status,RoleCodes=[body.Role],RowVersion=m.RowVersion+1};await store.UpdateMembershipAsync(changed,ctx.RequestAborted);await store.ReplaceUserRolesAsync(m.UserId,[body.Role],org.Value,ctx.RequestAborted);await store.RevokeUserSessionsAsync(m.UserId,"MEMBERSHIP_CHANGED",DateTimeOffset.UtcNow,ctx.RequestAborted);await store.InsertAuditAsync(ctx.User.UserId(),m.UserId,"operator.membership.update","SUCCESS",null,ctx.CorrelationId(),ctx.RequestAborted);return Results.Json(changed);
  });
  group.MapPost("/", CreateStaffAsync);
  group.MapPost("/{id:guid}/driver-password", ReissueDriverPasswordAsync);
 }

 private static async Task<IResult> ReissueDriverPasswordAsync(Guid id, HttpContext ctx, IIdentityRepository store, IPasswordHasher hasher)
 {
  ctx.Response.Headers.CacheControl = "no-store";
  var org = ctx.User.OrganizationId();
  if (org is null || !ctx.User.HasClaim("org_role", "OPERATOR_ADMIN"))
   return Results.Forbid();

  var ct = ctx.RequestAborted;
  var member = await store.GetMembershipAsync(org.Value, id, ct);
  if (member is null) return Results.NotFound();
  if (member.UserId == ctx.User.UserId() || member.Status != "ACTIVE" ||
      member.RoleCodes.Count != 1 || !member.RoleCodes.Contains("DRIVER"))
   return Results.Forbid();

  var user = await store.FindByIdAsync(member.UserId, ct);
  if (user is null) return Results.NotFound();
  if (user.Status == UserStatuses.Disabled || !IdentityNormalizer.IsEmail(user.Email))
   return Results.Conflict();

  var password = "Bl7-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(18)).ToLowerInvariant();
  if (!await store.ReissueDriverPasswordAsync(org.Value, member, user, hasher.Hash(password), ct))
   return Results.Conflict();

  await store.InsertAuditAsync(ctx.User.UserId(), user.Id, "operator.driver.password.reissue", "SUCCEEDED",
      null, ctx.CorrelationId(), ct);
  return Results.Json(new { user.Email, password });
 }

 private static async Task<IResult> CreateStaffAsync(HttpContext ctx, IIdentityRepository store, IPasswordHasher hasher, OperatorStaffInput body)
 {
  var org = ctx.User.OrganizationId();
  if (org is null || !Allowed(ctx)) return Results.Forbid();
  var role = body.Role ?? "DRIVER";
  var password = body.InitialPassword;
  if (password is not null && !ctx.User.HasClaim("org_role", "OPERATOR_ADMIN") && !ctx.User.IsInRole("PLATFORM_ADMIN"))
   return Results.Forbid();
  if (body.FullName?.Trim().Length is not (>= 2 and <= 120) ||
      body.Email is null || !IdentityNormalizer.IsEmail(body.Email) ||
      body.Phone is null || !System.Text.RegularExpressions.Regex.IsMatch(body.Phone, "^0[0-9]{9}$") ||
      role is not ("DRIVER" or "OPERATOR_SCHEDULER" or "OPERATOR_ADMIN" or "OPERATOR_FINANCE" or "OPERATOR_OPERATIONS") ||
      (password is not null && (role != "DRIVER" || !PasswordPolicy.IsSatisfied(password))))
   return Results.BadRequest();

  var ct = ctx.RequestAborted;
  var email = IdentityNormalizer.NormalizeEmail(body.Email);
  var user = await store.FindByNormalizedEmailAsync(email, ct);
  if (user is not null)
  {
   var members = await store.ListMembershipsAsync(org.Value, ct);
   var existing = members.FirstOrDefault(member => member.UserId == user.Id);
   if (existing is null || (password is not null &&
       (existing.Status != "ACTIVE" || !existing.RoleCodes.Contains(role) ||
        user.Status != UserStatuses.Active || user.Phone != body.Phone || !hasher.Verify(password, user.PasswordHash))))
    return HttpResults.Error(IdentityErrors.IdentityAlreadyUsed(), ctx.CorrelationId());
   return StaffResponse(user, existing);
  }

  if (await store.FindByNormalizedPhoneAsync(body.Phone, ct) is not null ||
      await store.FindByNormalizedPhoneAsync("+84" + body.Phone[1..], ct) is not null)
   return HttpResults.Error(IdentityErrors.IdentityAlreadyUsed(), ctx.CorrelationId());

  user = new UserRecord(Guid.NewGuid(), body.FullName.Trim(), body.Email.Trim(), email, body.Phone, body.Phone,
      hasher.Hash(password ?? Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))),
      password is null ? UserStatuses.PendingVerification : UserStatuses.Active,
      null, 0, null, 0, 0, DateTimeOffset.UtcNow);
  var membership = new MembershipRecord(Guid.NewGuid(), user.Id, org.Value, "ACTIVE", 0, [role]);
  if (!await store.InsertStaffAccountAsync(user, membership, role, ct))
   return HttpResults.Error(IdentityErrors.IdentityAlreadyUsed(), ctx.CorrelationId());

  ctx.Response.Headers.CacheControl = "no-store";
  return StaffResponse(user, membership);
 }

 private static IResult StaffResponse(UserRecord user, MembershipRecord member) =>
     Results.Json(new { userId = user.Id, id = member.Id, user.FullName, user.Email, user.Phone,
         member.Status, member.RoleCodes, member.RowVersion, user.CreatedAt }, statusCode: 201);

 private static bool Allowed(HttpContext ctx)=>ctx.User.IsInRole("OPERATOR_ADMIN")||ctx.User.IsInRole("PLATFORM_ADMIN");
}
