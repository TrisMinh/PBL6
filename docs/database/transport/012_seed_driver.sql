-- Seed driver profile for driver.seed@example.test and assign the synthetic trip.
insert into driver_profiles (
  id, organization_id, user_id_external, employee_code, license_number, license_expires_on,
  status, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000035',
  '01990a00-0000-7000-8000-000000000001',
  '01990a00-0000-7000-8000-000000000023',
  'SEED-DRV',
  'SEED-LIC-001',
  date '2027-12-31',
  'ACTIVE',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into driver_assignments (
  id, trip_id, driver_profile_id, assignment_role, assignment_window, active, assigned_by_external, created_at
) values (
  '01990a00-0000-7000-8000-000000000036',
  '01990a00-0000-7000-8000-000000000007',
  '01990a00-0000-7000-8000-000000000035',
  'PRIMARY',
  tstzrange(timestamptz '2026-12-01 07:00:00+07', timestamptz '2026-12-01 13:00:00+07', '[)'),
  true,
  '01990a00-0000-7000-8000-000000000021',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;
