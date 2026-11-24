using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.Identity.Application;
using Npgsql;
using NpgsqlTypes;

namespace BusTicketPlatform.Identity.Infrastructure.Persistence;

public sealed class IdentityRepository(IdentityDatabaseOptions options, IIdGenerator ids) : IIdentityRepository
{
    public Task<UserRecord?> FindByIdAsync(Guid id, CancellationToken cancellationToken) =>
        FindAsync("id = @id", ("id", id), cancellationToken);

    public Task<UserRecord?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        FindAsync("normalized_email = @value AND deleted_at IS NULL", ("value", normalizedEmail), cancellationToken);

    public Task<UserRecord?> FindByNormalizedPhoneAsync(string normalizedPhone, CancellationToken cancellationToken) =>
        FindAsync("normalized_phone = @value AND deleted_at IS NULL", ("value", normalizedPhone), cancellationToken);

    public Task<UserRecord?> FindByIdentifierAsync(string identifier, CancellationToken cancellationToken)
    {
        var trimmed = identifier.Trim();
        if (trimmed.Contains('@', StringComparison.Ordinal))
        {
            return FindByNormalizedEmailAsync(trimmed.ToUpperInvariant(), cancellationToken);
        }

        return FindByNormalizedPhoneAsync(trimmed, cancellationToken);
    }

