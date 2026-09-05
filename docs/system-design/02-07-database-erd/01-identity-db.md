# Identity Database ERD

Database: `identity_db`. `organization_id_external` tham chiếu định danh do Transport Service sở hữu nhưng không có foreign key.

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar normalized_email UK
        varchar normalized_phone UK
        varchar full_name
        varchar password_hash
        varchar status
        timestamptz verified_at
        bigint row_version
        timestamptz created_at
        timestamptz updated_at
    }
    ROLES {
        uuid id PK
        varchar code UK
        varchar scope
        varchar name
        timestamptz created_at
    }
    PERMISSIONS {
        uuid id PK
        varchar resource
        varchar action
        varchar description
    }
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
        uuid organization_id_external
        timestamptz granted_at
        timestamptz revoked_at
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
        timestamptz joined_at
        timestamptz revoked_at
    }
    REFRESH_SESSIONS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        varchar device_fingerprint
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by_session_id FK
    }
    AUTH_CHALLENGES {
        uuid id PK
        uuid user_id FK
        varchar challenge_type
        varchar token_hash UK
        int failed_attempts
        timestamptz expires_at
        timestamptz consumed_at
    }
    SECURITY_AUDITS {
        uuid id PK
        uuid actor_user_id FK
        varchar action
        varchar target_ref
        uuid organization_id_external
        varchar result
        uuid correlation_id
        jsonb metadata
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

- Partial unique trên `normalized_email` và `normalized_phone` khi khác null.
- `UNIQUE(user_id, role_id, organization_id_external)` cho assignment còn hiệu lực; role tenant bắt buộc organization, role platform bắt buộc null theo check constraint.
- `UNIQUE(user_id, organization_id_external)` theo membership policy.
- Token/challenge chỉ lưu hash; index expiry phục vụ cleanup, không dùng token rõ làm lookup/log.
- `security_audits` append-only đối với application role thông thường.

