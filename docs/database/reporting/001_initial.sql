create table booking_projections (
  booking_id uuid primary key,
  booking_code varchar(20) not null,
  organization_id_external uuid not null,
  customer_id_external uuid not null,
  trip_id_external uuid not null,
  route_name varchar(200) not null,
  departure_at timestamptz not null,
  status varchar(30) not null,
  seat_count integer not null check (seat_count > 0),
  gross_amount bigint not null check (gross_amount >= 0),
  cancellation_fee bigint not null default 0 check (cancellation_fee >= 0),
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  net_amount bigint not null,
  currency char(3) not null,
  booked_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  source_version bigint not null check (source_version > 0),
  data_as_of timestamptz not null,
  updated_at timestamptz not null,
  constraint uq_booking_projections_code unique (booking_code),
  constraint ck_booking_projection_status check (status in ('PENDING_PAYMENT','PAID','EXPIRED','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED')),
  constraint ck_booking_projection_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_booking_projection_amount check (
    cancellation_fee + refunded_amount <= gross_amount
    and net_amount = gross_amount - refunded_amount
  )
);

create index ix_booking_projections_tenant
  on booking_projections (organization_id_external, booked_at desc, status);
create index ix_booking_projections_customer
  on booking_projections (customer_id_external, booked_at desc);
create index ix_booking_projections_trip
  on booking_projections (trip_id_external, status);

create table revenue_projections (
  organization_id_external uuid not null,
  period_date date not null,
  currency char(3) not null,
  gross_revenue bigint not null default 0,
  refund_amount bigint not null default 0,
  cancellation_fee bigint not null default 0,
  net_revenue bigint not null default 0,
  paid_booking_count integer not null default 0 check (paid_booking_count >= 0),
  cancelled_booking_count integer not null default 0 check (cancelled_booking_count >= 0),
  data_as_of timestamptz not null,
  updated_at timestamptz not null,
  primary key (organization_id_external, period_date, currency),
  constraint ck_revenue_projection_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_revenue_projection_nonnegative check (
    gross_revenue >= 0 and refund_amount >= 0 and cancellation_fee >= 0
  ),
  constraint ck_revenue_projection_net check (net_revenue = gross_revenue - refund_amount)
);

create index ix_revenue_projections_period
  on revenue_projections (period_date desc, organization_id_external, currency);

create table occupancy_projections (
  trip_id uuid primary key,
  organization_id_external uuid not null,
  route_id_external uuid not null,
  route_name varchar(200) not null,
  departure_at timestamptz not null,
  status varchar(30) not null,
  capacity integer not null check (capacity > 0),
  available_count integer not null check (available_count >= 0),
  held_count integer not null check (held_count >= 0),
  booked_count integer not null check (booked_count >= 0),
  checked_in_count integer not null check (checked_in_count >= 0),
  source_version bigint not null check (source_version > 0),
  data_as_of timestamptz not null,
  updated_at timestamptz not null,
  constraint ck_occupancy_projection_status check (status in ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT','ARRIVED','COMPLETED','CANCELLED')),
  constraint ck_occupancy_projection_capacity check (
    available_count + held_count + booked_count <= capacity
    and checked_in_count <= booked_count
  )
);

create index ix_occupancy_projections_tenant_departure
  on occupancy_projections (organization_id_external, departure_at, status);

create table projection_checkpoints (
  projection_name varchar(120) primary key,
  consumer_name varchar(120) not null,
  last_message_id varchar(128),
  last_occurred_at timestamptz,
  last_processed_at timestamptz,
  status varchar(20) not null,
  lag_seconds integer not null default 0 check (lag_seconds >= 0),
  last_error_code varchar(80),
  row_version bigint not null default 0,
  constraint ck_projection_checkpoints_status check (status in ('RUNNING','DEGRADED','REBUILDING','STOPPED'))
);

create index ix_projection_checkpoints_status
  on projection_checkpoints (status, lag_seconds desc);
