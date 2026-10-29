-- Local/test-only deterministic fixture for isolated trip state-machine checks.
insert into trips (
  id, organization_id, route_id, bus_id, origin_stop_id, destination_stop_id,
  departure_at, arrival_at, operating_window, base_fare, currency, status, sellable,
  published_version, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000040',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000006',
  '01990a00-0000-7000-8000-000000000003',
  '01990a00-0000-7000-8000-000000000004',
  '01990a00-0000-7000-8000-000000000005',
  timestamptz '2027-01-10 08:00:00+07',
  timestamptz '2027-01-10 12:00:00+07',
  tstzrange('2027-01-10 07:00:00+07', '2027-01-10 13:00:00+07', '[)'),
  150000,
  'VND',
  'SCHEDULED',
  true,
  1,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into driver_assignments (
  id, trip_id, driver_profile_id, assignment_role, assignment_window, active,
  assigned_by_external, created_at
) values (
  '01990a00-0000-7000-8000-000000000041',
  '01990a00-0000-7000-8000-000000000040',
  '01990a00-0000-7000-8000-000000000035',
  'PRIMARY',
  tstzrange(timestamptz '2027-01-10 07:00:00+07', timestamptz '2027-01-10 13:00:00+07', '[)'),
  true,
  '01990a00-0000-7000-8000-000000000021',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;
