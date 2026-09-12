-- Template: each service owns and applies an equivalent migration in its own database/schema.

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
  attempt_count integer not null default 0 check (attempt_count >= 0),
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
  schema_version integer not null check (schema_version > 0),
  payload_hash varchar(128) not null,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  constraint uq_inbox_consumer_message unique (consumer_name, message_id)
);

create table idempotency_records (
  id uuid primary key,
  actor_scope varchar(200) not null,
  operation varchar(120) not null,
  target_reference varchar(200) not null default '',
  idempotency_key varchar(200) not null,
  request_hash varchar(128) not null,
  processing_state varchar(20) not null,
  response_status integer,
  response_snapshot jsonb,
  resource_reference varchar(200),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint uq_idempotency_scope unique (actor_scope, operation, target_reference, idempotency_key),
  constraint ck_idempotency_state check (processing_state in ('PROCESSING','COMPLETED','FAILED_RETRYABLE')),
  constraint ck_idempotency_expiry check (expires_at > created_at)
);

create index ix_idempotency_expiry on idempotency_records (expires_at);

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