    public async Task InsertUserAsync(UserRecord user, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO users (
              id, full_name, email, normalized_email, phone, normalized_phone, password_hash,
              status, email_verified_at, failed_login_count, lockout_until, authorization_version,
              created_at, updated_at, row_version)
            VALUES (
              @id, @fullName, @email, @nemail, @phone, @nphone, @hash,
              @status, @verified, @failures, @lockout, @authv, @created, @created, @rowVersion);
            """, connection);
        BindUser(command, user);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateUserAsync(UserRecord user, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE users SET
              full_name = @fullName, email = @email, normalized_email = @nemail,
              phone = @phone, normalized_phone = @nphone, password_hash = @hash, status = @status,
              email_verified_at = @verified, failed_login_count = @failures, lockout_until = @lockout,
              authorization_version = @authv, updated_at = NOW(), row_version = @rowVersion
            WHERE id = @id;
            """, connection);
        BindUser(command, user);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task AssignRoleAsync(Guid userId, string roleCode, Guid? organizationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO user_roles (id, user_id, role_id, organization_id_external, active, created_at)
            SELECT @id, @userId, r.id, @org, true, NOW()
            FROM roles r
            WHERE r.code = @code;
            """, connection);
        command.Parameters.AddWithValue("id", ids.NewUuidV7());
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("org", (object?)organizationId ?? DBNull.Value);
        command.Parameters.AddWithValue("code", roleCode);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task ReplaceUserRolesAsync(
        Guid userId,
        IReadOnlyList<string> roleCodes,
        Guid? organizationId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        await using (var delete = new NpgsqlCommand(
                         organizationId is null
                             ? "UPDATE user_roles SET active = false, ended_at = NOW() WHERE user_id = @userId AND organization_id_external IS NULL AND active"
                             : "UPDATE user_roles SET active = false, ended_at = NOW() WHERE user_id = @userId AND organization_id_external = @org AND active",
                         connection, tx))
        {
            delete.Parameters.AddWithValue("userId", userId);
            if (organizationId is not null)
            {
                delete.Parameters.AddWithValue("org", organizationId.Value);
            }

            await delete.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var code in roleCodes)
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO user_roles (id, user_id, role_id, organization_id_external, active, created_at)
                SELECT @id, @userId, r.id, @org, true, NOW()
                FROM roles r WHERE r.code = @code;
                """, connection, tx);
            insert.Parameters.AddWithValue("id", ids.NewUuidV7());
            insert.Parameters.AddWithValue("userId", userId);
            insert.Parameters.AddWithValue("org", (object?)organizationId ?? DBNull.Value);
            insert.Parameters.AddWithValue("code", code);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetRoleCodesAsync(Guid userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT r.code FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = @userId AND ur.active AND ur.organization_id_external IS NULL;
            """, connection);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var roles = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            roles.Add(reader.GetString(0));
        }

        return roles;
    }

    public async Task<int> CountPlatformAdminsAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT COUNT(DISTINCT ur.user_id)
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            JOIN users u ON u.id = ur.user_id
            WHERE r.code = 'PLATFORM_ADMIN' AND ur.active AND u.status = 'ACTIVE' AND u.deleted_at IS NULL;
            """, connection);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result);
    }

    public async Task InsertChallengeAsync(ChallengeRecord challenge, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO auth_challenges (
              id, user_id, target_normalized, challenge_type, token_hash, status,
              failed_attempts, created_at, expires_at)
            VALUES (@id, @userId, @target, @type, @hash, @status, @attempts, NOW(), @expires);
            """, connection);
        command.Parameters.AddWithValue("id", challenge.Id);
        command.Parameters.AddWithValue("userId", (object?)challenge.UserId ?? DBNull.Value);
        command.Parameters.AddWithValue("target", challenge.TargetNormalized);
        command.Parameters.AddWithValue("type", challenge.ChallengeType);
        command.Parameters.AddWithValue("hash", challenge.TokenHash);
        command.Parameters.AddWithValue("status", challenge.Status);
        command.Parameters.AddWithValue("attempts", challenge.FailedAttempts);
        command.Parameters.AddWithValue("expires", challenge.ExpiresAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<ChallengeRecord?> GetChallengeAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, user_id, target_normalized, challenge_type, token_hash, status, failed_attempts, expires_at
            FROM auth_challenges WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new ChallengeRecord(
            reader.GetGuid(0),
            reader.IsDBNull(1) ? null : reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetInt32(6),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)));
    }

    public async Task UpdateChallengeAsync(ChallengeRecord challenge, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE auth_challenges
            SET status = @status, failed_attempts = @attempts,
                consumed_at = CASE WHEN @status = 'CONSUMED' THEN NOW() ELSE consumed_at END,
                row_version = row_version + 1
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", challenge.Id);
        command.Parameters.AddWithValue("status", challenge.Status);
        command.Parameters.AddWithValue("attempts", challenge.FailedAttempts);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task RevokeActiveChallengesAsync(Guid userId, string challengeType, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE auth_challenges SET status = 'REVOKED'
            WHERE user_id = @userId AND challenge_type = @type AND status = 'ACTIVE';
            """, connection);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("type", challengeType);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task InsertSessionAsync(SessionRecord session, DateTimeOffset issuedAt, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO refresh_sessions (
              id, user_id, family_id, token_hash, issued_at, expires_at)
            VALUES (@id, @userId, @family, @hash, @issued, @expires);
            """, connection);
        command.Parameters.AddWithValue("id", session.Id);
        command.Parameters.AddWithValue("userId", session.UserId);
        command.Parameters.AddWithValue("family", session.FamilyId);
        command.Parameters.AddWithValue("hash", session.TokenHash);
        command.Parameters.AddWithValue("issued", issuedAt.UtcDateTime);
        command.Parameters.AddWithValue("expires", session.ExpiresAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<SessionRecord?> FindSessionByTokenHashAsync(string tokenHash, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT id, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by_session_id
            FROM refresh_sessions WHERE token_hash = @hash;
            """, connection);
        command.Parameters.AddWithValue("hash", tokenHash);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new SessionRecord(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            reader.GetString(3),
            new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
            reader.IsDBNull(5) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)),
            reader.IsDBNull(6) ? null : reader.GetGuid(6));
    }

    public async Task<bool> IsSessionActiveAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT EXISTS (SELECT 1 FROM refresh_sessions
                WHERE id = @id AND user_id = @user AND revoked_at IS NULL AND expires_at > NOW());
            """, connection);
        command.Parameters.AddWithValue("id", sessionId);
        command.Parameters.AddWithValue("user", userId);
        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }

    public async Task UpdateSessionAsync(SessionRecord session, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE refresh_sessions
            SET revoked_at = @revoked, replaced_by_session_id = @replaced, revoke_reason = COALESCE(revoke_reason, 'ROTATED')
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", session.Id);
        command.Parameters.AddWithValue("revoked", (object?)session.RevokedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("replaced", (object?)session.ReplacedBySessionId ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task RevokeFamilyAsync(Guid familyId, string reason, DateTimeOffset revokedAt, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE refresh_sessions
            SET revoked_at = COALESCE(revoked_at, @revoked), revoke_reason = @reason
            WHERE family_id = @family AND revoked_at IS NULL;
            """, connection);
        command.Parameters.AddWithValue("family", familyId);
        command.Parameters.AddWithValue("reason", reason);
        command.Parameters.AddWithValue("revoked", revokedAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task RevokeUserSessionsAsync(Guid userId, string reason, DateTimeOffset revokedAt, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE refresh_sessions
            SET revoked_at = COALESCE(revoked_at, @revoked), revoke_reason = @reason
            WHERE user_id = @userId AND revoked_at IS NULL;
            """, connection);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("reason", reason);
        command.Parameters.AddWithValue("revoked", revokedAt.UtcDateTime);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task InsertAuditAsync(
        Guid? actorId,
        Guid? targetUserId,
        string action,
        string result,
        string? reasonCode,
        Guid correlationId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO security_audits (id, actor_id, target_user_id, action, result, reason_code, correlation_id, occurred_at)
            VALUES (@id, @actor, @target, @action, @result, @reason, @correlation, NOW());
            """, connection);
        command.Parameters.AddWithValue("id", ids.NewUuidV7());
        command.Parameters.AddWithValue("actor", (object?)actorId ?? DBNull.Value);
        command.Parameters.AddWithValue("target", (object?)targetUserId ?? DBNull.Value);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("result", result);
        command.Parameters.AddWithValue("reason", (object?)reasonCode ?? DBNull.Value);
        command.Parameters.AddWithValue("correlation", correlationId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<int> CountRecentAuditsAsync(
        string action,
        string reasonCode,
        DateTimeOffset since,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT COUNT(*)
            FROM security_audits
            WHERE action = @action AND reason_code = @reason AND occurred_at >= @since;
            """, connection);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("reason", reasonCode);
        command.Parameters.AddWithValue("since", since.UtcDateTime);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result);
    }

    public async Task<(IReadOnlyList<UserProfileDto> Items, long Total)> ListUsersAsync(int page, int size, UserListFilter filters,
        CancellationToken cancellationToken)
    {
        const string filter = """
            deleted_at IS NULL
            AND (@active IS NULL OR (status = 'ACTIVE') = @active)
            AND (@org IS NULL OR EXISTS (
                SELECT 1 FROM organization_memberships m
                WHERE m.organization_id_external = @org AND m.user_id = users.id
                  AND (@membershipActive IS NULL OR (m.status = 'ACTIVE') = @membershipActive)
                  AND (@membershipActive IS DISTINCT FROM FALSE OR m.status <> 'ENDED' OR NOT EXISTS (
                      SELECT 1 FROM organization_memberships current_membership
                      WHERE current_membership.organization_id_external = @org
                        AND current_membership.user_id = m.user_id AND current_membership.status = 'ACTIVE'
                  ))
            ))
            AND (NOT @staffOnly OR EXISTS (
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.active AND ur.user_id = users.id AND (
                    (@org IS NULL AND ur.organization_id_external IS NULL AND r.code = 'PLATFORM_SUPPORT')
                    OR (r.code IN ('OPERATOR_ADMIN', 'OPERATOR_SCHEDULER', 'DRIVER') AND EXISTS (
                        SELECT 1 FROM organization_memberships m
                        WHERE m.user_id = ur.user_id AND m.organization_id_external = ur.organization_id_external
                          AND (@org IS NULL OR m.organization_id_external = @org)
                    ))
                )
            ))
            AND (@search = '' OR strpos(lower(concat_ws(' ', full_name, email, phone)), lower(@search)) > 0)
            """;
        await using var connection = await OpenAsync(cancellationToken);
        await using var count = new NpgsqlCommand($"SELECT COUNT(*) FROM users WHERE {filter}", connection);
        await using var command = new NpgsqlCommand($"""
            WITH page_users AS (
                SELECT id, full_name, email, phone, status, row_version, created_at
                FROM users WHERE {filter}
                ORDER BY created_at DESC, id DESC
                OFFSET @offset LIMIT @limit
            )
            SELECT u.*, {RoleArray("u.id", "ur.organization_id_external IS NULL")}
            FROM page_users u
            ORDER BY u.created_at DESC, u.id DESC;
            """, connection);
        foreach (var query in new[] { count, command })
        {
            query.Parameters.AddWithValue("org", NpgsqlDbType.Uuid, (object?)filters.OrganizationId ?? DBNull.Value);
            query.Parameters.AddWithValue("search", filters.Search ?? "");
            query.Parameters.AddWithValue("staffOnly", filters.StaffOnly);
            query.Parameters.AddWithValue("active", NpgsqlDbType.Boolean, (object?)filters.Active ?? DBNull.Value);
            query.Parameters.AddWithValue("membershipActive", NpgsqlDbType.Boolean, (object?)filters.MembershipActive ?? DBNull.Value);
        }
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
        command.Parameters.AddWithValue("offset", (long)page * size);
        command.Parameters.AddWithValue("limit", size);
        var items = new List<UserProfileDto>();
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new UserProfileDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
                    reader.GetString(3), reader.GetString(4), reader.GetFieldValue<string[]>(7), [],
                    reader.GetInt64(5), reader.GetFieldValue<DateTimeOffset>(6)));
            }
        }

        if (items.Count == 0) return (items, total);
        await using var membershipsCommand = new NpgsqlCommand($"""
            {MembershipSelect} WHERE m.user_id = ANY(@ids)
            ORDER BY (m.status = 'ENDED'), m.created_at DESC, m.id;
            """, connection);
        membershipsCommand.Parameters.AddWithValue("ids", items.Select(item => item.Id).ToArray());
        var memberships = (await ReadMembershipsAsync(membershipsCommand, cancellationToken)).ToLookup(item => item.UserId);
        return (items.Select(item => item with
        {
            OrganizationMemberships = memberships[item.Id].Select(m =>
                new MembershipDto(m.Id, m.UserId, m.OrganizationId, m.Status, m.RoleCodes, m.RowVersion, m.CreatedAt)).ToArray()
        }).ToArray(), total);
    }

    private static string RoleArray(string userId, string scope) => $"""
        ARRAY(SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = {userId} AND {scope} AND ur.active)
        """;

    private static readonly string MembershipSelect = $"""
        SELECT m.id, m.user_id, m.organization_id_external, m.status, m.row_version, m.created_at,
               {RoleArray("m.user_id", "ur.organization_id_external = m.organization_id_external")}
        FROM organization_memberships m
        """;

    public async Task<IReadOnlyList<MembershipRecord>> GetMembershipsForUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand($"{MembershipSelect} WHERE m.user_id = @userId;", connection);
        command.Parameters.AddWithValue("userId", userId);
        return await ReadMembershipsAsync(command, cancellationToken);
    }

    public async Task<IReadOnlyList<MembershipRecord>> ListMembershipsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand($"{MembershipSelect} WHERE m.organization_id_external = @org;", connection);
        command.Parameters.AddWithValue("org", organizationId);
        return await ReadMembershipsAsync(command, cancellationToken);
    }

    public async Task<MembershipRecord?> GetMembershipAsync(Guid organizationId, Guid membershipId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            $"{MembershipSelect} WHERE m.organization_id_external = @org AND m.id = @id;", connection);
        command.Parameters.AddWithValue("org", organizationId);
        command.Parameters.AddWithValue("id", membershipId);
        return (await ReadMembershipsAsync(command, cancellationToken)).SingleOrDefault();
    }

    public async Task InsertMembershipAsync(MembershipRecord membership, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            INSERT INTO organization_memberships (
              id, user_id, organization_id_external, status, started_at, created_at, updated_at)
            VALUES (@id, @userId, @org, @status, NOW(), NOW(), NOW());
            """, connection);
        command.Parameters.AddWithValue("id", membership.Id);
        command.Parameters.AddWithValue("userId", membership.UserId);
        command.Parameters.AddWithValue("org", membership.OrganizationId);
        command.Parameters.AddWithValue("status", membership.Status);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateMembershipAsync(MembershipRecord membership, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            UPDATE organization_memberships
            SET status = @status, updated_at = NOW(), row_version = @version,
                ended_at = CASE WHEN @status = 'ENDED' THEN NOW() ELSE ended_at END
            WHERE id = @id;
            """, connection);
        command.Parameters.AddWithValue("id", membership.Id);
        command.Parameters.AddWithValue("status", membership.Status);
        command.Parameters.AddWithValue("version", membership.RowVersion);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<IReadOnlyList<MembershipRecord>> ReadMembershipsAsync(
        NpgsqlCommand command,
        CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var result = new List<MembershipRecord>();
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new MembershipRecord(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2),
                reader.GetString(3), reader.GetInt64(4), reader.GetFieldValue<string[]>(6),
                reader.GetFieldValue<DateTimeOffset>(5)));
        }

        return result;
    }

    private async Task<UserRecord?> FindAsync(string where, (string Name, object Value) parameter, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand($"SELECT {UserColumns} FROM users WHERE {where} LIMIT 1", connection);
        command.Parameters.AddWithValue(parameter.Name, parameter.Value);
        var users = await ReadUsersAsync(command, cancellationToken);
        return users.Count == 0 ? null : users[0];
    }

    private static async Task<List<UserRecord>> ReadUsersAsync(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<UserRecord>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new UserRecord(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                reader.GetString(7),
                reader.IsDBNull(8) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)),
                reader.GetInt32(9),
                reader.IsDBNull(10) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(10), DateTimeKind.Utc)),
                reader.GetInt64(11),
                reader.GetInt64(12),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(13), DateTimeKind.Utc))));
        }

        return items;
    }

    private const string UserColumns = """
        id, full_name, email, normalized_email, phone, normalized_phone, password_hash, status,
        email_verified_at, failed_login_count, lockout_until, authorization_version, row_version, created_at
        """;

    private static void BindUser(NpgsqlCommand command, UserRecord user)
    {
        command.Parameters.AddWithValue("id", user.Id);
        command.Parameters.AddWithValue("fullName", user.FullName);
        command.Parameters.AddWithValue("email", user.Email);
        command.Parameters.AddWithValue("nemail", user.NormalizedEmail);
        command.Parameters.AddWithValue("phone", user.Phone);
        command.Parameters.AddWithValue("nphone", user.NormalizedPhone);
        command.Parameters.AddWithValue("hash", user.PasswordHash);
        command.Parameters.AddWithValue("status", user.Status);
        command.Parameters.AddWithValue("verified", (object?)user.EmailVerifiedAt?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("failures", user.FailedLoginCount);
        command.Parameters.AddWithValue("lockout", (object?)user.LockoutUntil?.UtcDateTime ?? DBNull.Value);
        command.Parameters.AddWithValue("authv", user.AuthorizationVersion);
        command.Parameters.AddWithValue("created", user.CreatedAt.UtcDateTime);
        command.Parameters.AddWithValue("rowVersion", user.RowVersion);
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
