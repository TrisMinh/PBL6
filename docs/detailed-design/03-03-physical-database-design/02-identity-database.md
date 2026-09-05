# 3.3.2 Identity Database

Logical DB/schema: `identity_db`; ERD: [Identity](../../system-design/02-07-database-erd/01-identity-db.md).

## Table và key

| Table | PK | Unique/constraint chính | Index/query chính |
|---|---|---|---|
| `users` | `id` | partial unique normalized email/phone; status allow-list | identity lookup, status |
| `roles` | `id` | `code` unique; scope platform/tenant | code |
| `permissions` | `id` | `(resource,action)` unique | resource/action |
| `user_roles` | `id` | active `(user,role,organization)` unique; tenant scope requires org | user, org |
| `role_permissions` | composite | `(role_id,permission_id)` | role |
| `organization_memberships` | `id` | active `(user,organization_external)` unique | user/org + status |
| `refresh_sessions` | `id` | `token_hash` unique | user active sessions, expiry |
| `auth_challenges` | `id` | token hash unique; type/status/expiry check | target + type, expiry |
| `security_audits` | `id` | append-only | actor/target/time |

## Identity uniqueness

```sql
create unique index uq_users_email
  on users (normalized_email)
  where normalized_email is not null and deleted_at is null;

create unique index uq_users_phone
  on users (normalized_phone)
  where normalized_phone is not null and deleted_at is null;

alter table user_roles add constraint ck_user_role_scope
  check (
    (role_scope = 'PLATFORM' and organization_id_external is null) or
    (role_scope = 'TENANT' and organization_id_external is not null)
  );
```

Normalization chạy bằng code/library thống nhất trước transaction; database unique constraint là guard cuối. Không trả raw constraint name ra API.

## Refresh rotation

Rotation transaction:

1. Lookup token hash và `SELECT ... FOR UPDATE` session.
2. Kiểm tra expiry/revoked/replaced.
3. Insert session mới; set session cũ `revoked_at`, `replaced_by_session_id`.
4. Ghi audit nếu reuse/replay; revoke session family theo policy.
5. Commit rồi trả token mới; raw refresh token không persist/log.

Index partial `(user_id, expires_at)` nơi `revoked_at is null` phục vụ revoke user/session. Cleanup không xóa audit hay active token.

## Challenge và lockout

- Challenge giữ `token_hash`, `expires_at`, `failed_attempts`, `consumed_at`; consume atomic bằng version/row lock.
- Login failure counter có thể ở Redis để giảm tải nhưng lockout state/quyết định bảo mật bền vững phải phục hồi được và có audit.
- Sau 5 lần thất bại liên tiếp áp khóa/làm chậm tối thiểu 15 phút theo policy cấu hình.

