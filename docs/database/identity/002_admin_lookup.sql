CREATE INDEX IF NOT EXISTS ix_users_admin_lookup
    ON users (created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_membership_user_organization
    ON organization_memberships (user_id, organization_id_external);
