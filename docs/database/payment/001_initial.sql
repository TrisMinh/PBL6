create table payments (
  id uuid primary key,
  booking_id_external uuid not null,
  customer_id_external uuid not null,
  provider varchar(30) not null,
  logical_reference varchar(120) not null,
  amount bigint not null check (amount > 0),
  currency char(3) not null,
  status varchar(30) not null,
  provider_order_reference varchar(160),
  expires_at timestamptz not null,
  succeeded_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  failure_code varchar(80),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_payments_logical_reference unique (logical_reference),
  constraint uq_payments_booking unique (booking_id_external),
  constraint ck_payments_provider check (provider in ('VNPAY_SANDBOX','SIMULATOR')),
  constraint ck_payments_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_payments_status check (status in ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELLED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED')),
  constraint ck_payments_state_time check (
    (status in ('SUCCEEDED','REFUND_PENDING','PARTIALLY_REFUNDED') and succeeded_at is not null and failed_at is null and cancelled_at is null and refunded_at is null) or
    (status = 'REFUNDED' and succeeded_at is not null and failed_at is null and cancelled_at is null and refunded_at is not null) or
    (status = 'FAILED' and failed_at is not null and succeeded_at is null and cancelled_at is null) or
    (status = 'CANCELLED' and cancelled_at is not null and succeeded_at is null and failed_at is null) or
    (status in ('PENDING','PROCESSING') and succeeded_at is null and failed_at is null and cancelled_at is null and refunded_at is null)
  ),
  constraint ck_payments_expiry check (expires_at > created_at)
);

create index ix_payments_booking on payments (booking_id_external, created_at desc);
create index ix_payments_status_worker on payments (status, updated_at, id);
create index ix_payments_customer on payments (customer_id_external, created_at desc);

create table payment_attempts (
  id uuid primary key,
  payment_id uuid not null references payments(id),
  attempt_no integer not null check (attempt_no > 0),
  provider varchar(30) not null,
  provider_transaction_id varchar(160),
  request_fingerprint varchar(128) not null,
  status varchar(30) not null,
  response_code varchar(80),
  response_metadata jsonb,
  created_at timestamptz not null,
  completed_at timestamptz,
  constraint uq_payment_attempt_number unique (payment_id, attempt_no),
  constraint ck_payment_attempt_provider check (provider in ('VNPAY_SANDBOX','SIMULATOR')),
  constraint ck_payment_attempt_status check (status in ('CREATED','REDIRECTED','SUCCEEDED','FAILED','EXPIRED')),
  constraint ck_payment_attempt_completion check (
    (status in ('SUCCEEDED','FAILED','EXPIRED') and completed_at is not null) or
    (status in ('CREATED','REDIRECTED') and completed_at is null)
  )
);

create unique index uq_payment_provider_transaction
  on payment_attempts (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index ix_payment_attempts_payment on payment_attempts (payment_id, created_at desc);

create table webhook_receipts (
  id uuid primary key,
  provider varchar(30) not null,
  external_event_id varchar(180) not null,
  provider_transaction_id varchar(160),
  payload_hash varchar(128) not null,
  signature_valid boolean,
  source_ip inet,
  status varchar(30) not null,
  rejection_code varchar(80),
  received_at timestamptz not null,
  verified_at timestamptz,
  processed_at timestamptz,
  constraint uq_webhook_provider_event unique (provider, external_event_id),
  constraint ck_webhook_provider check (provider in ('VNPAY_SANDBOX','SIMULATOR')),
  constraint ck_webhook_status check (status in ('RECEIVED','VERIFIED','PROCESSED','REJECTED')),
  constraint ck_webhook_state_time check (
    (status = 'RECEIVED' and verified_at is null and processed_at is null) or
    (status = 'VERIFIED' and verified_at is not null and processed_at is null) or
    (status = 'PROCESSED' and verified_at is not null and processed_at is not null) or
    (status = 'REJECTED' and processed_at is not null)
  )
);

create index ix_webhook_receipts_provider_time on webhook_receipts (provider, received_at desc);
create index ix_webhook_receipts_rejected
  on webhook_receipts (received_at desc, rejection_code)
  where status = 'REJECTED';

create table refunds (
  id uuid primary key,
  payment_id uuid not null references payments(id),
  booking_id_external uuid not null,
  requested_by_external uuid not null,
  refund_reference varchar(120) not null,
  provider_refund_id varchar(160),
  amount bigint not null check (amount > 0),
  currency char(3) not null,
  reason_code varchar(80) not null,
  status varchar(30) not null,
  failure_code varchar(80),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  succeeded_at timestamptz,
  row_version bigint not null default 0,
  constraint uq_refund_logical_reference unique (payment_id, refund_reference),
  constraint ck_refunds_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_refunds_status check (status in ('REQUESTED','PROCESSING','SUCCEEDED','FAILED')),
  constraint ck_refunds_success_time check (
    (status = 'SUCCEEDED' and succeeded_at is not null) or status <> 'SUCCEEDED'
  )
);

create unique index uq_refunds_provider_id
  on refunds (provider_refund_id)
  where provider_refund_id is not null;
create index ix_refunds_payment_worker on refunds (payment_id, status, updated_at);
create index ix_refunds_booking on refunds (booking_id_external, created_at desc);

create table reconciliation_cases (
  id uuid primary key,
  payment_id uuid references payments(id),
  provider varchar(30) not null,
  discrepancy_key varchar(180) not null,
  discrepancy_type varchar(80) not null,
  status varchar(30) not null,
  severity varchar(20) not null,
  details jsonb not null,
  opened_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by_external uuid,
  resolution_note varchar(1000),
  row_version bigint not null default 0,
  constraint ck_reconciliation_status check (status in ('OPEN','INVESTIGATING','RESOLVED','IGNORED')),
  constraint ck_reconciliation_severity check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  constraint ck_reconciliation_resolution check (
    (status in ('RESOLVED','IGNORED') and resolved_at is not null and resolved_by_external is not null)
    or (status in ('OPEN','INVESTIGATING') and resolved_at is null)
  )
);

create unique index uq_reconciliation_open_discrepancy
  on reconciliation_cases (provider, discrepancy_key)
  where status in ('OPEN','INVESTIGATING');
create index ix_reconciliation_cases_status on reconciliation_cases (status, opened_at, severity);
