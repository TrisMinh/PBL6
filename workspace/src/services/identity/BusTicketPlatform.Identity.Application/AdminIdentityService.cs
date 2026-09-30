using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.BuildingBlocks.Time;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Application;

public sealed class AdminIdentityService(IIdentityRepository users, IClock clock, IIdGenerator ids)
{
    public async Task<Result<UserPageDto>> ListUsersAsync(int page, int size, CancellationToken cancellationToken)
    {
        page = Math.Max(page, 0);
        size = Math.Clamp(size, 1, 100);
        var (items, total) = await users.ListUsersAsync(page, size, cancellationToken);
        var mapped = new List<UserProfileDto>();
        foreach (var item in items)
        {
            mapped.Add(await ProfileMapper.MapAsync(item, users, cancellationToken));
        }

        var pages = (int)Math.Ceiling(total / (double)size);
        return Result<UserPageDto>.Success(new UserPageDto(page, size, total, pages, mapped));
    }

    public async Task<Result<UserProfileDto>> GetUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId, cancellationToken);
        return user is null
            ? Result<UserProfileDto>.Failure(IdentityErrors.NotFound())
            : Result<UserProfileDto>.Success(await ProfileMapper.MapAsync(user, users, cancellationToken));
    }

    public async Task<Result<UserProfileDto>> ChangeStatusAsync(ChangeStatusCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (command.ActorId == command.UserId)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.AccessDenied());
        }

        var user = await users.FindByIdAsync(command.UserId, cancellationToken);
        if (user is null)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.NotFound());
        }

        if (user.RowVersion != command.ExpectedVersion)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.VersionConflict());
        }

        if (command.Status is not (UserStatuses.Active or UserStatuses.Locked or UserStatuses.Disabled))
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.Validation("Status is invalid.", "status"));
        }

        var roles = await users.GetRoleCodesAsync(user.Id, cancellationToken);
        if (roles.Contains(RoleCodes.PlatformAdmin, StringComparer.Ordinal)
            && command.Status != UserStatuses.Active
            && await users.CountPlatformAdminsAsync(cancellationToken) <= 1)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.AccessDenied());
        }

        var updated = user with
        {
            Status = command.Status,
            AuthorizationVersion = user.AuthorizationVersion + 1,
            RowVersion = user.RowVersion + 1,
            LockoutUntil = command.Status == UserStatuses.Locked ? clock.UtcNow.AddYears(50) : null
        };
        await users.UpdateUserAsync(updated, cancellationToken);
        if (command.Status != UserStatuses.Active)
        {
            await users.RevokeUserSessionsAsync(user.Id, "STATUS_" + command.Status, clock.UtcNow, cancellationToken);
        }

        await users.InsertAuditAsync(command.ActorId, user.Id, "USER_STATUS", "SUCCEEDED", command.Reason, correlationId, cancellationToken);
        return Result<UserProfileDto>.Success(await ProfileMapper.MapAsync(updated, users, cancellationToken));
    }

    public async Task<Result<UserProfileDto>> ReplaceRolesAsync(ReplaceRolesCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (command.ActorId == command.UserId)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.AccessDenied());
        }

        var user = await users.FindByIdAsync(command.UserId, cancellationToken);
        if (user is null)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.NotFound());
        }

        if (user.RowVersion != command.ExpectedVersion)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.VersionConflict());
        }

        var current = await users.GetRoleCodesAsync(user.Id, cancellationToken);
        if (current.Contains(RoleCodes.PlatformAdmin, StringComparer.Ordinal)
            && !command.RoleCodes.Contains(RoleCodes.PlatformAdmin, StringComparer.Ordinal)
            && await users.CountPlatformAdminsAsync(cancellationToken) <= 1)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.AccessDenied());
        }

        await users.ReplaceUserRolesAsync(user.Id, command.RoleCodes, null, cancellationToken);
        var updated = user with { AuthorizationVersion = user.AuthorizationVersion + 1, RowVersion = user.RowVersion + 1 };
        await users.UpdateUserAsync(updated, cancellationToken);
        await users.RevokeUserSessionsAsync(user.Id, "ROLES_REPLACED", clock.UtcNow, cancellationToken);
        await users.InsertAuditAsync(command.ActorId, user.Id, "USER_ROLES", "SUCCEEDED", command.Reason, correlationId, cancellationToken);
        return Result<UserProfileDto>.Success(await ProfileMapper.MapAsync(updated, users, cancellationToken));
    }

    public async Task<Result<IReadOnlyList<MembershipDto>>> ListMembershipsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var items = await users.ListMembershipsAsync(organizationId, cancellationToken);
        return Result<IReadOnlyList<MembershipDto>>.Success(Map(items));
    }

    public async Task<Result<MembershipDto>> AddMembershipAsync(MembershipCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(command.UserId, cancellationToken);
        if (user is null)
        {
            return Result<MembershipDto>.Failure(IdentityErrors.NotFound());
        }

        var membership = new MembershipRecord(
            ids.NewUuidV7(),
            command.UserId,
            command.OrganizationId,
            command.Status,
            0,
            command.RoleCodes);
        await users.InsertMembershipAsync(membership, cancellationToken);
        await users.ReplaceUserRolesAsync(command.UserId, command.RoleCodes, command.OrganizationId, cancellationToken);
        await users.InsertAuditAsync(command.ActorId, command.UserId, "MEMBERSHIP_ADD", "SUCCEEDED", command.Reason, correlationId, cancellationToken);
        return Result<MembershipDto>.Success(Map(membership));
    }

    public async Task<Result<MembershipDto>> ChangeMembershipAsync(MembershipCommand command, Guid correlationId, CancellationToken cancellationToken)
    {
        if (command.MembershipId is null)
        {
            return Result<MembershipDto>.Failure(IdentityErrors.Validation("Membership is required.", "membershipId"));
        }

        var existing = await users.GetMembershipAsync(command.OrganizationId, command.MembershipId.Value, cancellationToken);
        if (existing is null)
        {
            return Result<MembershipDto>.Failure(IdentityErrors.NotFound());
        }

        if (existing.RowVersion != command.ExpectedVersion)
        {
            return Result<MembershipDto>.Failure(IdentityErrors.VersionConflict());
        }

        var updated = existing with
        {
            Status = command.Status,
            RoleCodes = command.RoleCodes,
            RowVersion = existing.RowVersion + 1
        };
        await users.UpdateMembershipAsync(updated, cancellationToken);
        await users.ReplaceUserRolesAsync(existing.UserId, command.RoleCodes, command.OrganizationId, cancellationToken);
        if (command.Status != "ACTIVE")
        {
            await users.RevokeUserSessionsAsync(existing.UserId, "MEMBERSHIP_" + command.Status, clock.UtcNow, cancellationToken);
        }

        await users.InsertAuditAsync(command.ActorId, existing.UserId, "MEMBERSHIP_CHANGE", "SUCCEEDED", command.Reason, correlationId, cancellationToken);
        return Result<MembershipDto>.Success(Map(updated));
    }

    private static IReadOnlyList<MembershipDto> Map(IReadOnlyList<MembershipRecord> items) =>
        items.Select(Map).ToArray();

    private static MembershipDto Map(MembershipRecord item) =>
        new(item.Id, item.UserId, item.OrganizationId, item.Status, item.RoleCodes, item.RowVersion);
}
