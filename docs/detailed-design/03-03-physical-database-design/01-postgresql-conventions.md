# 3.3.1 PostgreSQL Conventions và Integration Tables

## Type và naming

| Concern | Baseline |
|---|---|
| ID | UUID/ULID-compatible UUID; không tái sử dụng |
| Time | `timestamptz`, UTC |
| Money | `bigint` đơn vị nhỏ nhất cho MVP VND; hoặc `numeric(19,4)` nếu provider/currency buộc fractional, không dùng float |
| Currency | `char(3)` uppercase + check/allow-list |
| State | `varchar(40)` + check constraint; enum DB chỉ dùng khi migration workflow hỗ trợ an toàn |
| Version | `bigint not null default 0`, tăng atomically khi mutation |
| JSON | `jsonb` chỉ cho snapshot/metadata có schema application; không thay relational core |
| Soft delete | `status` và/hoặc `deleted_at`; transaction history không hard delete |
| Naming | `snake_case`, table plural, constraint/index có prefix rõ |

Mọi aggregate transaction có `created_at`, `updated_at`, `row_version` khi có concurrent mutation. Application không tự set trusted audit timestamp từ client.

## Common tables per service

```sql
create table outbox_messages (
  id uuid primary key,
  message_type varchar(120) not null,
  schema_version integer not null check (schema_version > 0),
  aggregate_id uuid not null,
  aggregate_version bigint,
  payload jsonb not null,
  correlation_id uuid not null,
  causation_id varchar(128),
  occurred_at timestamptz not null,
  published_at timestamptz,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error_code varchar(80)
);

create index ix_outbox_pending
  on outbox_messages (coalesce(next_attempt_at, occurred_at), occurred_at)
  where published_at is null;

create table inbox_messages (
  id uuid primary key,
  consumer_name varchar(120) not null,
  message_id varchar(128) not null,
  message_type varchar(120) not null,
  schema_version integer not null,
  payload_hash varchar(128) not null,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  constraint uq_inbox_consumer_message unique (consumer_name, message_id)
);

create table idempotency_records (
  id uuid primary key,
  actor_scope varchar(200) not null,
  operation varchar(120) not null,
  idempotency_key varchar(200) not null,
  request_hash varchar(128) not null,
  processing_state varchar(20) not null,
  response_status integer,
  response_snapshot jsonb,
  resource_reference varchar(200),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint uq_idempotency_scope unique (actor_scope, operation, idempotency_key),
  constraint ck_idempotency_state check (processing_state in ('PROCESSING','COMPLETED','FAILED_RETRYABLE'))
);
```

Response snapshot phải được lọc; không lưu access token, provider secret hoặc PII không cần thiết.

## Audit table

```sql
create table audit_logs (
  id uuid primary key,
  actor_id_external uuid,
  service_identity varchar(120),
  action varchar(120) not null,
  target_type varchar(80) not null,
  target_id varchar(200) not null,
  organization_id_external uuid,
  result varchar(40) not null,
  reason varchar(500),
  correlation_id uuid not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create index ix_audit_target_time on audit_logs (target_type, target_id, occurred_at desc);
create index ix_audit_tenant_time on audit_logs (organization_id_external, occurred_at desc);
```

Application role thông thường chỉ có INSERT/SELECT theo permission; không UPDATE/DELETE. Audit chứa safe diff/reference, không chứa full secret/PII before-after.

## Transaction patterns

- Business aggregate + Outbox insert trong cùng transaction.
- Inbox insert + consumer side effect + Outbox tiếp theo trong cùng transaction.
- Outbox worker claim batch bằng `FOR UPDATE SKIP LOCKED`; chỉ set `published_at` sau publisher confirm.
- Không giữ DB transaction mở trong khi gọi HTTP/provider/RabbitMQ.
- Retry transaction chỉ với SQLSTATE transient được allow-list và command idempotent.

