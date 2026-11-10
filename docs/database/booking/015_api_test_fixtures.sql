-- Minimal deterministic fixtures for the API seat-status tests.
-- The main trip keeps 2A and 2B AVAILABLE for hold tests and has 1A BOOKED for BOOK-01.

insert into seat_holds (
  id, trip_id, customer_id_external, idempotency_key, hold_token_hash,
  status, total_amount, currency, created_at, expires_at, consumed_at, released_at
) values (
  '01990a00-0000-7000-8000-000000000051',
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000002',
  'seed-demo-booking-1a',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'CONSUMED', 150000, 'VND',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:10:00+00',
  timestamptz '2026-01-01 00:01:00+00', null
) on conflict (id) do nothing;

insert into seat_hold_items (seat_hold_id, trip_seat_id, seat_code, unit_price)
select
  '01990a00-0000-7000-8000-000000000051',
  ts.id,
  ts.seat_code,
  150000
from trip_seats ts
where ts.trip_id = '01990a00-0000-7000-8000-000000000007'
  and ts.seat_code = '1A'
on conflict (seat_hold_id, trip_seat_id) do nothing;

insert into bookings (
  id, booking_code, seat_hold_id, trip_id, organization_id_external, customer_id_external,
  contact_name, contact_email, contact_phone, payment_channel, status,
  subtotal_amount, discount_amount, service_fee_amount, total_amount, currency,
  expires_at, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000052',
  'DEMO-BOOKING-1A',
  '01990a00-0000-7000-8000-000000000051',
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000002',
  'Seed Customer', 'seed.customer@example.test', '+840000000001',
  'PAY_LATER', 'CONFIRMED', 150000, 0, 0, 150000, 'VND',
  timestamptz '2026-01-01 00:10:00+00',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:01:00+00'
) on conflict (id) do nothing;

insert into booking_items (
  id, booking_id, trip_seat_id, source_seat_id_external, seat_code,
  unit_price, discount_amount, line_total, created_at
)
select
  '01990a00-0000-7000-8000-000000000053',
  '01990a00-0000-7000-8000-000000000052',
  ts.id,
  ts.source_seat_id_external,
  ts.seat_code,
  150000, 0, 150000,
  timestamptz '2026-01-01 00:00:00+00'
from trip_seats ts
where ts.trip_id = '01990a00-0000-7000-8000-000000000007'
  and ts.seat_code = '1A'
on conflict (id) do nothing;

update trip_seats
set status = 'BOOKED',
    active_hold_id = null,
    active_booking_item_id = '01990a00-0000-7000-8000-000000000053',
    updated_at = timestamptz '2026-01-01 00:01:00+00'
where trip_id = '01990a00-0000-7000-8000-000000000007'
  and seat_code = '1A';

-- Fixed test-only departed trip referenced by BOOK-07 in the collection.
insert into trip_snapshots (
  trip_id, organization_id_external, route_id_external, bus_id_external,
  origin_stop_id_external, destination_stop_id_external, departure_at, arrival_at,
  currency, status, sellable, source_trip_version, route_snapshot, bus_snapshot,
  fare_policy_snapshot, created_at, updated_at
) values (
  '01a18b06-7537-78b0-8952-4413bcadc98d',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000006',
  '01990a00-0000-7000-8000-000000000003',
  '01990a00-0000-7000-8000-000000000004',
  '01990a00-0000-7000-8000-000000000005',
  timestamptz '2026-01-01 08:00:00+07',
  timestamptz '2026-01-01 12:00:00+07',
  'VND', 'DEPARTED', false, 1,
  '{}'::jsonb,
  '{"seats":[{"id":"01a18b06-7de0-70e3-9240-eddb86a03f8f","code":"1C","deck":1,"row":1,"column":3,"type":"STANDARD","active":true}]}'::jsonb,
  '{"baseFare":150000,"allowPayLater":true,"policyVersion":"cancel-mvp-v1"}'::jsonb,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (trip_id) do update set
  status = excluded.status,
  sellable = excluded.sellable,
  bus_snapshot = excluded.bus_snapshot,
  updated_at = excluded.updated_at;

insert into trip_seats (
  id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no,
  column_no, price, status, updated_at
) values (
  '01a18b06-7de0-70e3-9240-eddb86a03f8f',
  '01a18b06-7537-78b0-8952-4413bcadc98d',
  '01a18b06-7de0-70e3-9240-eddb86a03f8f',
  '1C', 'STANDARD', 1, 1, 3, 150000, 'AVAILABLE',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;
