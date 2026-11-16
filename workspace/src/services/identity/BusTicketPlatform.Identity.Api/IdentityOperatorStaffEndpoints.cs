using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using BusTicketPlatform.BuildingBlocks.AspNetCore.Http;
using BusTicketPlatform.Identity.Application;

namespace BusTicketPlatform.Identity.Api;
public sealed record OperatorStaffInput(string FullName,string Email,string Phone,string? Role);
public sealed record OperatorStaffUpdate(string Role,string Status,long ExpectedVersion);
public static class IdentityOperatorStaffEndpoints
{
 public static void MapOperatorStaff(this IEndpointRouteBuilder endpoints)
 {
  var group=endpoints.MapGroup("/api/v1/operator/staff").RequireAuthorization();
  group.MapGet("/",async(HttpContext ctx,IIdentityRepository store)=>{
   var org=ctx.User.OrganizationId();if(org is null||!Allowed(ctx))return Results.Forbid();
   var members=await store.ListMembershipsAsync(org.Value,ctx.RequestAborted);
   var items=new List<object>();foreach(var m in members){var user=await store.FindByIdAsync(m.UserId,ctx.RequestAborted);if(user is not null)items.Add(new {id=m.Id,userId=m.UserId,user.FullName,user.Email,user.Phone,m.Status,m.RoleCodes,m.RowVersion,user.CreatedAt});}
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
  group.MapPost("/",async(HttpContext ctx,IIdentityRepository store,IPasswordHasher hasher,OperatorStaffInput body)=>{
   var org=ctx.User.OrganizationId();if(org is null||!Allowed(ctx))return Results.Forbid();
   if(body.FullName.Trim().Length is <2 or >120||!System.Net.Mail.MailAddress.TryCreate(body.Email,out _)||!System.Text.RegularExpressions.Regex.IsMatch(body.Phone,"^0[0-9]{9}$"))return Results.BadRequest();
   var role=body.Role??"DRIVER";if(role is not("DRIVER" or "OPERATOR_SCHEDULER" or "OPERATOR_ADMIN" or "OPERATOR_FINANCE" or "OPERATOR_OPERATIONS"))return Results.BadRequest();
   var user=await store.FindByNormalizedEmailAsync(body.Email.Trim().ToUpperInvariant(),ctx.RequestAborted);
   var members=await store.ListMembershipsAsync(org.Value,ctx.RequestAborted);
   if(user is not null&&!members.Any(m=>m.UserId==user.Id))return Results.Conflict(new{message="Email đã thuộc tài khoản khác. Quản trị viên hệ thống cần thêm tài khoản này vào tổ chức."});
   if(user is null){if(await store.FindByNormalizedPhoneAsync(body.Phone,ctx.RequestAborted)is not null)return Results.Conflict();user=new UserRecord(Guid.NewGuid(),body.FullName.Trim(),body.Email.Trim(),body.Email.Trim().ToUpperInvariant(),body.Phone,body.Phone,hasher.Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))),"PENDING_VERIFICATION",null,0,null,0,0,DateTimeOffset.UtcNow);await store.InsertUserAsync(user,ctx.RequestAborted);}
   var member=members.FirstOrDefault(m=>m.UserId==user.Id);
   if(member is null){member=new MembershipRecord(Guid.NewGuid(),user.Id,org.Value,"ACTIVE",0,[role]);await store.InsertMembershipAsync(member,ctx.RequestAborted);await store.AssignRoleAsync(user.Id,role,org.Value,ctx.RequestAborted);}
   return Results.Json(new {userId=user.Id,id=member.Id,user.FullName,user.Email,user.Phone,member.Status,member.RoleCodes,member.RowVersion,user.CreatedAt},statusCode:201);
  });
 }
 private static bool Allowed(HttpContext ctx)=>ctx.User.IsInRole("OPERATOR_ADMIN")||ctx.User.IsInRole("PLATFORM_ADMIN");
}
