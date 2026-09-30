-- Local/test synthetic data only. No real PII.
-- Idempotent: safe to apply more than once.

insert into users (
  id, full_name, email, normalized_email, phone, normalized_phone, password_hash,
  status, email_verified_at, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000002',
  'Seed Customer',
  'seed.customer@example.test',
  'SEED.CUSTOMER@EXAMPLE.TEST',
  '+840000000001',
  '+840000000001',
  'SYNTHETIC_LOCAL_HASH_NOT_FOR_LOGIN',
  'ACTIVE',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into organization_memberships (
  id, user_id, organization_id_external, status, started_at, created_at, updated_at
) values (
  '01990a00-0000-7000-8000-000000000011',
  '01990a00-0000-7000-8000-000000000002',
  '01990a00-0000-7000-8000-000000000001',
  'ACTIVE',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00',
  timestamptz '2026-01-01 00:00:00+00'
) on conflict (id) do nothing;

insert into user_roles (id, user_id, role_id, organization_id_external, active, created_at)
select
  '01990a00-0000-7000-8000-000000000012',
  '01990a00-0000-7000-8000-000000000002',
  r.id,
  null,
  true,
  timestamptz '2026-01-01 00:00:00+00'
from roles r
where r.code = 'CUSTOMER'
on conflict (id) do nothing;
