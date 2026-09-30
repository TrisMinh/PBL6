-- Snapshot occupancy for the synthetic seed trip so operator reports have a row.
insert into occupancy_projections (
  trip_id, organization_id_external, route_id_external, route_name, departure_at, status,
  capacity, available_count, held_count, booked_count, checked_in_count,
  source_version, data_as_of, updated_at
) values (
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000006',
  'Seed Origin Station → Seed Destination Station',
  timestamptz '2026-12-01 08:00:00+07',
  'SCHEDULED',
  6,
  3,
  0,
  3,
  0,
  1,
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (trip_id) do nothing;
