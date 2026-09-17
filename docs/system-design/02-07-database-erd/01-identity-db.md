# Identity Database ERD

Database: `identity_db`. Cột trên hình khớp migration [`docs/database/identity/001_initial.sql`](../../database/identity/001_initial.sql). `organization_id_external` tham chiếu định danh do Transport Service sở hữu nhưng không có foreign key.

`roles` không có cột `name`. Nhãn đọc được của role là `description`; định danh máy dùng là `code`.

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar email
        varchar normalized_email UK
        varchar phone
        varchar normalized_phone UK
        varchar full_name
        varchar password_hash
        varchar status
        timestamptz email_verified_at
        int failed_login_count
        timestamptz lockout_until
        bigint authorization_version
        timestamptz deleted_at
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    ROLES {
        uuid id PK
        varchar code UK
        varchar scope
        varchar description
        boolean system_role
        timestamptz created_at
    }
    PERMISSIONS {
        uuid id PK
        varchar code UK
        varchar scope
        varchar resource
        varchar action
        timestamptz created_at
    }
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
        uuid organization_id_external
        boolean active
        timestamptz created_at
        timestamptz ended_at
    }
    ROLE_PERMISSIONS {
        uuid role_id PK,FK
        uuid permission_id PK,FK
    }
    ORGANIZATION_MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid organization_id_external
        varchar status
        timestamptz started_at
        timestamptz ended_at
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    REFRESH_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid family_id
        varchar token_hash UK
        timestamptz issued_at
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by_session_id FK
        varchar revoke_reason
        varchar user_agent_hash
        varchar ip_hash
    }
    AUTH_CHALLENGES {
        uuid id PK
        uuid user_id FK
        varchar target_normalized
        varchar challenge_type
        varchar token_hash UK
        varchar status
        int failed_attempts
        timestamptz created_at
        timestamptz expires_at
        timestamptz consumed_at
        bigint row_version
    }
    SECURITY_AUDITS {
        uuid id PK
        uuid actor_id
        uuid target_user_id
        varchar action
        varchar result
        varchar reason_code
        uuid correlation_id
        jsonb safe_metadata
        timestamptz occurred_at
    }

    USERS ||--o{ USER_ROLES : receives
    ROLES ||--o{ USER_ROLES : assigned
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included
    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : joins
    USERS ||--o{ REFRESH_SESSIONS : owns
    REFRESH_SESSIONS o|--o| REFRESH_SESSIONS : rotates_to
    USERS ||--o{ AUTH_CHALLENGES : verifies_with
    USERS o|--o{ SECURITY_AUDITS : acts_in
```

## Constraints và index bắt buộc

- Partial unique trên `normalized_email` và `normalized_phone` khi `deleted_at is null`.
- `roles.scope` chỉ `PLATFORM`, `TENANT`, `OWN`. Role không có `name`.
- `permissions.code` unique; thêm unique `(scope, resource, action)`. `permissions.scope` chỉ `PLATFORM`, `TENANT`, `REPORT`.
- Role platform/OWN: partial unique `(user_id, role_id)` khi `active` và `organization_id_external is null`. Role tenant: partial unique `(user_id, role_id, organization_id_external)` khi `active` và org khác null.
- Membership: partial unique `(user_id, organization_id_external)` khi status `ACTIVE` hoặc `SUSPENDED`.
- Token/challenge chỉ lưu hash; index expiry phục vụ cleanup, không dùng token rõ làm lookup/log.
- `security_audits` append-only đối với application role thông thường; `actor_id` / `target_user_id` không có FK.
