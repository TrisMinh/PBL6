using BusTicketPlatform.BuildingBlocks.Results;
using BusTicketPlatform.Identity.Domain;

namespace BusTicketPlatform.Identity.Application;

public sealed class ProfileService(IIdentityRepository users, AuthService auth)
{
    public async Task<Result<UserProfileDto>> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            return Result<UserProfileDto>.Failure(IdentityErrors.AuthenticationRequired());
        }

        return Result<UserProfileDto>.Success(await ProfileMapper.MapAsync(user, users, cancellationToken));
    }

    public async Task<Result<(UserProfileDto Profile, bool Accepted)>> UpdateAsync(
        UpdateProfileCommand command,
        Guid correlationId,
        CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(command.UserId, cancellationToken);
        if (user is null)
        {
            return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.AuthenticationRequired());
        }

        if (user.RowVersion != command.ExpectedVersion)
        {
            return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.VersionConflict());
        }

        var fullName = command.FullName is null ? user.FullName : command.FullName.Trim();
        if (!IdentityNormalizer.IsFullName(fullName))
        {
            return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.Validation("Full name is invalid.", "fullName"));
        }

        var phone = user.Phone;
        var normalizedPhone = user.NormalizedPhone;
        var pendingEmail = (string?)null;

        if (command.Email is not null && IdentityNormalizer.NormalizeEmail(command.Email) != user.NormalizedEmail)
        {
            if (!IdentityNormalizer.IsEmail(command.Email))
            {
                return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.Validation("Email is invalid.", "email"));
            }

            var taken = await users.FindByNormalizedEmailAsync(IdentityNormalizer.NormalizeEmail(command.Email), cancellationToken);
            if (taken is not null)
            {
                return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.IdentityAlreadyUsed());
            }

            pendingEmail = command.Email.Trim();
        }

        if (command.Phone is not null && IdentityNormalizer.NormalizePhone(command.Phone) != user.NormalizedPhone)
        {
            if (!IdentityNormalizer.IsPhone(command.Phone))
            {
                return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.Validation("Phone is invalid.", "phone"));
            }

            var taken = await users.FindByNormalizedPhoneAsync(IdentityNormalizer.NormalizePhone(command.Phone), cancellationToken);
            if (taken is not null)
            {
                return Result<(UserProfileDto, bool)>.Failure(IdentityErrors.IdentityAlreadyUsed());
            }

            phone = IdentityNormalizer.NormalizePhone(command.Phone);
            normalizedPhone = phone;
        }

        var updated = user with
        {
            FullName = fullName,
            Phone = phone,
            NormalizedPhone = normalizedPhone,
            RowVersion = user.RowVersion + 1
        };
        await users.UpdateUserAsync(updated, cancellationToken);

        if (pendingEmail is not null)
        {
            await auth.IssueEmailChangeAsync(updated, pendingEmail, correlationId, cancellationToken);
            await users.InsertAuditAsync(user.Id, user.Id, "PROFILE_EMAIL_PENDING", "SUCCEEDED", null, correlationId, cancellationToken);
            return Result<(UserProfileDto, bool)>.Success((await ProfileMapper.MapAsync(updated, users, cancellationToken), true));
        }

        await users.InsertAuditAsync(user.Id, user.Id, "PROFILE_UPDATED", "SUCCEEDED", null, correlationId, cancellationToken);
        return Result<(UserProfileDto, bool)>.Success((await ProfileMapper.MapAsync(updated, users, cancellationToken), false));
    }
}
