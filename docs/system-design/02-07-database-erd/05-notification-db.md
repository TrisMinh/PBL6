# Notification Database ERD

Database: `notification_db`. User/reference IDs là external reference và không có FK sang service khác.

```mermaid
erDiagram
    TEMPLATES {
        uuid id PK
        varchar code
        varchar channel
        int version
        varchar locale
        text subject_template
        text body_template
        varchar status
        timestamptz created_at
    }
    USER_PREFERENCES {
        uuid id PK
        uuid user_id_external
        varchar notification_type
        varchar channel
        boolean enabled
        bigint row_version
        timestamptz updated_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id_external
        uuid template_id FK
        varchar notification_type
        varchar safe_reference
        varchar title
        text body
        varchar read_status
        timestamptz read_at
        timestamptz created_at
    }
    DELIVERY_ATTEMPTS {
        uuid id PK
        uuid notification_id FK
        varchar channel
        varchar provider_reference
        varchar status
        int attempt_no
        varchar safe_error_code
        timestamptz next_attempt_at
        timestamptz created_at
        timestamptz completed_at
    }

    TEMPLATES ||--o{ NOTIFICATIONS : renders
    NOTIFICATIONS ||--o{ DELIVERY_ATTEMPTS : delivered_by
```

## Constraints và index bắt buộc

- `UNIQUE(code, channel, locale, version)` trên Template; chỉ một version active theo policy.
- `UNIQUE(user_id_external, notification_type, channel)` trên UserPreference.
- `UNIQUE(notification_id, channel, attempt_no)` trên DeliveryAttempt.
- Index `(user_id_external, created_at desc)` cho inbox người dùng và `(status, next_attempt_at)` cho worker.
- Nội dung/template không được chứa secret, full token hoặc PII không cần thiết.
