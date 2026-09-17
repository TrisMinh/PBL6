create table trip_snapshots (
  trip_id uuid primary key,
  organization_id_external uuid not null,
  route_id_external uuid not null,
  bus_id_external uuid not null,
  origin_stop_id_external uuid not null,
  destination_stop_id_external uuid not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  currency char(3) not null,
  status varchar(30) not null,
  sellable boolean not null default false,
  source_trip_version bigint not null check (source_trip_version > 0),
  route_snapshot jsonb not null,
  bus_snapshot jsonb not null,
  fare_policy_snapshot jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint ck_trip_snapshots_time check (arrival_at > departure_at),
  constraint ck_trip_snapshots_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_trip_snapshots_status check (status in ('SCHEDULED','BOARDING','DEPARTED','IN_TRANSIT','ARRIVED','COMPLETED','CANCELLED')),
  constraint ck_trip_snapshots_sellable check (not sellable or status in ('SCHEDULED','BOARDING'))
);

create index ix_trip_snapshots_sellable
  on trip_snapshots (departure_at, organization_id_external)
  where sellable = true;

create table trip_seats (
  id uuid primary key,
  trip_id uuid not null references trip_snapshots(trip_id),
  source_seat_id_external uuid not null,
  seat_code varchar(20) not null,
  seat_type varchar(30) not null,
  deck smallint not null default 1 check (deck between 1 and 2),
  row_no smallint not null check (row_no > 0),
  column_no smallint not null check (column_no > 0),
  price bigint not null check (price >= 0),
  status varchar(20) not null,
  active_hold_id uuid,
  active_booking_item_id uuid,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_trip_seat_source unique (trip_id, source_seat_id_external),
  constraint uq_trip_seat_code unique (trip_id, seat_code),
  constraint ck_trip_seat_type check (seat_type in ('STANDARD','VIP','SLEEPER')),
  constraint ck_trip_seat_status check (status in ('AVAILABLE','HELD','BOOKED','DISABLED')),
  constraint ck_trip_seat_owner check (
    (status = 'AVAILABLE' and active_hold_id is null and active_booking_item_id is null) or
    (status = 'HELD' and active_hold_id is not null and active_booking_item_id is null) or
    (status = 'BOOKED' and active_hold_id is null and active_booking_item_id is not null) or
    (status = 'DISABLED' and active_hold_id is null and active_booking_item_id is null)
  )
);

create index ix_trip_seats_inventory
  on trip_seats (trip_id, status, id)
  include (seat_code, seat_type, price, row_version);

create table seat_holds (
  id uuid primary key,
  trip_id uuid not null references trip_snapshots(trip_id),
  customer_id_external uuid not null,
  idempotency_key varchar(200) not null,
  hold_token_hash varchar(128) not null,
  status varchar(20) not null,
  total_amount bigint not null check (total_amount >= 0),
  currency char(3) not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  row_version bigint not null default 0,
  constraint uq_seat_holds_token unique (hold_token_hash),
  constraint uq_seat_holds_idempotency unique (customer_id_external, idempotency_key),
  constraint ck_seat_holds_status check (status in ('ACTIVE','CONSUMED','EXPIRED','RELEASED')),
  constraint ck_seat_holds_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_seat_holds_expiry check (expires_at = created_at + interval '10 minutes'),
  constraint ck_seat_holds_terminal_time check (
    (status = 'CONSUMED' and consumed_at is not null and released_at is null) or
    (status in ('EXPIRED','RELEASED') and consumed_at is null and released_at is not null) or
    (status = 'ACTIVE' and consumed_at is null and released_at is null)
  )
);

create index ix_seat_holds_expiry
  on seat_holds (expires_at, id)
  where status = 'ACTIVE';
create index ix_seat_holds_customer
  on seat_holds (customer_id_external, created_at desc);

create table seat_hold_items (
  seat_hold_id uuid not null references seat_holds(id) on delete cascade,
  trip_seat_id uuid not null references trip_seats(id),
  seat_code varchar(20) not null,
  unit_price bigint not null check (unit_price >= 0),
  primary key (seat_hold_id, trip_seat_id),
  constraint uq_seat_hold_items_seat unique (trip_seat_id, seat_hold_id)
);

