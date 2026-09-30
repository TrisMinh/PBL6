-- Local/test inventory for the transport synthetic trip. No real PII.
-- Idempotent: safe to apply more than once.

insert into trip_snapshots (
  trip_id, organization_id_external, route_id_external, bus_id_external,
  origin_stop_id_external, destination_stop_id_external, departure_at, arrival_at,
  currency, status, sellable, source_trip_version, route_snapshot, bus_snapshot,
  fare_policy_snapshot, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000006',
  '01990a00-0000-7000-8000-000000000003',
  '01990a00-0000-7000-8000-000000000004',
  '01990a00-0000-7000-8000-000000000005',
  timestamptz '2026-12-01 08:00:00+07',
  timestamptz '2026-12-01 12:00:00+07',
  'VND',
  'SCHEDULED',
  true,
  1,
  '{}'::jsonb,
  '{"seats":[{"id":"01990a00-0000-7000-8000-000000000013","code":"1A","deck":1,"row":1,"column":1,"type":"STANDARD","active":true},{"id":"01990a00-0000-7000-8000-000000000014","code":"1B","deck":1,"row":1,"column":2,"type":"STANDARD","active":true}]}'::jsonb,
  '{"baseFare":150000,"allowPayLater":true,"policyVersion":"cancel-mvp-v1"}'::jsonb,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (trip_id) do nothing;

insert into trip_seats (
  id, trip_id, source_seat_id_external, seat_code, seat_type, deck, row_no, column_no,
  price, status, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000021',
    '01990a00-0000-7000-8000-000000000007',
    '01990a00-0000-7000-8000-000000000013',
    '1A', 'STANDARD', 1, 1, 1, 150000, 'AVAILABLE',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000022',
    '01990a00-0000-7000-8000-000000000007',
    '01990a00-0000-7000-8000-000000000014',
    '1B', 'STANDARD', 1, 1, 2, 150000, 'AVAILABLE',
    timestamptz '2026-01-01 00:00:00+00'
  )
on conflict (trip_id, source_seat_id_external) do nothing;
