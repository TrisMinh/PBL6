-- Local/test synthetic tenant/trip only. No real PII.
-- Idempotent: safe to apply more than once.

insert into organizations (
  id, code, name, legal_name, support_email, support_phone, status,
  allow_pay_later, commission_rate, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000001',
  'SEED01',
  'Synthetic Seed Operator',
  'Synthetic Seed Operator LLC',
  'operator.seed@example.test',
  '+840000000000',
  'ACTIVE',
  true,
  0.1000,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into buses (
  id, organization_id, plate_number, normalized_plate_number, display_name,
  bus_type, seat_count, status, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000003',
  '01990a00-0000-7000-8000-000000000001',
  'SEED-01',
  'SEED-01',
  'Seed Coach',
  'STANDARD',
  2,
  'ACTIVE',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into seats (
  id, bus_id, code, deck, row_no, column_no, seat_type, active, created_at, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000013',
    '01990a00-0000-7000-8000-000000000003',
    '1A', 1, 1, 1, 'STANDARD', true,
    timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000014',
    '01990a00-0000-7000-8000-000000000003',
    '1B', 1, 1, 2, 'STANDARD', true,
    timestamptz '2026-01-01 00:00:00+00', timestamptz '2026-01-01 00:00:00+00'
  )
on conflict (id) do nothing;

insert into stops (
  id, organization_id, code, name, address, province_code, status, created_at, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000004',
    '01990a00-0000-7000-8000-000000000001',
    'SEED-ORIG',
    'Seed Origin Station',
    '1 Seed Street',
    'DN',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000005',
    '01990a00-0000-7000-8000-000000000001',
    'SEED-DEST',
    'Seed Destination Station',
    '2 Seed Street',
    'HUE',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  )
on conflict (id) do nothing;

insert into routes (
  id, organization_id, code, name, origin_stop_id, destination_stop_id,
  default_duration_minutes, distance_km, status, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000006',
  '01990a00-0000-7000-8000-000000000001',
  'SEED-RT',
  'Seed Origin to Destination',
  '01990a00-0000-7000-8000-000000000004',
  '01990a00-0000-7000-8000-000000000005',
  240,
  100.00,
  'ACTIVE',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into route_stops (
  id, route_id, stop_id, sequence_no, stop_role, arrival_offset_minutes, departure_offset_minutes
) values
  (
    '01990a00-0000-7000-8000-000000000015',
    '01990a00-0000-7000-8000-000000000006',
    '01990a00-0000-7000-8000-000000000004',
    0, 'ORIGIN', 0, 0
  ),
  (
    '01990a00-0000-7000-8000-000000000016',
    '01990a00-0000-7000-8000-000000000006',
    '01990a00-0000-7000-8000-000000000005',
    1, 'DESTINATION', 240, 240
  )
on conflict (id) do nothing;

insert into trips (
  id, organization_id, route_id, bus_id, origin_stop_id, destination_stop_id,
  departure_at, arrival_at, operating_window, base_fare, currency, status, sellable,
  published_version, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000006',
  '01990a00-0000-7000-8000-000000000003',
  '01990a00-0000-7000-8000-000000000004',
  '01990a00-0000-7000-8000-000000000005',
  timestamptz '2026-12-01 08:00:00+07',
  timestamptz '2026-12-01 12:00:00+07',
  tstzrange('2026-12-01 07:00:00+07', '2026-12-01 13:00:00+07', '[)'),
  150000,
  'VND',
  'SCHEDULED',
  true,
  1,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;