create table bookings (
  id uuid primary key,
  booking_code varchar(20) not null,
  seat_hold_id uuid not null references seat_holds(id),
  trip_id uuid not null references trip_snapshots(trip_id),
  organization_id_external uuid not null,
  customer_id_external uuid not null,
  contact_name varchar(150) not null,
  contact_email varchar(254) not null,
  contact_phone varchar(20) not null,
  payment_channel varchar(20) not null,
  status varchar(30) not null,
  subtotal_amount bigint not null check (subtotal_amount >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  service_fee_amount bigint not null default 0 check (service_fee_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  currency char(3) not null,
  expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  cancellation_fee bigint check (cancellation_fee is null or cancellation_fee >= 0),
  refund_amount bigint check (refund_amount is null or refund_amount >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint uq_bookings_code unique (booking_code),
  constraint uq_bookings_hold unique (seat_hold_id),
  constraint ck_bookings_payment_channel check (payment_channel in ('PREPAID','PAY_LATER')),
  constraint ck_bookings_status check (status in ('PENDING_PAYMENT','CONFIRMED','PAID','EXPIRED','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED')),
  constraint ck_bookings_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ck_bookings_total check (
    discount_amount <= subtotal_amount
    and total_amount = subtotal_amount - discount_amount + service_fee_amount
  ),
  constraint ck_bookings_financials check (
    coalesce(cancellation_fee, 0) <= total_amount
    and coalesce(refund_amount, 0) <= total_amount
    and coalesce(cancellation_fee, 0) + coalesce(refund_amount, 0) <= total_amount
  ),
  constraint ck_bookings_channel_status check (
    (payment_channel = 'PREPAID' and status in ('PENDING_PAYMENT','PAID','EXPIRED','CANCELLED','REFUND_PENDING','REFUNDED','COMPLETED'))
    or (payment_channel = 'PAY_LATER' and status in ('CONFIRMED','CANCELLED','COMPLETED'))
  ),
  constraint ck_bookings_terminal_time check (
    (status = 'PAID' and paid_at is not null and cancelled_at is null) or
    (status = 'CONFIRMED' and paid_at is null and cancelled_at is null) or
    (status = 'CANCELLED' and cancelled_at is not null) or
    (status = 'REFUND_PENDING' and paid_at is not null and cancelled_at is not null and refunded_at is null) or
    (status = 'REFUNDED' and paid_at is not null and cancelled_at is not null and refunded_at is not null) or
    (status = 'COMPLETED' and completed_at is not null) or
    (status in ('PENDING_PAYMENT','EXPIRED') and paid_at is null and cancelled_at is null)
  )
);

create index ix_bookings_customer on bookings (customer_id_external, created_at desc);
create index ix_bookings_trip_status on bookings (trip_id, status, created_at);
create index ix_bookings_tenant_status on bookings (organization_id_external, status, created_at desc);

create table booking_items (
  id uuid primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  trip_seat_id uuid not null references trip_seats(id),
  source_seat_id_external uuid not null,
  seat_code varchar(20) not null,
  unit_price bigint not null check (unit_price >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null,
  constraint uq_booking_items_booking_seat unique (booking_id, trip_seat_id),
  constraint uq_booking_items_trip_seat unique (trip_seat_id),
  constraint ck_booking_items_total check (
    discount_amount <= unit_price and line_total = unit_price - discount_amount
  )
);

create table passengers (
  id uuid primary key,
  booking_item_id uuid not null references booking_items(id) on delete cascade,
  full_name varchar(150) not null,
  phone varchar(20),
  document_type varchar(30),
  document_number_ciphertext bytea,
  document_number_last4 varchar(4),
  pickup_stop_id_external uuid not null,
  dropoff_stop_id_external uuid not null,
  notes varchar(500),
  created_at timestamptz not null,
  constraint uq_passengers_booking_item unique (booking_item_id),
  constraint ck_passengers_stops check (pickup_stop_id_external <> dropoff_stop_id_external),
  constraint ck_passengers_document_pair check (
    (document_type is null and document_number_ciphertext is null and document_number_last4 is null)
    or (document_type in ('NATIONAL_ID','PASSPORT','OTHER') and document_number_ciphertext is not null)
  ),
  constraint ck_passengers_identity_last4 check (
    document_number_last4 is null or document_number_last4 ~ '^[A-Za-z0-9]{4}$'
  )
);

create table tickets (
  id uuid primary key,
  booking_id uuid not null references bookings(id),
  booking_item_id uuid not null references booking_items(id),
  public_code varchar(32) not null,
  qr_token_hash varchar(128) not null,
  payment_channel varchar(20) not null,
  status varchar(30) not null,
  issued_at timestamptz not null,
  checked_in_at timestamptz,
  checked_in_by_external uuid,
  used_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  row_version bigint not null default 0,
  constraint uq_tickets_booking_item unique (booking_item_id),
  constraint uq_tickets_public_code unique (public_code),
  constraint uq_tickets_qr_hash unique (qr_token_hash),
  constraint ck_tickets_payment_channel check (payment_channel in ('PREPAID','PAY_LATER')),
  constraint ck_tickets_status check (status in ('ISSUED','CHECKED_IN','USED','CANCELLED','REFUNDED')),
  constraint ck_tickets_refund_channel check (
    payment_channel = 'PREPAID' or status <> 'REFUNDED'
  ),
  constraint ck_tickets_state_time check (
    (status = 'ISSUED' and checked_in_at is null and used_at is null and cancelled_at is null and refunded_at is null) or
    (status = 'CHECKED_IN' and checked_in_at is not null and used_at is null and cancelled_at is null and refunded_at is null) or
    (status = 'USED' and checked_in_at is not null and used_at is not null and cancelled_at is null and refunded_at is null) or
    (status = 'CANCELLED' and cancelled_at is not null and refunded_at is null) or
    (status = 'REFUNDED' and cancelled_at is not null and refunded_at is not null)
  )
);

create index ix_tickets_status_checkin on tickets (status, checked_in_at);
create index ix_tickets_booking on tickets (booking_id, id);

create table cancellation_previews (
  id uuid primary key,
  booking_id uuid not null references bookings(id),
  requested_by_external uuid not null,
  booking_item_ids uuid[] not null,
  policy_version varchar(40) not null,
  eligible_amount bigint not null check (eligible_amount >= 0),
  fee_rate numeric(7,6) not null check (fee_rate between 0 and 1),
  fee_amount bigint not null check (fee_amount >= 0),
  refund_amount bigint not null check (refund_amount >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  constraint ck_cancellation_preview_items check (cardinality(booking_item_ids) > 0),
  constraint ck_cancellation_preview_amount check (fee_amount + refund_amount = eligible_amount),
  constraint ck_cancellation_preview_expiry check (expires_at > created_at)
);

create index ix_cancellation_previews_booking
  on cancellation_previews (booking_id, created_at desc);

alter table trip_seats
  add constraint fk_trip_seats_active_hold
  foreign key (active_hold_id) references seat_holds(id)
  deferrable initially deferred;

alter table trip_seats
  add constraint fk_trip_seats_active_booking_item
  foreign key (active_booking_item_id) references booking_items(id)
  deferrable initially deferred;
